import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import History from "../models/History.js";
import { buildStoredPenaltyForQuest } from "../utils/questPenalty.js";
import { startOfDay, endOfDay } from "../utils/timeframePeriod.js";
import { BRIEFING_SCHEMA_VERSION } from "../constants/questBriefing.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";

const COMEBACK_ABSENCE_MS = 7 * 24 * 60 * 60 * 1000;
const UNDERDOG_MS = 2 * 24 * 60 * 60 * 1000;

function standardQuestClause() {
	return { $or: [{ questTag: { $exists: false } }, { questTag: "standard" }] };
}

/**
 * Call on session resolution (`getUserForReq`). If the previous open was more than a week ago,
 * grant comeback 2× XP charges, welcome bonus quest, and leaderboard underdog window.
 */
export async function refreshUserEngagement(user) {
	if (!user) return;
	const now = new Date();
	const prev = user.lastAppOpenAt;
	if (prev instanceof Date && !Number.isNaN(prev.getTime())) {
		if (now.getTime() - prev.getTime() >= COMEBACK_ABSENCE_MS) {
			user.comebackBonusQuestsRemaining = 3;
			user.leaderboardUnderdogUntil = new Date(now.getTime() + UNDERDOG_MS);
			await ensureWelcomeBonusQuest(user);
		}
	}
	user.lastAppOpenAt = now;
	await user.save();
}

function addLocalDays(d, deltaDays) {
	const x = new Date(d);
	x.setDate(x.getDate() + deltaDays);
	return x;
}

/**
 * True if each of the last `days` local calendar days (ending yesterday) had at least one standard
 * daily quest assigned and zero completions for that day.
 */
export async function hadConsecutiveFullMissDaily(userId, days = 3) {
	const todayStart = startOfDay(new Date());
	for (let i = 1; i <= days; i++) {
		const day = addLocalDays(todayStart, -i);
		const from = startOfDay(day);
		const to = endOfDay(day);
		const list = await Quest.find({
			userId,
			type: "daily",
			...standardQuestClause(),
			date: { $gte: from, $lte: to },
		})
			.select("isCompleted")
			.lean();
		if (list.length === 0) return false;
		if (list.some((q) => q.isCompleted)) return false;
	}
	return true;
}

async function todayHasQualifyingActivity(userId) {
	const start = startOfDay(new Date());
	const end = endOfDay(new Date());
	const n = await History.countDocuments({
		userId,
		occurredAt: { $gte: start, $lte: end },
		type: { $in: ["quest_complete", "focus_session"] },
		xpChange: { $gt: 0 },
	});
	return n > 0;
}

function recoveryBriefing(xpReward) {
	return {
		summary:
			"You went quiet for a few days. This is a single reset quest: small, concrete, and enough to put momentum back on the board.",
		whatYouImprove: `Recovery momentum and Vitality (+${xpReward} XP). Completing this clears the slump signal without punishing you.`,
		doneWhen: "You finish the three steps below in one sitting and tap Complete.",
		requirements: "",
		howTo:
			"One block, 25–40 minutes, same chair. No new goals—only re-entry: body, plan, one visible win.",
		steps: [
			"Minutes 0–8: hydration + 5-minute walk or light movement, then write one sentence on what pulled you away (no judgment).",
			"Minutes 8–18: pick exactly one task for today (≤25 minutes) and schedule it as a calendar block or timer.",
			"Minutes 18–25: do the first 5 minutes of that task now, then stop and note the next step for later.",
		],
		tips: "If this feels small, that is the point—consistency beats intensity after a gap.",
		source: "fallback",
	};
}

function welcomeBonusBriefing(goalTitle, xpReward) {
	const g = String(goalTitle || "your goal").trim() || "your goal";
	return {
		summary: `Welcome back. One bonus path tied to «${g}» — small, winnable, and worth showing up for.`,
		whatYouImprove: `Momentum for ${g} and +${xpReward} XP when you finish.`,
		doneWhen: "You complete the three steps and tap Complete.",
		requirements: "",
		howTo: `One 20–35 minute block for ${g}. No scope creep.`,
		steps: [
			`Minutes 0–5: open anything related to ${g} and write one sentence: what is the next smallest move?`,
			`Minutes 5–20: execute only that move — one email, one page, one set, one sketch — tied to ${g}.`,
			"Minutes 20–25: write the next step as a single line for tomorrow (max 15 words).",
		],
		tips: "This quest exists because you returned. Treat it as credit, not a debt.",
		source: "fallback",
	};
}

function streakSaverBriefing(goalTitle, xpReward) {
	const g = String(goalTitle || "your goal").trim() || "your goal";
	return {
		summary: `Keep the streak alive with one tiny win for ${g}.`,
		whatYouImprove: `Streak protection + ${g} (+${xpReward} XP).`,
		doneWhen: "Finish the micro-steps below today and tap Complete.",
		requirements: "",
		howTo: `Five to fifteen minutes total, ${g} only.`,
		steps: [
			`Minute 0–2: one line — why ${g} still matters today.`,
			`Minutes 2–10: one concrete micro-action for ${g} (timer on).`,
			"Minute 10–12: check off one visible artifact (saved file, sent message, photo of progress).",
		],
		tips: "Completing this counts like any quest for your activity streak.",
		source: "fallback",
	};
}

/**
 * Inserts at most one incomplete recovery quest. Skips if no active goal or a recovery is already open.
 */
export async function ensureRecoveryQuest(user) {
	const userId = user._id;
	const openRecovery = await Quest.findOne({ userId, questTag: "recovery", isCompleted: false }).lean();
	if (openRecovery) return;

	const miss = await hadConsecutiveFullMissDaily(userId, 3);
	if (!miss) return;

	const goal = await Goal.findOne({ userId, status: "active" }).sort({ createdAt: 1 }).lean();
	if (!goal) return;

	const now = new Date();
	const date = startOfDay(now);
	date.setHours(12, 0, 0, 0);

	const xpReward = 280;
	const statType = "vit";
	const p = buildStoredPenaltyForQuest({ type: "daily", difficulty: "medium", statType });
	const briefing = recoveryBriefing(xpReward);

	await Quest.create({
		userId,
		goalId: goal._id,
		title: "Recovery Quest — Stepping Back In",
		xpReward,
		statType,
		difficulty: "medium",
		isCompleted: false,
		type: "daily",
		date,
		expiresAt: null,
		isExpired: false,
		questTag: "recovery",
		penalty: {
			title: p.title,
			summary: p.summary,
			howTo: p.howTo,
			doneWhen: p.doneWhen,
			steps: p.steps,
			whatYouImprove: p.whatYouImprove,
		},
		briefing,
		briefingGeneratedAt: new Date(),
		briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
	});
}

/**
 * One welcome-back bonus quest after a long absence (spawned from `refreshUserEngagement`).
 */
export async function ensureWelcomeBonusQuest(user) {
	const userId = user._id;
	const open = await Quest.findOne({ userId, questTag: "welcome_bonus", isCompleted: false }).lean();
	if (open) return;

	const goal = await Goal.findOne({ userId, status: "active" }).sort({ createdAt: 1 }).lean();
	if (!goal) return;

	const now = new Date();
	const date = startOfDay(now);
	date.setHours(12, 0, 0, 0);

	const xpReward = 420;
	const statType = "int";
	const briefing = welcomeBonusBriefing(goal.title, xpReward);
	const p = buildStoredPenaltyForQuest({ type: "daily", difficulty: "easy", statType });

	await Quest.create({
		userId,
		goalId: goal._id,
		title: "Welcome Back — Bonus Path",
		xpReward,
		statType,
		difficulty: "easy",
		isCompleted: false,
		type: "daily",
		date,
		expiresAt: null,
		isExpired: false,
		questTag: "welcome_bonus",
		penalty: {
			title: p.title,
			summary: p.summary,
			howTo: p.howTo,
			doneWhen: p.doneWhen,
			steps: p.steps,
			whatYouImprove: p.whatYouImprove,
		},
		briefing,
		briefingGeneratedAt: new Date(),
		briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
	});
}

/**
 * One simple daily when the user has an activity streak but no qualifying progress yet today.
 */
export async function ensureStreakSaverQuest(user) {
	const userId = user._id;
	const streak = await computeActivityStreakDays(userId);
	if (streak < 1) return;

	const activeToday = await todayHasQualifyingActivity(userId);
	if (activeToday) return;

	const start = startOfDay(new Date());
	const end = endOfDay(new Date());
	const openToday = await Quest.findOne({
		userId,
		questTag: "streak_saver",
		isCompleted: false,
		date: { $gte: start, $lte: end },
	}).lean();
	if (openToday) return;

	const goal = await Goal.findOne({ userId, status: "active" }).sort({ createdAt: 1 }).lean();
	if (!goal) return;

	const date = startOfDay(new Date());
	date.setHours(12, 0, 0, 0);

	const xpReward = 110;
	const statType = "agi";
	const briefing = streakSaverBriefing(goal.title, xpReward);
	const p = buildStoredPenaltyForQuest({ type: "daily", difficulty: "easy", statType });

	await Quest.create({
		userId,
		goalId: goal._id,
		title: "Streak Saver — One Small Win",
		xpReward,
		statType,
		difficulty: "easy",
		isCompleted: false,
		type: "daily",
		date,
		expiresAt: null,
		isExpired: false,
		questTag: "streak_saver",
		penalty: {
			title: p.title,
			summary: p.summary,
			howTo: p.howTo,
			doneWhen: p.doneWhen,
			steps: p.steps,
			whatYouImprove: p.whatYouImprove,
		},
		briefing,
		briefingGeneratedAt: new Date(),
		briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
	});
}

export function buildEngagementPublic(user) {
	const now = Date.now();
	const until = user.leaderboardUnderdogUntil;
	const untilMs = until instanceof Date && !Number.isNaN(until.getTime()) ? until.getTime() : 0;
	const leaderboardUnderdogActive = untilMs > now;
	const cr = Math.max(0, Number(user.comebackBonusQuestsRemaining || 0));
	const ez = Math.max(0, Math.min(4, Number(user.easyModeTier || 0)));
	return {
		comebackBonusQuestsRemaining: cr,
		comebackBoostActive: cr > 0,
		leaderboardUnderdogActive,
		leaderboardUnderdogEndsAt: leaderboardUnderdogActive && until instanceof Date ? until.toISOString() : null,
		easyModeTier: ez,
		easyModeActive: ez > 0,
	};
}
