import Quest from "../models/Quest.js";
import { OPEN_QUEST_FREEZE_FLAG_CAPS } from "../constants/streakFreeze.js";

/** @typedef {'hard_grind' | 'cadence' | 'milestone'} FreezeEarnProfile */

const PROFILE_LABELS = {
	hard_grind: "Hard quests",
	cadence: "Weekly & monthly quests",
	milestone: "Achievements & big quests",
};

/**
 * Deterministic 0–1 float from user + salient inputs (stable across deploys).
 */
export function seededFloat(userId, ...parts) {
	const s = [String(userId), ...parts.map((p) => String(p ?? ""))].join("|");
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967296;
}

/**
 * Each user leans toward a different earn style (deterministic from account id).
 * @returns {FreezeEarnProfile}
 */
export function getUserFreezeEarnProfile(userId) {
	const bucket = Math.floor(seededFloat(userId, "freeze-profile") * 3);
	if (bucket === 0) return "hard_grind";
	if (bucket === 1) return "cadence";
	return "milestone";
}

function freezeChanceForQuest(profile, quest) {
	const type = quest.type === "weekly" || quest.type === "monthly" ? quest.type : "daily";
	const diff = ["easy", "medium", "hard"].includes(quest.difficulty) ? quest.difficulty : "medium";

	const table = {
		hard_grind: {
			daily: { easy: 0.06, medium: 0.14, hard: 0.44 },
			weekly: { easy: 0.18, medium: 0.32, hard: 0.58 },
			monthly: { easy: 0.28, medium: 0.42, hard: 0.68 },
		},
		cadence: {
			daily: { easy: 0.07, medium: 0.09, hard: 0.12 },
			weekly: { easy: 0.34, medium: 0.46, hard: 0.54 },
			monthly: { easy: 0.56, medium: 0.66, hard: 0.74 },
		},
		milestone: {
			daily: { easy: 0.11, medium: 0.15, hard: 0.19 },
			weekly: { easy: 0.22, medium: 0.28, hard: 0.34 },
			monthly: { easy: 0.52, medium: 0.6, hard: 0.66 },
		},
	};

	return table[profile]?.[type]?.[diff] ?? 0.1;
}

function questRollKey(quest) {
	const dateKey =
		quest.date instanceof Date
			? quest.date.toISOString().slice(0, 10)
			: quest.date
				? String(quest.date).slice(0, 10)
				: "";
	return [quest.type || "daily", quest.difficulty || "medium", dateKey, quest.title || "", quest.goalId || ""];
}

/**
 * Roll whether a single quest should award a streak freeze on completion.
 */
export function rollQuestStreakFreezeAward(userId, quest) {
	const profile = getUserFreezeEarnProfile(userId);
	const chance = freezeChanceForQuest(profile, quest);
	const roll = seededFloat(userId, "quest-freeze", ...questRollKey(quest));
	return roll < chance;
}

function sortQuestsForFreezePriority(userId, quests) {
	return [...quests].sort((a, b) => {
		const score = (q) => {
			const type = q.type === "monthly" ? 3 : q.type === "weekly" ? 2 : 1;
			const diff = q.difficulty === "hard" ? 3 : q.difficulty === "medium" ? 2 : 1;
			const tie = seededFloat(userId, "freeze-priority", q._id || q.title, q.date);
			return type * 10 + diff + tie;
		};
		return score(b) - score(a);
	});
}

/**
 * Cap flagged quests so only a few open quests advertise a freeze at once.
 */
export function enforceStreakFreezeFlagsOnRows(userId, questRows) {
	const byType = { daily: [], weekly: [], monthly: [] };
	for (const q of questRows) {
		const t = q.type === "weekly" || q.type === "monthly" ? q.type : "daily";
		if (q.awardsStreakFreeze) byType[t].push(q);
	}
	for (const type of ["daily", "weekly", "monthly"]) {
		const cap = OPEN_QUEST_FREEZE_FLAG_CAPS[type];
		const flagged = byType[type];
		if (flagged.length <= cap) continue;
		const keep = new Set(sortQuestsForFreezePriority(userId, flagged).slice(0, cap));
		for (const q of flagged) {
			if (!keep.has(q)) q.awardsStreakFreeze = false;
		}
	}
}

/**
 * Assign dynamic streak-freeze flags on quest rows before insert.
 */
export function applyDynamicStreakFreezeFlags(questRows, userId) {
	for (const q of questRows) {
		q.streakFreezeRollDone = true;
		q.awardsStreakFreeze = rollQuestStreakFreezeAward(userId, q);
	}
	enforceStreakFreezeFlagsOnRows(userId, questRows);
}

/**
 * Roll + persist flags for legacy/open quests that pre-date dynamic assignment.
 */
export async function ensureOpenQuestStreakFreezeAssignments(userId) {
	const open = await Quest.find({
		userId,
		isCompleted: false,
		streakFreezeRollDone: { $ne: true },
	}).sort({ date: 1 });

	if (!open.length) {
		await enforceStreakFreezeCapsForUser(userId);
		return;
	}

	for (const doc of open) {
		doc.streakFreezeRollDone = true;
		doc.awardsStreakFreeze = rollQuestStreakFreezeAward(userId, doc);
		await doc.save();
	}

	await enforceStreakFreezeCapsForUser(userId);
}

export async function enforceStreakFreezeCapsForUser(userId) {
	const open = await Quest.find({
		userId,
		isCompleted: false,
		awardsStreakFreeze: true,
	}).sort({ date: 1 });

	if (!open.length) return;

	const plain = open.map((d) => d.toObject());
	enforceStreakFreezeFlagsOnRows(userId, plain);

	for (const doc of open) {
		const next = plain.find((p) => String(p._id) === String(doc._id));
		if (!next) continue;
		if (doc.awardsStreakFreeze !== next.awardsStreakFreeze) {
			doc.awardsStreakFreeze = next.awardsStreakFreeze;
			await doc.save();
		}
	}
}

const ACHIEVEMENT_FREEZE_CHANCE = {
	hard_grind: { common: 0, rare: 0.06, epic: 0.16, legendary: 0.32, mythic: 0.48 },
	cadence: { common: 0.04, rare: 0.12, epic: 0.24, legendary: 0.38, mythic: 0.52 },
	milestone: { common: 0.1, rare: 0.26, epic: 0.44, legendary: 0.62, mythic: 0.78 },
};

/**
 * Dynamic achievement freeze — chance varies by user profile and achievement rarity.
 */
export function rollAchievementStreakFreezeAward(userId, achievementId, rarity = "common") {
	const profile = getUserFreezeEarnProfile(userId);
	const chance = ACHIEVEMENT_FREEZE_CHANCE[profile]?.[rarity] ?? 0.08;
	const roll = seededFloat(userId, "ach-freeze", achievementId);
	return roll < chance;
}

export function freezeEarnProfileLabel(profile) {
	return PROFILE_LABELS[profile] || "Quests & achievements";
}
