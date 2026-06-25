import User from "../models/User.js";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import History from "../models/History.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import { pickAvailableUsernameFromDisplayName } from "../utils/usernameFromDisplayName.js";

export async function resetUserProgress(userId) {
	const resetDisplayName = "shadow_hunter";
	const resetUsername = await pickAvailableUsernameFromDisplayName(resetDisplayName, userId);
	await Quest.deleteMany({ userId });
	await Goal.deleteMany({ userId });
	await History.deleteMany({ userId });
	await AchievementUnlock.deleteMany({ userId });
	await User.updateOne(
		{ _id: userId },
		{
			$set: {
				username: resetUsername,
				displayName: resetDisplayName,
				level: 1,
				xp: 0,
				streak: 0,
				rank: "E",
				stats: { strength: 0, intelligence: 0, agility: 0, vitality: 0 },
				streakFreezesAvailable: 0,
			},
		}
	);
	return { ok: true, username: resetUsername };
}
