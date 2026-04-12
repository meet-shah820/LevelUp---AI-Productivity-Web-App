import express from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { getStripe } from "../services/stripeClient.js";
import {
	PAID_TIER_IDS,
	getStripePriceIdForTier,
	TIER_CATALOG,
	stripePricesConfigured,
} from "../constants/billingPlans.js";

const router = express.Router();

/** @param {unknown} err */
function readableStripeError(err) {
	if (!err || typeof err !== "object") return null;
	const o = /** @type {{ message?: unknown; raw?: { message?: unknown } }} */ (err);
	if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
	const raw = o.raw;
	if (raw && typeof raw.message === "string" && raw.message.trim()) return raw.message.trim();
	return null;
}

function frontendOrigin() {
	const raw =
		process.env.FRONTEND_URL?.trim() ||
		process.env.OAUTH_SUCCESS_REDIRECT?.trim()?.replace(/\/auth\/callback\/?$/, "") ||
		"http://localhost:5173";
	return raw.replace(/\/$/, "");
}

// GET /api/billing/plans — public catalog + whether Stripe checkout is available
router.get("/plans", (_req, res) => {
	return res.json({
		tiers: TIER_CATALOG.map((t) => ({
			...t,
			stripeConfigured: t.id === "free" ? true : stripePricesConfigured(),
			hasPriceId: t.id === "free" ? false : Boolean(getStripePriceIdForTier(t.id)),
		})),
		checkoutAvailable: stripePricesConfigured() && Boolean(getStripe()),
	});
});

// GET /api/billing/status — tier + subscription snapshot for nav and settings
router.get("/status", requireAuth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).lean();
		const b = user?.billing || {};
		return res.json({
			tier: b.tier || "free",
			subscriptionStatus: b.subscriptionStatus || "",
			currentPeriodEnd: b.currentPeriodEnd ? new Date(b.currentPeriodEnd).toISOString() : null,
			hasStripeCustomer: Boolean(b.stripeCustomerId),
			checkoutAvailable: stripePricesConfigured() && Boolean(getStripe()),
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load billing status" });
	}
});

// POST /api/billing/checkout-session — Stripe Checkout (subscription mode)
router.post("/checkout-session", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe || !stripePricesConfigured()) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	const tier = typeof req.body?.tier === "string" ? req.body.tier.trim() : "";
	if (!PAID_TIER_IDS.includes(tier)) {
		return res.status(400).json({ error: "Invalid tier. Choose starter, pro, or elite." });
	}

	const priceId = getStripePriceIdForTier(tier);
	if (!priceId) {
		return res.status(503).json({ error: "Missing Stripe Price ID for this tier." });
	}

	try {
		const user = await User.findById(req.user._id).exec();
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const activeLike = ["active", "trialing", "past_due"].includes(user.billing?.subscriptionStatus || "");
		if (activeLike && user.billing?.stripeCustomerId) {
			return res.status(409).json({
				error: "You already have a subscription. Use Manage billing to change or cancel your plan.",
				code: "USE_PORTAL",
			});
		}

		const origin = frontendOrigin();
		const successUrl = `${origin}/pricing?checkout=success`;
		const cancelUrl = `${origin}/pricing?checkout=canceled`;

		/** @type {import("stripe").Stripe.Checkout.SessionCreateParams} */
		const params = {
			mode: "subscription",
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			client_reference_id: String(user._id),
			metadata: { userId: String(user._id), tier },
			subscription_data: {
				metadata: { userId: String(user._id), tier },
			},
		};

		if (user.billing?.stripeCustomerId) {
			params.customer = user.billing.stripeCustomerId;
		} else {
			const email = String(user.email || "").trim();
			if (email) params.customer_email = email;
		}

		const session = await stripe.checkout.sessions.create(params);
		if (!session.url) {
			return res.status(500).json({ error: "Checkout did not return a URL" });
		}
		return res.json({ url: session.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("checkout-session", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to start checkout",
		});
	}
});

// POST /api/billing/portal-session — Stripe Customer Portal
router.post("/portal-session", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	try {
		const user = await User.findById(req.user._id).lean();
		const customerId = user?.billing?.stripeCustomerId;
		if (!customerId) {
			return res.status(400).json({ error: "No billing account found. Subscribe from the Pricing page first." });
		}

		const origin = frontendOrigin();
		const session = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: `${origin}/settings?tab=subscription`,
		});

		return res.json({ url: session.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("portal-session", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to open billing portal",
		});
	}
});

export default router;
