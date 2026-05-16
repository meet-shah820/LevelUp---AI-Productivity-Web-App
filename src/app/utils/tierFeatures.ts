/** Aligns UI with `server/constants/billingPlans.js` (TIER_CATALOG). */

export type BillingTierId = "free" | "starter" | "pro" | "elite";

const RANK: Record<BillingTierId, number> = {
	free: 0,
	starter: 1,
	pro: 2,
	elite: 3,
};

export function tierRankOf(tier: BillingTierId): number {
	return RANK[tier] ?? 0;
}

export function tierMeetsMinimum(have: BillingTierId, need: BillingTierId): boolean {
	return tierRankOf(have) >= tierRankOf(need);
}

/** Minimum tiers for gated product areas — keep in sync with marketing copy */
export const TIER_FOR = {
	analyticsPage: "pro",
	weeklyRecapModal: "pro",
	weeklySummaryEmailPreference: "pro",
	secondActiveGoal: "starter",
	editGoalTriggersAiQuestRealign: "starter",
	regenerateAiQuestPlan: "starter",
	questsProgramSidebar: "starter",
	foundingBadgeFlair: "starter",
	leaderboardEliteBadge: "elite",
} as const satisfies Record<string, BillingTierId>;
