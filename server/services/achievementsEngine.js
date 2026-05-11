import AchievementUnlock from "../models/AchievementUnlock.js";
import History from "../models/History.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { categoriesFromGoals, isAchievementApplicable } from "../utils/achievementAvailability.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";

export async function evaluateAndRecordAchievements({ user, goals, questsCompleted, focusHours }) {
	const categories = categoriesFromGoals(goals);
	const streakDays = await computeActivityStreakDays(user._id);
	const activeGoals = goals || [];

	const unlockedNow = new Set();

	if (activeGoals.length >= 1) unlockedNow.add("program_committed");
	if (activeGoals.some((g) => g.fitnessPlanSnapshot && typeof g.fitnessPlanSnapshot === "object")) {
		unlockedNow.add("plan_snapshot");
	}
	if (activeGoals.some((g) => (g.fitnessLibraryMatchCount || 0) > 0)) {
		unlockedNow.add("library_grounded");
	}

	if (questsCompleted >= 1) unlockedNow.add("first_quest");
	if (questsCompleted >= 5) unlockedNow.add("five_quests");
	if (questsCompleted >= 10) unlockedNow.add("ten_quests");
	if (questsCompleted >= 25) unlockedNow.add("twentyfive_quests");
	if (questsCompleted >= 50) unlockedNow.add("fifty_quests");
	if (questsCompleted >= 100) unlockedNow.add("hundred_quests");

	if (streakDays >= 3) unlockedNow.add("streak_3");
	if (streakDays >= 7) unlockedNow.add("streak_7");
	if (streakDays >= 14) unlockedNow.add("streak_14");
	if (streakDays >= 30) unlockedNow.add("streak_30");

	const level = user.level ?? 0;
	if (level >= 10) unlockedNow.add("level_10");
	if (level >= 25) unlockedNow.add("level_25");

	if (user.xp >= 1000) unlockedNow.add("xp_1k");
	if (user.xp >= 10000) unlockedNow.add("xp_10k");
	if (user.xp >= 25000) unlockedNow.add("xp_25k");
	if (user.xp >= 50000) unlockedNow.add("xp_50k");
	if (user.xp >= 100000) unlockedNow.add("xp_100k");

	// Reserved for future focus-session achievements; callers still pass hours for API stability.
	void focusHours;

	const applicable = ACHIEVEMENTS.filter((a) => isAchievementApplicable(a, categories));
	const applicableIds = new Set(applicable.map((a) => a.id));

	const already = await AchievementUnlock.find({ userId: user._id }).lean();
	const alreadyIds = new Set(already.map((x) => x.achievementId));

	const newlyUnlocked = [];
	for (const id of unlockedNow) {
		if (!applicableIds.has(id)) continue;
		if (alreadyIds.has(id)) continue;
		newlyUnlocked.push(id);
	}

	if (newlyUnlocked.length) {
		for (const id of newlyUnlocked) {
			await AchievementUnlock.create({ userId: user._id, achievementId: id });
			await History.create({
				userId: user._id,
				type: "achievement_unlocked",
				xpChange: 0,
				meta: { achievementId: id },
			});
		}
	}

	return newlyUnlocked;
}
