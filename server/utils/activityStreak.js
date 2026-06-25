import History from "../models/History.js";

export function utcDayKey(d) {
	return d.toISOString().slice(0, 10);
}

const QUALIFYING_HISTORY_TYPES = ["quest_complete", "first_goal_bonus", "focus_session"];

/**
 * UTC calendar days with qualifying activity (quest complete with XP, or focus session with XP).
 */
export async function getQualifyingActivityDayKeys(userId) {
	const now = new Date();
	now.setUTCHours(0, 0, 0, 0);

	const floor = new Date(now);
	floor.setUTCDate(floor.getUTCDate() - 400);

	const rows = await History.find({
		userId,
		type: { $in: QUALIFYING_HISTORY_TYPES },
		occurredAt: { $gte: floor },
		xpChange: { $gt: 0 },
	})
		.sort({ occurredAt: -1 })
		.select("occurredAt xpChange")
		.limit(2500)
		.lean();

	const activeDays = new Set();
	for (const h of rows) {
		const t = h.occurredAt ? new Date(h.occurredAt) : null;
		if (!t || Number.isNaN(t.getTime())) continue;
		activeDays.add(utcDayKey(t));
	}
	return activeDays;
}

/** UTC day keys where a streak freeze was consumed. */
export async function getFrozenDayKeys(userId) {
	const floor = new Date();
	floor.setUTCHours(0, 0, 0, 0);
	floor.setUTCDate(floor.getUTCDate() - 400);

	const rows = await History.find({
		userId,
		type: "streak_freeze_used",
		occurredAt: { $gte: floor },
	})
		.select("meta occurredAt")
		.lean();

	const frozenDays = new Set();
	for (const r of rows) {
		const k = r.meta?.dayKey || (r.occurredAt ? utcDayKey(new Date(r.occurredAt)) : null);
		if (k) frozenDays.add(k);
	}
	return frozenDays;
}

/**
 * Consecutive UTC calendar days with qualifying activity or an applied streak freeze.
 * Streak is broken if neither today nor yesterday had activity/freeze (same-day grace if today is still open).
 */
export async function computeActivityStreakDays(userId) {
	const activeDays = await getQualifyingActivityDayKeys(userId);
	const frozenDays = await getFrozenDayKeys(userId);
	const effectiveDays = new Set([...activeDays, ...frozenDays]);

	if (effectiveDays.size === 0) return 0;

	const now = new Date();
	now.setUTCHours(0, 0, 0, 0);

	const todayK = utcDayKey(now);
	const y = new Date(now);
	y.setUTCDate(y.getUTCDate() - 1);
	const yesterdayK = utcDayKey(y);

	let startK;
	if (effectiveDays.has(todayK)) startK = todayK;
	else if (effectiveDays.has(yesterdayK)) startK = yesterdayK;
	else return 0;

	let streak = 0;
	const d = new Date(`${startK}T12:00:00.000Z`);
	while (effectiveDays.has(utcDayKey(d))) {
		streak++;
		d.setUTCDate(d.getUTCDate() - 1);
	}
	return streak;
}
