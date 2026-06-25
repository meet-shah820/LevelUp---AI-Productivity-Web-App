/**
 * Four tiers: one free + three paid (monthly + annual via Stripe Price IDs in env).
 * Display amounts are for marketing; actual charge is whatever each Stripe Price is set to.
 */

export const PAID_TIER_IDS = ["starter", "pro", "elite"];

/** All paid tiers support annual billing (33% off vs 12× monthly) with a 14-day trial at checkout. */
export const ANNUAL_ELIGIBLE_TIER_IDS = ["starter", "pro", "elite"];

/** Free trial on annual plans — card required upfront; billing starts after trial ends. */
export const ANNUAL_TRIAL_DAYS = 14;

/** @param {number} monthlyPriceCents @param {number} annualPriceCents */
export function annualDiscountPercent(monthlyPriceCents, annualPriceCents) {
	const fullYear = Math.round(Number(monthlyPriceCents) || 0) * 12;
	if (fullYear <= 0) return 0;
	const annual = Math.round(Number(annualPriceCents) || 0);
	return Math.max(0, Math.round((1 - annual / fullYear) * 100));
}

/** @param {number} monthlyPriceCents @param {number} annualPriceCents */
export function annualSavingsCents(monthlyPriceCents, annualPriceCents) {
	const fullYear = Math.round(Number(monthlyPriceCents) || 0) * 12;
	const annual = Math.round(Number(annualPriceCents) || 0);
	return Math.max(0, fullYear - annual);
}

/**
 * Strip BOM, whitespace, and wrapping quotes from env-based Price IDs (common Dashboard / Render paste issues).
 * @param {string | undefined} raw
 */
export function normalizeStripePriceId(raw) {
	if (raw == null) return "";
	let s = String(raw).replace(/^\uFEFF/, "").trim();
	if (!s) return "";
	// Line breaks / unicode spaces from dashboard or Render paste
	s = s.replace(/[\r\n\u00a0\u200b\u202f\uFEFF]/g, "").trim();
	// Repeatedly unwrap quotes (e.g. "\"price_xxx\"" from a bad paste)
	for (let i = 0; i < 3; i++) {
		const next = s.replace(/^['"]+|['"]+$/g, "").trim();
		if (next === s) break;
		s = next;
	}
	// Trailing junk from copy-paste
	s = s.replace(/[\s,;\u200b]+$/g, "");
	return s;
}

/** @param {string} tier @param {"month" | "year"} [interval] */
export function getStripePriceIdForTier(tier, interval = "month") {
	if (interval === "year") {
		if (tier === "starter") return normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER_ANNUAL);
		if (tier === "pro") return normalizeStripePriceId(process.env.STRIPE_PRICE_PRO_ANNUAL);
		if (tier === "elite") return normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE_ANNUAL);
		return "";
	}
	if (tier === "starter") return normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER);
	if (tier === "pro") return normalizeStripePriceId(process.env.STRIPE_PRICE_PRO);
	if (tier === "elite") return normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE);
	return "";
}

/** @param {string | undefined} priceId */
export function getTierFromStripePriceId(priceId) {
	if (!priceId || typeof priceId !== "string") return null;
	const id = normalizeStripePriceId(priceId);
	const s = normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER);
	const p = normalizeStripePriceId(process.env.STRIPE_PRICE_PRO);
	const e = normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE);
	const sYear = normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER_ANNUAL);
	const pYear = normalizeStripePriceId(process.env.STRIPE_PRICE_PRO_ANNUAL);
	const eYear = normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE_ANNUAL);
	if ((s && id === s) || (sYear && id === sYear)) return "starter";
	if ((p && id === p) || (pYear && id === pYear)) return "pro";
	if ((e && id === e) || (eYear && id === eYear)) return "elite";
	return null;
}

export function stripeAnnualPricesConfigured() {
	return Boolean(
		getStripePriceIdForTier("starter", "year") &&
			getStripePriceIdForTier("pro", "year") &&
			getStripePriceIdForTier("elite", "year"),
	);
}

/** @param {string} tier */
export function tierSupportsAnnualBilling(tier) {
	return ANNUAL_ELIGIBLE_TIER_IDS.includes(tier);
}

export function stripePricesConfigured() {
	return Boolean(
		getStripePriceIdForTier("starter") &&
			getStripePriceIdForTier("pro") &&
			getStripePriceIdForTier("elite"),
	);
}

/**
 * Tier copy + fallback cents if Stripe Price retrieve fails.
 * Live Pricing page amounts come from Stripe via GET /api/billing/plans.
 */
export const TIER_CATALOG = [
	{
		id: "free",
		name: "Free",
		tagline: "Everything you need to get started",
		monthlyPriceCents: 0,
		features: ["5 quests per month", "Basic analytics", "Community support"],
	},
	{
		id: "starter",
		name: "Starter",
		tagline: "Great for solo adventurers leveling up",
		monthlyPriceCents: 499,
		annualPriceCents: 3999,
		features: [
			"Everything in Free",
			"More quest depth and goal flexibility",
			"Quest reminder tuning",
			"Founding-member badge in profile (optional)",
		],
	},
	{
		id: "pro",
		name: "Pro",
		tagline: "For serious questers chasing mastery",
		monthlyPriceCents: 999,
		compareAtMonthlyPriceCents: 1299,
		annualPriceCents: 7999,
		pricingNote: "lower monthly",
		features: [
			"Everything in Starter",
			"Analytics and insights",
			"Weekly summary emails",
			"Higher daily quest caps",
		],
		highlight: true,
	},
	{
		id: "elite",
		name: "Elite",
		tagline: "Full power for ambitious teams",
		monthlyPriceCents: 1999,
		compareAtMonthlyPriceCents: 2499,
		annualPriceCents: 15999,
		pricingNote: "lower monthly",
		features: [
			"Everything in Pro",
			"Full leaderboard (all players per rank)",
			"Priority AI quest briefing quality",
			"Early access to new modes",
			"Elite flair on leaderboard",
		],
	},
];
