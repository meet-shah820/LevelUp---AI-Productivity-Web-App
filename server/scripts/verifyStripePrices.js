/**
 * Verifies STRIPE_SECRET_KEY can retrieve each STRIPE_PRICE_* (same Stripe account + test/live mode).
 *
 * From repo root:
 *   npm run stripe:verify
 *
 * Use this when you see Stripe errors like "No such price".
 */
import Stripe from "stripe";
import { loadProjectEnv } from "../config/loadEnv.js";
import { getStripePriceIdForTier, PAID_TIER_IDS } from "../constants/billingPlans.js";

loadProjectEnv({ mode: "script" });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
	console.error("Missing STRIPE_SECRET_KEY.");
	process.exit(1);
}

const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";
const stripe = new Stripe(key);

let failed = false;
for (const tier of PAID_TIER_IDS) {
	const priceId = getStripePriceIdForTier(tier);
	if (!priceId) {
		console.error(`[${tier}] Missing env STRIPE_PRICE_${tier.toUpperCase()}`);
		failed = true;
		continue;
	}
	try {
		const price = await stripe.prices.retrieve(priceId);
		const active = price.active ? "active" : "inactive";
		const amount =
			price.unit_amount != null
				? `${(price.unit_amount / 100).toFixed(2)} ${String(price.currency || "").toUpperCase()}`
				: "(custom amount)";
		console.log(`[${tier}] OK  ${priceId}  ${amount}  ${active}  recurring=${price.recurring?.interval || "n/a"}`);
		if (!price.active) {
			console.warn(`  ^ Price is inactive — reactivate in Stripe or use another price ID.`);
		}
	} catch (err) {
		failed = true;
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[${tier}] FAIL ${priceId}`);
		console.error(`  ${msg}`);
	}
}

console.log("");
console.log(`STRIPE_SECRET_KEY mode: ${mode}`);
if (failed) {
	console.error("");
	console.error("Fix: use Price IDs from the same Stripe account and mode as STRIPE_SECRET_KEY.");
	console.error("Dashboard → Products → select product → Pricing → copy the Price ID (price_...).");
	console.error("Test mode toggle (top right) must match sk_test_ vs sk_live_.");
	console.error("Or run: npm run stripe:bootstrap  (creates products/prices for the current key)");
	process.exit(1);
}

console.log("All configured prices are reachable.");
