import { resolvePenaltyForQuest, executionPreviewFromHowTo } from "./questPenalty.js";
import { isQuestTimeframeMissedForPenalty } from "./timeframePeriod.js";

export function mapQuestDifficulty(d) {
	if (d === "easy" || d === "medium" || d === "hard") return d;
	return "medium";
}

const SPECIAL_NO_PENALTY = new Set(["recovery", "welcome_bonus", "streak_saver"]);

/**
 * Shift stored difficulty easier while easy-mode tier > 0 (after recovery).
 * @param {string} dbDifficulty
 * @param {number} tier 0–4 (4 = softest)
 */
export function effectiveDifficultyForEasyMode(dbDifficulty, tier) {
	const t = Math.max(0, Math.min(4, Number(tier) || 0));
	if (t <= 0) return String(dbDifficulty || "medium").toLowerCase();
	const order = { easy: 0, medium: 1, hard: 2 };
	const rev = ["easy", "medium", "hard"];
	const raw = String(dbDifficulty || "medium").toLowerCase();
	let idx = order[raw] ?? 1;
	idx = Math.max(0, idx - t);
	return rev[idx];
}

function clientQuestTag(q) {
	const t = q.questTag;
	if (t === "recovery" || t === "welcome_bonus" || t === "streak_saver") return t;
	return "standard";
}

/**
 * @param {Record<string, unknown>} q — lean or doc quest
 * @param {{ comebackBonusQuestsRemaining?: number; easyModeTier?: number }} [opts]
 */
export function mapQuestToClientResponse(q, opts = {}) {
	const completed = !!q.isCompleted;
	const comebackRemaining = Math.max(0, Number(opts.comebackBonusQuestsRemaining || 0));
	const easyTier = Math.max(0, Math.min(4, Number(opts.easyModeTier || 0)));
	const baseXp = Number(q.xpReward) || 0;
	const projectedXp = !completed && comebackRemaining > 0 ? baseXp * 2 : baseXp;
	const tag = clientQuestTag(q);
	const baseHow = String(q.briefing?.howTo || "").trim();
	const basePreview = executionPreviewFromHowTo(baseHow);

	if (completed) {
		return {
			id: q._id,
			goalId: q.goalId,
			title: q.title,
			xp: baseXp,
			isCompleted: true,
			statType: q.statType,
			type: q.type,
			difficulty: mapQuestDifficulty(q.difficulty),
			expiresAt: null,
			executionPreview: basePreview,
			isPenaltyActive: false,
			originalTitle: q.title,
			questTag: tag,
			comebackBoostApplies: false,
			easyModeTier: easyTier,
		};
	}

	if (SPECIAL_NO_PENALTY.has(tag)) {
		const how = String(q.briefing?.howTo || "").trim();
		return {
			id: q._id,
			goalId: q.goalId,
			title: q.title,
			xp: projectedXp,
			isCompleted: false,
			statType: q.statType,
			type: q.type,
			difficulty: mapQuestDifficulty(q.difficulty),
			expiresAt: null,
			executionPreview: executionPreviewFromHowTo(how || String(q.title || "").trim()),
			isPenaltyActive: false,
			originalTitle: q.title,
			questTag: tag,
			comebackBoostApplies: comebackRemaining > 0,
			easyModeTier: easyTier,
		};
	}

	const missed = isQuestTimeframeMissedForPenalty(q, new Date());
	if (!missed) {
		return {
			id: q._id,
			goalId: q.goalId,
			title: q.title,
			xp: projectedXp,
			isCompleted: false,
			statType: q.statType,
			type: q.type,
			difficulty: mapQuestDifficulty(effectiveDifficultyForEasyMode(q.difficulty, easyTier)),
			expiresAt: null,
			executionPreview: basePreview || executionPreviewFromHowTo(String(q.title || "").trim()),
			isPenaltyActive: false,
			originalTitle: q.title,
			questTag: tag,
			comebackBoostApplies: comebackRemaining > 0,
			easyModeTier: easyTier,
		};
	}

	const effD = effectiveDifficultyForEasyMode(q.difficulty, easyTier);
	const pen = resolvePenaltyForQuest({ ...q, difficulty: effD });
	const pHow = String(pen.howTo || "").trim();
	return {
		id: q._id,
		goalId: q.goalId,
		title: pen.title,
		xp: projectedXp,
		isCompleted: false,
		statType: q.statType,
		type: q.type,
		difficulty: mapQuestDifficulty(effD),
		expiresAt: null,
		executionPreview: executionPreviewFromHowTo(pHow),
		isPenaltyActive: true,
		originalTitle: q.title,
		questTag: tag,
		comebackBoostApplies: comebackRemaining > 0,
		easyModeTier: easyTier,
	};
}
