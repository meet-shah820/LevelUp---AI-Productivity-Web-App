/**
 * Lightweight streak-freeze logic checks (no database).
 * Run: node server/scripts/testStreakFreeze.js
 */
import { utcDayKey } from "../utils/activityStreak.js";
import { __streakFreezeTest } from "../services/streakFreeze.js";
import {
	rollQuestStreakFreezeAward,
	getUserFreezeEarnProfile,
	rollAchievementStreakFreezeAward,
	seededFloat,
} from "../services/streakFreezeRewards.js";

const { listGapDaysBetween, listUnfilledGapsBackward } = __streakFreezeTest;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function daySet(keys) {
	return new Set(keys);
}

const userId = "507f1f77bcf86cd799439011";

// Profile is stable per user
{
	const p1 = getUserFreezeEarnProfile(userId);
	const p2 = getUserFreezeEarnProfile(userId);
	assert(p1 === p2 && ["hard_grind", "cadence", "milestone"].includes(p1), "stable earn profile");
}

// Quest roll is stable for same quest inputs
{
	const quest = { type: "weekly", difficulty: "hard", date: new Date("2026-06-10"), title: "Leg day", goalId: "g1" };
	const a = rollQuestStreakFreezeAward(userId, quest);
	const b = rollQuestStreakFreezeAward(userId, quest);
	assert(a === b, "stable quest freeze roll");
}

// Gap listing
{
	const activity = daySet(["2026-06-01"]);
	const frozen = daySet([]);
	const gaps = listGapDaysBetween("2026-06-01", "2026-06-03", activity, frozen);
	assert(gaps.length === 2 && gaps[0] === "2026-06-02" && gaps[1] === "2026-06-03", "gap days oldest-first");
}

// Streak computation with effective days (pure simulation)
{
	const effectiveDays = daySet(["2026-06-01", "2026-06-02", "2026-06-03"]);
	const now = new Date("2026-06-04T15:00:00.000Z");
	now.setUTCHours(0, 0, 0, 0);
	const yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	const yesterdayK = utcDayKey(yesterday);

	let startK;
	if (effectiveDays.has(utcDayKey(now))) startK = utcDayKey(now);
	else if (effectiveDays.has(yesterdayK)) startK = yesterdayK;
	else startK = null;
	assert(startK === yesterdayK, "grace via yesterday freeze/activity");

	let streak = 0;
	const d = new Date(`${startK}T12:00:00.000Z`);
	while (effectiveDays.has(utcDayKey(d))) {
		streak++;
		d.setUTCDate(d.getUTCDate() - 1);
	}
	assert(streak === 3, "streak counts frozen chain");
}

// Achievement rolls differ by profile/rarity (smoke)
{
	const profile = getUserFreezeEarnProfile(userId);
	const epic = rollAchievementStreakFreezeAward(userId, "streak_14", "epic");
	assert(typeof epic === "boolean", "achievement roll returns boolean");
	assert(typeof seededFloat(userId, "x") === "number", "seeded float");
	void profile;
}

console.log("✅ streak freeze logic tests passed");
