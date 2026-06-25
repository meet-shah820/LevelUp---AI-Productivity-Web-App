/**
 * One-time (per Stripe account / mode) setup: creates LevelUp Starter / Pro / Elite products
 * with monthly + annual prices (33% annual discount; 14-day trial configured at checkout).
 * Prints env lines for STRIPE_PRICE_*.
 *
 * Usage (from repo root):
 *   Set STRIPE_SECRET_KEY in .env (sk_test_... or sk_live_...), then:
 *   npm run stripe:bootstrap
 */
import Stripe from "stripe";
import { loadProjectEnv } from "../config/loadEnv.js";
import { ANNUAL_TRIAL_DAYS } from "../constants/billingPlans.js";

loadProjectEnv({ mode: "script" });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
	console.error("Missing STRIPE_SECRET_KEY in environment (.env).");
	process.exit(1);
}

const stripe = new Stripe(key);

const PLANS = [
	{
		tier: "starter",
		name: "LevelUp — Starter",
		amount: 499,
		annualAmount: 3999,
		envKey: "STRIPE_PRICE_STARTER",
		annualEnvKey: "STRIPE_PRICE_STARTER_ANNUAL",
	},
	{
		tier: "pro",
		name: "LevelUp — Pro",
		amount: 999,
		annualAmount: 7999,
		envKey: "STRIPE_PRICE_PRO",
		annualEnvKey: "STRIPE_PRICE_PRO_ANNUAL",
	},
	{
		tier: "elite",
		name: "LevelUp — Elite",
		amount: 1999,
		annualAmount: 15999,
		envKey: "STRIPE_PRICE_ELITE",
		annualEnvKey: "STRIPE_PRICE_ELITE_ANNUAL",
	},
];

async function findProductByTier(tier) {
	try {
		const res = await stripe.products.search({
			query: `active:'true' AND metadata['app_tier']:'${tier}'`,
			limit: 1,
		});
		if (res.data[0]) return res.data[0];
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.warn(`products.search failed (${msg}); listing products instead.`);
	}
	let startingAfter;
	for (let page = 0; page < 5; page++) {
		const list = await stripe.products.list({ active: true, limit: 100, starting_after: startingAfter });
		const found = list.data.find((p) => p.metadata?.app_tier === tier);
		if (found) return found;
		if (!list.has_more || list.data.length === 0) break;
		startingAfter = list.data[list.data.length - 1].id;
	}
	return null;
}

async function findRecurringPriceForProduct(productId, unitAmount, interval) {
	const prices = await stripe.prices.list({ product: productId, active: true, limit: 20 });
	return prices.data.find(
		(p) =>
			p.type === "recurring" &&
			p.recurring?.interval === interval &&
			p.unit_amount === unitAmount &&
			p.currency === "usd",
	);
}

async function ensurePlan({ tier, name, amount, annualAmount, envKey, annualEnvKey }) {
	let product = await findProductByTier(tier);
	if (!product) {
		product = await stripe.products.create({
			name,
			metadata: { app: "levelup", app_tier: tier },
		});
		console.log(`Created product ${product.id} (${tier})`);
	} else {
		console.log(`Reusing product ${product.id} (${tier})`);
	}

	let price = await findRecurringPriceForProduct(product.id, amount, "month");
	if (!price) {
		price = await stripe.prices.create({
			product: product.id,
			currency: "usd",
			unit_amount: amount,
			recurring: { interval: "month" },
			metadata: { app: "levelup", app_tier: tier, billing_interval: "month" },
		});
		console.log(`Created price ${price.id} ($${(amount / 100).toFixed(2)}/mo)`);
	} else {
		console.log(`Reusing price ${price.id} ($${(amount / 100).toFixed(2)}/mo)`);
	}

	const out = [{ envKey, priceId: price.id }];

	let annualPrice = await findRecurringPriceForProduct(product.id, annualAmount, "year");
	if (!annualPrice) {
		annualPrice = await stripe.prices.create({
			product: product.id,
			currency: "usd",
			unit_amount: annualAmount,
			recurring: { interval: "year" },
			metadata: {
				app: "levelup",
				app_tier: tier,
				billing_interval: "year",
				discount_percent: "33",
			},
		});
		console.log(`Created annual price ${annualPrice.id} ($${(annualAmount / 100).toFixed(2)}/yr)`);
	} else {
		console.log(`Reusing annual price ${annualPrice.id} ($${(annualAmount / 100).toFixed(2)}/yr)`);
	}
	out.push({ envKey: annualEnvKey, priceId: annualPrice.id });

	return out;
}

async function main() {
	const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
	console.log(`\nStripe bootstrap (${mode} mode)\n`);

	const out = [];
	for (const plan of PLANS) {
		const rows = await ensurePlan(plan);
		out.push(...rows);
	}

	console.log("\n--- Add these to .env and Render (same Stripe mode as this key) ---\n");
	console.log(out.map((row) => `${row.envKey}=${row.priceId}`).join("\n"));
	console.log(`\nAnnual checkout includes a ${ANNUAL_TRIAL_DAYS}-day free trial (configured in the API at checkout).`);
	console.log("Then restart the API. Webhook endpoint: POST /api/billing/webhook\n");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
