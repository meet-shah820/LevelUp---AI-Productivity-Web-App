import express from "express";
import Stripe from "stripe";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function getServerOrigin(req) {
	const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString().split(",")[0].trim();
	const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000").toString().split(",")[0].trim();
	return `${proto}://${host}`;
}

function getClientOrigin(req) {
	// Prefer explicit frontend base if provided (typical on Vite + Render)
	const envBase = String(process.env.VITE_API_BASE || "").trim();
	// VITE_API_BASE is API base, not client base, so don't use it here.
	// Use OAUTH_SUCCESS_REDIRECT host as a decent "frontend origin" fallback if configured.
	const successRedirect = String(process.env.OAUTH_SUCCESS_REDIRECT || "").trim();
	if (successRedirect) {
		try {
			return new URL(successRedirect).origin;
		} catch {
			// ignore
		}
	}
	// Final fallback: same origin as API (works when served together)
	return getServerOrigin(req);
}

function mustEnv(name) {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env var: ${name}`);
	return v;
}

function stripeClient() {
	const key = mustEnv("STRIPE_SECRET_KEY");
	return new Stripe(key, { apiVersion: "2024-06-20" });
}

/** Stripe account id for this secret key (standard keys only). */
async function fetchStripeAccountId() {
	try {
		const sk = String(process.env.STRIPE_SECRET_KEY || "");
		if (!sk) return null;
		const r = await fetch("https://api.stripe.com/v1/account", {
			headers: { Authorization: `Bearer ${sk}` },
		});
		if (!r.ok) return null;
		const j = await r.json();
		return typeof j.id === "string" ? j.id : null;
	} catch {
		return null;
	}
}

function priceEnvNameForTier(tier) {
	switch (String(tier)) {
		case "starter":
			return "STRIPE_PRICE_STARTER";
		case "pro":
			return "STRIPE_PRICE_PRO";
		case "elite":
			return "STRIPE_PRICE_ELITE";
		default:
			return "STRIPE_PRICE_*";
	}
}

function stripeKeyMode() {
	const sk = String(process.env.STRIPE_SECRET_KEY || "");
	if (sk.startsWith("sk_live")) return "live";
	if (sk.startsWith("sk_test")) return "test";
	return "unknown";
}

function isNoSuchPriceError(e) {
	const code = e?.code ?? e?.raw?.code;
	const msg = String(e?.message ?? e?.raw?.message ?? "");
	const param = String(e?.param ?? e?.raw?.param ?? "");
	if (/no such price/i.test(msg)) return true;
	if (code === "resource_missing" && (param.includes("price") || param.includes("line_items"))) return true;
	return false;
}

async function listRecurringPriceIdsSample(stripe, max = 14) {
	try {
		const list = await stripe.prices.list({ limit: 60, active: true });
		return list.data.filter((p) => p.recurring).map((p) => p.id).slice(0, max);
	} catch {
		return [];
	}
}

async function buildMissingPriceErrorMessage(stripe, mode, accountId, priceId, envName) {
	const acctLine = accountId
		? `This secret key belongs to Stripe account ${accountId}. In that account’s Dashboard, turn ${mode === "test" ? "Test mode ON" : "Test mode OFF (Live)"}, open the product, and copy the Price ID under Pricing into ${envName} in your project .env.`
		: `Copy a Price ID from the same Stripe account and mode (${mode}) as STRIPE_SECRET_KEY.`;
	const sample = await listRecurringPriceIdsSample(stripe, 14);
	let listLine = "";
	if (sample.length) {
		listLine = ` This key currently sees these recurring price IDs—use the one that matches this tier (yours is not in this list): ${sample.join(", ")}.`;
	} else {
		listLine = " No active recurring prices exist for this account in this mode yet—create one under Product catalog.";
	}
	const reload =
		" Restart the API after editing .env. If it still fails, check Windows “Environment Variables” for old STRIPE_* entries; in development this app now prefers your project .env over those.";
	return `Stripe has no price ${priceId} (${envName}). ${acctLine}${listLine}${reload}`;
}

/** Trim and strip accidental quotes from .env (e.g. STRIPE_PRICE_X="price_..."). */
function envStripePrice(name) {
	let s = String(process.env[name] || "").trim();
	if (
		(s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
		(s.startsWith("'") && s.endsWith("'") && s.length >= 2)
	) {
		s = s.slice(1, -1).trim();
	}
	return s;
}

function tierToPriceId(tier) {
	switch (tier) {
		case "starter":
			return envStripePrice("STRIPE_PRICE_STARTER") || null;
		case "pro":
			return envStripePrice("STRIPE_PRICE_PRO") || null;
		case "elite":
			return envStripePrice("STRIPE_PRICE_ELITE") || null;
		default:
			return null;
	}
}

function isStripePriceId(v) {
	return typeof v === "string" && /^price_[a-zA-Z0-9]+$/.test(v.trim());
}

/** Human-readable amount for billing cards (from env). */
function normalizeMoneyLabel(raw, fallback) {
	const v = String(raw || "").trim();
	if (!v) return fallback;
	if (v.startsWith("$")) return v;
	if (/^[\d.,]+$/.test(v)) return `$${v}`;
	return v;
}

/**
 * Card headline per tier. Uses STRIPE_PRICE_* when it is not a Stripe Price id (e.g. $9.99).
 * When STRIPE_PRICE_* is price_..., use STRIPE_PRICE_*_LABEL (e.g. STRIPE_PRICE_PRO_LABEL=$9.99).
 */
function getPriceDisplayMap() {
	const fallback = { starter: "$7", pro: "$15", elite: "$29" };
	function one(priceEnv, labelEnv, fb) {
		const id = envStripePrice(priceEnv);
		if (!id) return fb;
		if (isStripePriceId(id)) {
			const lab = envStripePrice(labelEnv);
			return lab ? normalizeMoneyLabel(lab, fb) : fb;
		}
		return normalizeMoneyLabel(id, fb);
	}
	return {
		starter: one("STRIPE_PRICE_STARTER", "STRIPE_PRICE_STARTER_LABEL", fallback.starter),
		pro: one("STRIPE_PRICE_PRO", "STRIPE_PRICE_PRO_LABEL", fallback.pro),
		elite: one("STRIPE_PRICE_ELITE", "STRIPE_PRICE_ELITE_LABEL", fallback.elite),
	};
}

function priceIdToTier(priceId) {
	if (!priceId) return "free";
	const pid = String(priceId).trim();
	if (pid === envStripePrice("STRIPE_PRICE_STARTER")) return "starter";
	if (pid === envStripePrice("STRIPE_PRICE_PRO")) return "pro";
	if (pid === envStripePrice("STRIPE_PRICE_ELITE")) return "elite";
	return "free";
}

async function ensureStripeCustomer(stripe, user) {
	if (user?.billing?.stripeCustomerId) return user.billing.stripeCustomerId;

	const customer = await stripe.customers.create({
		metadata: { userId: String(user._id), username: user.username },
		email: user.email || undefined,
		name: user.displayName || undefined,
	});

	user.billing.stripeCustomerId = customer.id;
	await user.save();
	return customer.id;
}

// GET /api/billing/status — current tier + subscription status for UI
router.get("/status", requireAuth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).lean();
		return res.json({
			tier: user?.billing?.tier || "free",
			onboarded: !!user?.billing?.onboarded,
			stripeStatus: user?.billing?.stripeStatus || "",
			currentPeriodEndMs: user?.billing?.currentPeriodEndMs || 0,
			priceDisplay: getPriceDisplayMap(),
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load billing status" });
	}
});

// POST /api/billing/choose { tier: "free" } — mark onboarding complete for free tier
router.post("/choose", requireAuth, async (req, res) => {
	try {
		const { tier } = req.body || {};
		if (String(tier) !== "free") return res.status(400).json({ error: "Only free tier can be chosen directly" });
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });
		user.billing.tier = "free";
		user.billing.onboarded = true;
		user.billing.stripeSubscriptionId = "";
		user.billing.stripePriceId = "";
		user.billing.stripeStatus = "";
		user.billing.currentPeriodEndMs = 0;
		await user.save();
		return res.json({ ok: true, tier: "free", onboarded: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to choose plan" });
	}
});

// POST /api/billing/checkout { tier: "starter" | "pro" | "elite" }
router.post("/checkout", requireAuth, async (req, res) => {
	const tierStr = String((req.body || {}).tier || "");
	const envName = priceEnvNameForTier(tierStr);

	try {
		if (!["starter", "pro", "elite"].includes(tierStr)) {
			return res.status(400).json({ error: "Invalid tier" });
		}

		const priceId = tierToPriceId(tierStr);
		if (!priceId) return res.status(500).json({ error: "Stripe price not configured for this tier" });
		if (!isStripePriceId(priceId)) {
			return res.status(500).json({
				error: `Invalid Stripe price id for ${tierStr}. Expected something like price_123... (not a dollar amount).`,
			});
		}

		const stripe = stripeClient();
		const mode = stripeKeyMode();

		let priceObj;
		try {
			priceObj = await stripe.prices.retrieve(priceId);
		} catch (err) {
			if (isNoSuchPriceError(err)) {
				const acct = await fetchStripeAccountId();
				const errorText = await buildMissingPriceErrorMessage(stripe, mode, acct, priceId, envName);
				// eslint-disable-next-line no-console
				console.warn("[billing/checkout] price not found:", priceId, envName);
				return res.status(400).json({ error: errorText });
			}
			throw err;
		}

		if (!priceObj.active) {
			// eslint-disable-next-line no-console
			console.warn("[billing/checkout] price inactive:", priceId, envName);
			return res.status(400).json({
				error: `Stripe price ${priceId} (${envName}) is archived/inactive. Activate it in the Dashboard or point ${envName} at an active recurring price.`,
			});
		}
		if (!priceObj.recurring) {
			// eslint-disable-next-line no-console
			console.warn("[billing/checkout] price not recurring:", priceId, envName);
			return res.status(400).json({
				error: `Stripe price ${priceId} (${envName}) is not recurring. Subscriptions need a recurring monthly (or interval) price.`,
			});
		}

		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const customerId = await ensureStripeCustomer(stripe, user);

		const clientOrigin = getClientOrigin(req);
		const successUrl = `${clientOrigin}/settings?billing=success`;
		const cancelUrl = `${clientOrigin}/settings?billing=cancel`;

		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			customer: customerId,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			allow_promotion_codes: true,
			subscription_data: {
				metadata: {
					userId: String(user._id),
					username: user.username,
					requestedTier: tierStr,
				},
			},
			metadata: {
				userId: String(user._id),
				username: user.username,
				requestedTier: tierStr,
			},
		});

		return res.json({ url: session.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		if (isNoSuchPriceError(e)) {
			const acct = await fetchStripeAccountId();
			const mode = stripeKeyMode();
			const acctLine = acct ? `Account for this key: ${acct}. ` : "";
			return res.status(400).json({
				error: `${acctLine}Stripe could not use this price in ${mode} mode. Confirm ${envName} in .env matches Product catalog → Price API ID for that same account.`,
			});
		}
		return res.status(500).json({ error: "Failed to start checkout" });
	}
});

// GET /api/billing/verify-prices — debug which env prices exist for STRIPE_SECRET_KEY
router.get("/verify-prices", requireAuth, async (_req, res) => {
	try {
		const stripe = stripeClient();
		const mode = stripeKeyMode();
		const accountId = await fetchStripeAccountId();
		const tiers = ["starter", "pro", "elite"];
		const byTier = {};
		for (const t of tiers) {
			const id = tierToPriceId(t);
			const envVar = priceEnvNameForTier(t);
			if (!id) {
				byTier[t] = { ok: false, envVar, detail: "missing in .env" };
				continue;
			}
			if (!isStripePriceId(id)) {
				byTier[t] = { ok: false, envVar, value: id, detail: "must be price_..." };
				continue;
			}
			try {
				const p = await stripe.prices.retrieve(id);
				byTier[t] = {
					ok: p.active,
					envVar,
					priceId: p.id,
					active: p.active,
					recurring: !!p.recurring,
					currency: p.currency,
					unitAmount: p.unit_amount,
				};
			} catch (err) {
				byTier[t] = {
					ok: false,
					envVar,
					priceId: id,
					detail: err?.message || String(err),
					code: err?.code,
				};
			}
		}
		const recurringPriceIdsSample = await listRecurringPriceIdsSample(stripe, 30);
		return res.json({
			stripeKeyMode: mode,
			stripeAccountId: accountId,
			recurringPriceIdsSample,
			hint:
				"If any tier fails, copy Price IDs from this same account in the Dashboard with Test mode matching sk_test/sk_live. recurringPriceIdsSample is what this API key can actually see.",
			tiers: byTier,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: String(e?.message || e) });
	}
});

// POST /api/billing/portal — Stripe customer billing portal
router.post("/portal", requireAuth, async (req, res) => {
	try {
		const stripe = stripeClient();
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const customerId = await ensureStripeCustomer(stripe, user);
		const clientOrigin = getClientOrigin(req);
		const returnUrl = `${clientOrigin}/settings?billing=portal_return`;

		const portal = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: returnUrl,
		});

		return res.json({ url: portal.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to open billing portal" });
	}
});

// POST /api/billing/refresh — pull latest subscription state from Stripe (useful when webhooks aren't configured)
router.post("/refresh", requireAuth, async (req, res) => {
	try {
		const stripe = stripeClient();
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		if (!user.billing?.stripeCustomerId) {
			return res.json({
				ok: true,
				tier: user.billing?.tier || "free",
				onboarded: !!user.billing?.onboarded,
				stripeStatus: user.billing?.stripeStatus || "",
				currentPeriodEndMs: user.billing?.currentPeriodEndMs || 0,
				priceDisplay: getPriceDisplayMap(),
			});
		}

		const subs = await stripe.subscriptions.list({
			customer: user.billing.stripeCustomerId,
			status: "all",
			limit: 10,
			expand: ["data.customer", "data.items.data.price"],
		});

		// Prefer an active/trialing subscription; otherwise fall back to most recent.
		const preferred =
			subs.data.find((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due" || s.status === "unpaid") ||
			subs.data[0] ||
			null;

		if (preferred) {
			await syncUserFromSubscription(preferred);
		}

		const fresh = await User.findById(req.user._id).lean();
		return res.json({
			ok: true,
			tier: fresh?.billing?.tier || "free",
			onboarded: !!fresh?.billing?.onboarded,
			stripeStatus: fresh?.billing?.stripeStatus || "",
			currentPeriodEndMs: fresh?.billing?.currentPeriodEndMs || 0,
			priceDisplay: getPriceDisplayMap(),
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to refresh billing" });
	}
});

/**
 * Used by webhook handler to synchronize a user based on a Stripe subscription.
 * Exported for server/index.js webhook path.
 */
export async function syncUserFromSubscription(sub) {
	const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
	if (!customerId) return;
	const priceId = sub?.items?.data?.[0]?.price?.id || "";
	const tier = priceIdToTier(priceId);
	const status = sub.status || "";
	const periodEndMs = sub.current_period_end ? Number(sub.current_period_end) * 1000 : 0;

	const user = await User.findOne({ "billing.stripeCustomerId": customerId });
	if (!user) return;

	user.billing.tier = ["active", "trialing", "past_due", "unpaid"].includes(status) ? tier : "free";
	// Mark onboarding complete once we see a subscription event at all.
	user.billing.onboarded = true;
	user.billing.stripeSubscriptionId = String(sub.id || "");
	user.billing.stripePriceId = String(priceId || "");
	user.billing.stripeStatus = String(status || "");
	user.billing.currentPeriodEndMs = periodEndMs;
	await user.save();
}

export default router;

