/** Shared rules for achievement eligibility vs active goal categories (see achievementsEngine). */

/**
 * @param {{ category?: string }[]} goals
 * @returns {Set<string>}
 */
export function categoriesFromGoals(goals) {
	return new Set((goals || []).map((g) => g.category).filter(Boolean));
}

/**
 * @param {{ requiredCategory?: string }} achievement
 * @param {Set<string>} categories
 */
export function isAchievementApplicable(achievement, categories) {
	if (!achievement.requiredCategory) return true;
	return categories.has(achievement.requiredCategory);
}
