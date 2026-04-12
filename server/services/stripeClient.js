import Stripe from "stripe";

let cached = null;

/** @returns {Stripe | null} */
export function getStripe() {
	const key = process.env.STRIPE_SECRET_KEY?.trim();
	if (!key) return null;
	if (!cached) {
		cached = new Stripe(key);
	}
	return cached;
}
