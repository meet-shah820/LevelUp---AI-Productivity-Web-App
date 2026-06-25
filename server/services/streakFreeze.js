import History from "../models/History.js";
import Quest from "../models/Quest.js";
import { getQualifyingActivityDayKeys, getFrozenDayKeys, utcDayKey } from "../utils/activityStreak.js";
import {
	getUserFreezeEarnProfile,
	freezeEarnProfileLabel,
	rollAchievementStreakFreezeAward,
} from "./streakFreezeRewards.js";

function effectiveDay(activityDays, frozenDays, dayKey) {
	return activityDays.has(dayKey) || frozenDays.has(dayKey);
}

function listGapDaysBetween(lastActiveKey, endDayKey, activityDays, frozenDays) {
	const gaps = [];
	const d = new Date(`${lastActiveKey}T12:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	const end = new Date(`${endDayKey}T12:00:00.000Z`);
	while (d <= end) {
		const k = utcDayKey(d);
		if (!activityDays.has(k) && !frozenDays.has(k)) gaps.push(k);
		d.setUTCDate(d.getUTCDate() + 1);
	}
	return gaps;
}

function findLastActivityDayKey(activityDays, beforeDayKey) {
	const d = new Date(`${beforeDayKey}T12:00:00.000Z`);
	for (let i = 0; i < 400; i++) {
		d.setUTCDate(d.getUTCDate() - 1);
		const k = utcDayKey(d);
		if (activityDays.has(k)) return k;
	}
	return null;
}

function listUnfilledGapsBackward(activityDays, frozenDays, endDayKey) {
	const gaps = [];
	const d = new Date(`${endDayKey}T12:00:00.000Z`);
	for (let i = 0; i < 400; i++) {
		const k = utcDayKey(d);
		if (activityDays.has(k)) break;
		if (!frozenDays.has(k)) gaps.push(k);
		d.setUTCDate(d.getUTCDate() - 1);
	}
	return gaps;
}

async function recordFreezeUsed(userId, dayKey) {
	await History.create({
		userId,
		type: "streak_freeze_used",
		xpChange: 0,
		meta: { dayKey, auto: true },
		occurredAt: new Date(`${dayKey}T12:00:00.000Z`),
	});
}

async function recordFreezeEarned(userId, meta) {
	await History.create({
		userId,
		type: "streak_freeze_earned",
		xpChange: 0,
		meta,
	});
}

export async function grantStreakFreezes(user, count, meta) {
	if (!user || count <= 0) return 0;
	const current = Math.max(0, Number(user.streakFreezesAvailable || 0));
	const grant = Math.max(0, Math.floor(count));
	if (grant <= 0) return 0;

	user.streakFreezesAvailable = current + grant;
	await user.save();
	await recordFreezeEarned(user._id, { ...meta, amount: grant });
	return grant;
}

/**
 * Award a streak freeze when a quest flagged with `awardsStreakFreeze` is completed.
 */
export async function maybeAwardQuestCompletionFreeze(user, quest) {
	if (!quest?.awardsStreakFreeze) return 0;

	const already = await History.findOne({
		userId: user._id,
		type: "streak_freeze_earned",
		"meta.source": "quest",
		"meta.questId": quest._id,
	}).lean();
	if (already) return 0;

	return grantStreakFreezes(user, 1, {
		source: "quest",
		questId: quest._id,
		questType: quest.type,
		difficulty: quest.difficulty,
		title: quest.title,
	});
}

/**
 * Dynamic achievement freeze — rolled per user profile and rarity (once per achievement).
 */
export async function maybeAwardAchievementFreeze(user, achievementId, rarity = "common") {
	if (!rollAchievementStreakFreezeAward(user._id, achievementId, rarity)) return 0;

	const already = await History.findOne({
		userId: user._id,
		type: "streak_freeze_earned",
		"meta.source": "achievement",
		"meta.achievementId": achievementId,
	}).lean();
	if (already) return 0;

	return grantStreakFreezes(user, 1, {
		source: "achievement",
		achievementId,
		rarity,
		profile: getUserFreezeEarnProfile(user._id),
	});
}

export async function reconcileStreakFreezes(user) {
	if (!user?._id) return { applied: [] };

	const userId = user._id;
	const activityDays = await getQualifyingActivityDayKeys(userId);
	if (activityDays.size === 0) return { applied: [] };

	let frozenDays = await getFrozenDayKeys(userId);
	const available = () => Math.max(0, Number(user.streakFreezesAvailable || 0));

	const now = new Date();
	now.setUTCHours(0, 0, 0, 0);
	const todayK = utcDayKey(now);
	const yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	const yesterdayK = utcDayKey(yesterday);

	const applied = [];

	const applyGaps = async (gapsOldestFirst) => {
		for (const dayKey of gapsOldestFirst) {
			if (available() <= 0) break;
			if (frozenDays.has(dayKey) || activityDays.has(dayKey)) continue;
			await recordFreezeUsed(userId, dayKey);
			user.streakFreezesAvailable = available() - 1;
			frozenDays = new Set([...frozenDays, dayKey]);
			applied.push(dayKey);
		}
		if (applied.length) await user.save();
	};

	let endK = null;
	if (effectiveDay(activityDays, frozenDays, todayK)) endK = todayK;
	else if (effectiveDay(activityDays, frozenDays, yesterdayK)) endK = yesterdayK;

	if (endK) {
		const gapsRecentFirst = listUnfilledGapsBackward(activityDays, frozenDays, endK);
		await applyGaps(gapsRecentFirst.reverse());
		return { applied };
	}

	const lastActive = findLastActivityDayKey(activityDays, todayK);
	if (!lastActive) return { applied: [] };

	const salvageGaps = listGapDaysBetween(lastActive, yesterdayK, activityDays, frozenDays);
	if (salvageGaps.length === 0) return { applied: [] };
	if (salvageGaps.length > available()) return { applied: [] };

	await applyGaps(salvageGaps);
	return { applied };
}

export async function buildStreakFreezePublic(user) {
	const available = Math.max(0, Number(user?.streakFreezesAvailable || 0));
	const profile = user?._id ? getUserFreezeEarnProfile(user._id) : "cadence";

	const upcoming = user?._id
		? await Quest.find({
				userId: user._id,
				isCompleted: false,
				awardsStreakFreeze: true,
			})
				.sort({ date: 1 })
				.limit(6)
				.select("title type difficulty")
				.lean()
		: [];

	return {
		available,
		earnProfile: profile,
		earnProfileLabel: freezeEarnProfileLabel(profile),
		upcomingQuestRewards: upcoming.map((q) => ({
			id: String(q._id),
			title: q.title,
			type: q.type,
			difficulty: q.difficulty,
		})),
	};
}

/** @internal Exported for unit tests. */
export const __streakFreezeTest = {
	effectiveDay,
	listGapDaysBetween,
	listUnfilledGapsBackward,
	findLastActivityDayKey,
};
