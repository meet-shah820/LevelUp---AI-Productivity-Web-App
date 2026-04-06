import AchievementUnlock from "../models/AchievementUnlock.js";
import History from "../models/History.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { categoriesFromGoals, isAchievementApplicable } from "../utils/achievementAvailability.js";

export async function evaluateAndRecordAchievements({ user, goals, questsCompleted, focusHours }) {
	const categories = categoriesFromGoals(goals);

	const unlockedNow = new Set();
	if (questsCompleted >= 1) unlockedNow.add("first_quest");
	if (questsCompleted >= 5) unlockedNow.add("five_quests");
	if (questsCompleted >= 10) unlockedNow.add("ten_quests");
	if (questsCompleted >= 25) unlockedNow.add("twentyfive_quests");
	if (questsCompleted >= 50) unlockedNow.add("fifty_quests");
	if (questsCompleted >= 100) unlockedNow.add("hundred_quests");
	if (questsCompleted >= 250) unlockedNow.add("twofifty_quests");
	if (user.xp >= 1000) unlockedNow.add("xp_1k");
	if (user.xp >= 10000) unlockedNow.add("xp_10k");
	if (user.xp >= 25000) unlockedNow.add("xp_25k");
	if (user.xp >= 50000) unlockedNow.add("xp_50k");
	if (user.xp >= 100000) unlockedNow.add("xp_100k");
	if (focusHours >= 1) unlockedNow.add("focus_1h");
	if (focusHours >= 10) unlockedNow.add("focus_10h");
	if (focusHours >= 25) unlockedNow.add("focus_25h");
	if (focusHours >= 50) unlockedNow.add("focus_50h");
	if (categories.has("Fitness") && questsCompleted >= 25) unlockedNow.add("fitness_25");
	if (categories.has("Fitness") && questsCompleted >= 100) unlockedNow.add("fitness_100");
	if (categories.has("Learning") && questsCompleted >= 25) unlockedNow.add("learning_25");
	if (categories.has("Learning") && questsCompleted >= 100) unlockedNow.add("learning_100");
	if (categories.has("Career") && questsCompleted >= 25) unlockedNow.add("career_25");
	if (categories.has("Career") && questsCompleted >= 100) unlockedNow.add("career_100");
	if (categories.has("Health") && questsCompleted >= 25) unlockedNow.add("health_25");
	if (categories.has("Health") && questsCompleted >= 100) unlockedNow.add("health_100");
	if (categories.has("Creativity") && questsCompleted >= 25) unlockedNow.add("creativity_25");
	if (categories.has("Creativity") && questsCompleted >= 100) unlockedNow.add("creativity_100");

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

