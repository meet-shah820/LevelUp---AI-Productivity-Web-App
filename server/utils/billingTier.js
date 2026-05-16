/** @typedef {"free"|"starter"|"pro"|"elite"} BillingTier */

export const TIER_RANK = {
	free: 0,
	starter: 1,
	pro: 2,
	elite: 3,
};

/**
 * When the client sends matching `X-LevelUp-Admin-Preview`, all tier gates pass (full unlock for admin preview).
 * If `LEVELUP_ADMIN_PREVIEW_TOKEN` is set server-side, only that token is accepted (override the default below).
 * Default `"2311"` matches the UI unlock; set LEVELUP_ADMIN_PREVIEW_TOKEN server-side to require a custom secret instead.
 */
export function adminPreviewBypassActive(req) {
	if (!req?.headers) return false;
	const hdr = String(req.headers["x-levelup-admin-preview"] ?? "").trim();
	if (!hdr) return false;
	const configured = String(process.env.LEVELUP_ADMIN_PREVIEW_TOKEN ?? "").trim();
	if (configured) return hdr === configured;
	return hdr === "2311";
}

/**
 * Numeric rank from User.billing.tier for comparisons.
 * @param {unknown} user mongoose doc or plain object with billing?.tier
 */
export function billingTierRank(user) {
	const t = String(user?.billing?.tier || "free").toLowerCase();
	if (t in TIER_RANK) return /** @type {number} */ (TIER_RANK[/** @type {keyof typeof TIER_RANK} */ (t)]);
	return 0;
}

/**
 * @param {unknown} user
 * @param {keyof typeof TIER_RANK} minTierKey
 */
export function meetsMinTier(user, minTierKey) {
	return billingTierRank(user) >= (TIER_RANK[minTierKey] ?? 0);
}

/**
 * Like `meetsMinTier`, but returns true for any tier when admin preview header is valid (no payment effects on API).
 * @param {unknown} user
 * @param {keyof typeof TIER_RANK} minTierKey
 * @param {import("express").Request | undefined} req
 */
export function meetsMinTierWithReq(user, minTierKey, req) {
	if (adminPreviewBypassActive(req)) return true;
	return meetsMinTier(user, minTierKey);
}
