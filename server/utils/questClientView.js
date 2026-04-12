import { resolvePenaltyForQuest, executionPreviewFromHowTo } from "./questPenalty.js";

export function mapQuestDifficulty(d) {
	if (d === "easy" || d === "medium" || d === "hard") return d;
	return "medium";
}

/** API / UI shape for list cards — incomplete quests show penalty protocol in place of the main quest. */
export function mapQuestToClientResponse(q) {
	const completed = !!q.isCompleted;
	const baseHow = String(q.briefing?.howTo || "").trim();
	const basePreview = executionPreviewFromHowTo(baseHow);

	if (completed) {
		return {
			id: q._id,
			goalId: q.goalId,
			title: q.title,
			xp: q.xpReward,
			isCompleted: true,
			statType: q.statType,
			type: q.type,
			difficulty: mapQuestDifficulty(q.difficulty),
			expiresAt: null,
			executionPreview: basePreview,
			isPenaltyActive: false,
			originalTitle: q.title,
		};
	}

	const pen = resolvePenaltyForQuest(q);
	const pHow = String(pen.howTo || "").trim();
	return {
		id: q._id,
		goalId: q.goalId,
		title: pen.title,
		xp: q.xpReward,
		isCompleted: false,
		statType: q.statType,
		type: q.type,
		difficulty: mapQuestDifficulty(q.difficulty),
		expiresAt: null,
		executionPreview: executionPreviewFromHowTo(pHow),
		isPenaltyActive: true,
		originalTitle: q.title,
	};
}
