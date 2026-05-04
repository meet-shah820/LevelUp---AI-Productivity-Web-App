import Quest from "../models/Quest.js";
import {
	startOfDay,
	endOfDay,
	rollingWeeklyStart,
	rollingWeeklyEnd,
	rollingMonthlyStart,
	rollingMonthlyEnd,
} from "../utils/timeframePeriod.js";

function normalizeKey(name) {
	return String(name || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

/**
 * Workouts from snapshot daily_quests whose session title matches the quest title (fuzzy).
 * @param {Record<string, unknown>|null} snap
 * @param {string} questTitle
 */
function workoutsForQuestTitleFromSnapshot(snap, questTitle) {
	const qt = String(questTitle || "").toLowerCase().trim();
	if (!qt || !snap || typeof snap !== "object") return [];
	const out = [];
	const daily = snap.daily_quests;
	if (Array.isArray(daily)) {
		for (const day of daily) {
			if (!day || typeof day !== "object") continue;
			const dt = String(day.title || "").toLowerCase();
			if (!dt) continue;
			const head = Math.min(28, dt.length);
			const qh = Math.min(28, qt.length);
			if (
				qt.includes(dt.slice(0, head)) ||
				dt.includes(qt.slice(0, qh)) ||
				dt.slice(0, 12) === qt.slice(0, 12)
			) {
				const wo = day.workout;
				if (Array.isArray(wo)) out.push(...wo);
			}
		}
	}
	return out;
}

/**
 * Match "Day 3 …" / "day 3" in the quest title to snapshot `day` or list index.
 */
function workoutsForDayNumberFromSnapshot(snap, questTitle) {
	const m = String(questTitle || "").match(/\b[Dd]ay\s+(\d{1,2})\b/);
	if (!m) return [];
	const n = parseInt(m[1], 10);
	if (!Number.isFinite(n) || n < 1) return [];
	const daily = snap && typeof snap === "object" ? snap.daily_quests : null;
	if (!Array.isArray(daily)) return [];
	const byField = daily.find((d) => d && typeof d === "object" && Number(d.day) === n);
	const row = byField || daily[n - 1];
	if (!row || typeof row !== "object") return [];
	const wo = row.workout;
	return Array.isArray(wo) ? [...wo] : [];
}

/**
 * Filter full movement rows to those relevant to quests active in the current day / rolling week / rolling month windows.
 * Also matches movement names appearing in quest briefing text.
 *
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {import("mongoose").Types.ObjectId} goalId
 * @param {Record<string, unknown>|null} fitnessPlanSnapshot
 * @param {Array<Record<string, unknown>>} fullMovementRows — already enriched movement objects
 */
export async function computeCurrentRotationMovementRows(userId, goalId, fitnessPlanSnapshot, fullMovementRows) {
	const now = new Date();
	const snap = fitnessPlanSnapshot && typeof fitnessPlanSnapshot === "object" ? fitnessPlanSnapshot : null;

	const dailyQuests = await Quest.find({
		userId,
		goalId,
		type: "daily",
		date: { $gte: startOfDay(now), $lte: endOfDay(now) },
	})
		.select("title briefing")
		.lean();

	const allWeekly = await Quest.find({ userId, goalId, type: "weekly" }).select("title date briefing").lean();
	const weeklyQuests = allWeekly.filter((q) => {
		const anchor = q.date || now;
		return now >= rollingWeeklyStart(anchor) && now <= rollingWeeklyEnd(anchor);
	});

	const allMonthly = await Quest.find({ userId, goalId, type: "monthly" }).select("title date briefing").lean();
	const monthlyQuests = allMonthly.filter((q) => {
		const anchor = q.date || now;
		return now >= rollingMonthlyStart(anchor) && now <= rollingMonthlyEnd(anchor);
	});

	const active = [...dailyQuests, ...weeklyQuests, ...monthlyQuests];
	const nameKeys = new Set();

	for (const q of active) {
		let ws = workoutsForQuestTitleFromSnapshot(snap, q.title);
		if (!ws.length && snap) ws = workoutsForDayNumberFromSnapshot(snap, q.title);
		for (const w of ws) {
			const n = normalizeKey(typeof w?.name === "string" ? w.name : "");
			if (n) nameKeys.add(n);
		}
		const how = String(q.briefing?.howTo || "").toLowerCase();
		for (const row of fullMovementRows) {
			const rn = String(row.name || "").toLowerCase();
			if (rn && how.includes(rn)) nameKeys.add(normalizeKey(row.name));
			const firstTok = rn.split(/\s+/)[0];
			if (firstTok && firstTok.length > 3 && how.includes(firstTok)) nameKeys.add(normalizeKey(row.name));
		}
	}

	let filtered = fullMovementRows.filter((r) => nameKeys.has(normalizeKey(r.name)));

	if (filtered.length === 0 && active.length > 0 && fullMovementRows.length > 0) {
		const blob = active
			.map((q) => `${q.title} ${String(q.briefing?.howTo || "")}`)
			.join("\n")
			.toLowerCase();
		filtered = fullMovementRows.filter((r) => {
			const n = String(r.name || "").toLowerCase();
			return n && blob.includes(n);
		});
	}

	return filtered;
}
