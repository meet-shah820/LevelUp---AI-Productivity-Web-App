import User from "../models/User.js";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import { calculateLevelFromXp } from "../utils/level.js";

/**
 * Rich Mongo-backed context for AI quest/program generation.
 * Combines profile stats, other goals, and recent quest history so the model
 * can produce fresh, goal-specific plans instead of repeating generic templates.
 *
 * @param {import("mongoose").Types.ObjectId|string} userId
 * @param {{ excludeGoalId?: import("mongoose").Types.ObjectId|null, primaryGoal?: { title: string, description?: string }|null }} opts
 */
export async function buildAiQuestPlanContext(userId, opts = {}) {
	const { excludeGoalId = null, primaryGoal = null } = opts;
	const since14 = new Date(Date.now() - 14 * 86400000);
	const userFresh = await User.findById(userId).lean();
	const recentCompletedQuests14d = await Quest.countDocuments({
		userId,
		isCompleted: true,
		updatedAt: { $gte: since14 },
	});
	const recentRows = await Quest.find({
		userId,
		isCompleted: true,
	})
		.sort({ updatedAt: -1 })
		.limit(14)
		.select("title type")
		.lean();

	const otherFilter = { userId, status: "active" };
	if (excludeGoalId) {
		otherFilter._id = { $ne: excludeGoalId };
	}
	const otherGoals = await Goal.find(otherFilter).select("title description").limit(8).lean();

	const xp = userFresh?.xp ?? 0;
	const ctx = {
		hunterLevel: calculateLevelFromXp(xp),
		xp,
		streak: userFresh?.streak ?? 0,
		rank: userFresh?.rank ?? "E",
		stats: userFresh?.stats ?? {},
		recentCompletedQuests14d,
		recentCompletedQuestTitles: recentRows.map((q) => ({
			title: String(q.title || "").slice(0, 140),
			type: q.type,
		})),
		otherActiveTrainingGoals: otherGoals.map((g) => ({
			title: String(g.title || "").slice(0, 180),
			notes: String(g.description || "").trim().slice(0, 240),
		})),
	};
	if (primaryGoal?.title) {
		ctx.primaryGoalInPlan = {
			title: String(primaryGoal.title).slice(0, 220),
			notes: String(primaryGoal.description || "").trim().slice(0, 450),
		};
	}
	return ctx;
}
