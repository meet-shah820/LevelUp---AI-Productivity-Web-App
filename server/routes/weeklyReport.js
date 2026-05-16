import express from "express";
import History from "../models/History.js";
import { getUserForReq } from "../utils/demoUser.js";
import { getPreviousWeekBounds, ymd } from "../utils/weeklyReportWeek.js";
import { generateWeeklyReportAi, heuristicProductivityScore } from "../services/weeklyReportAi.js";

const router = express.Router();

const XP_PER_FOCUS_MINUTE = 9;

const ACTIVITY_TYPES = new Set([
	"quest_complete",
	"focus_session",
	"timeframe_bonus",
	"penalty_missed_day",
	"penalty_timeframe_miss",
]);

/** Net distinct quests completed in window (positive net xpChange per questId). */
async function netQuestsCompletedInRange(userId, rangeStart, rangeEnd) {
	const rows = await History.aggregate([
		{
			$match: {
				userId,
				type: "quest_complete",
				questId: { $ne: null },
				occurredAt: { $gte: rangeStart, $lte: rangeEnd },
			},
		},
		{
			$group: {
				_id: "$questId",
				net: { $sum: "$xpChange" },
			},
		},
		{ $match: { net: { $gt: 0 } } },
		{ $count: "count" },
	]);
	return rows?.[0]?.count ?? 0;
}

// GET /api/weekly-report — recap for the last completed Mon–Sun; show until dismissed for that week id
router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const { reportWeekId, weekStart, weekEnd, weekLabel, days } = getPreviousWeekBounds();

		const ack = String(user.weeklyReportAckWeekId || "").trim();
		if (ack === reportWeekId) {
			return res.json({ showModal: false, reportWeekId });
		}

		// Accounts created after the report week began never saw that full Monday–Sunday;
		// skip the recap (and ack this id so we don't rebuild every visit).
		const createdAt = user.createdAt ? new Date(user.createdAt) : null;
		if (createdAt && createdAt > weekStart) {
			user.weeklyReportAckWeekId = reportWeekId;
			await user.save();
			return res.json({ showModal: false, reportWeekId });
		}

		const hist = await History.find({
			userId: user._id,
			occurredAt: { $gte: weekStart, $lte: weekEnd },
			type: { $in: [...ACTIVITY_TYPES] },
		})
			.select("type xpChange occurredAt")
			.lean();

		const xpByDay = new Map();
		const focusXpByDay = new Map();
		const posQuestEventsByDay = new Map();
		const negQuestEventsByDay = new Map();

		for (const d of days) {
			xpByDay.set(d.date, 0);
			focusXpByDay.set(d.date, 0);
			posQuestEventsByDay.set(d.date, 0);
			negQuestEventsByDay.set(d.date, 0);
		}

		for (const h of hist) {
			const key = ymd(new Date(h.occurredAt));
			if (!xpByDay.has(key)) continue;
			const add = h.xpChange || 0;
			if (ACTIVITY_TYPES.has(h.type)) {
				xpByDay.set(key, (xpByDay.get(key) || 0) + add);
			}
			if (h.type === "focus_session") {
				focusXpByDay.set(key, (focusXpByDay.get(key) || 0) + add);
			}
			if (h.type === "quest_complete") {
				if (add > 0) posQuestEventsByDay.set(key, (posQuestEventsByDay.get(key) || 0) + 1);
				if (add < 0) negQuestEventsByDay.set(key, (negQuestEventsByDay.get(key) || 0) + 1);
			}
		}

		const daily = days.map(({ date, weekdayShort }) => {
			const xp = Math.round(xpByDay.get(date) || 0);
			const focusXp = focusXpByDay.get(date) || 0;
			const focusHours = Number((focusXp / (XP_PER_FOCUS_MINUTE * 60)).toFixed(2));
			const approxQuestCredits = Math.max(
				0,
				(posQuestEventsByDay.get(date) || 0) - (negQuestEventsByDay.get(date) || 0)
			);
			return {
				date,
				weekdayShort,
				activityXp: xp,
				focusHours,
				approxQuestEvents: approxQuestCredits,
			};
		});

		const questsCompleted = await netQuestsCompletedInRange(user._id, weekStart, weekEnd);
		const focusHoursTotal = Number(
			(
				daily.reduce((s, x) => s + (Number(x.focusHours) || 0), 0)
			).toFixed(2)
		);
		const activeDays = daily.filter((x) => x.activityXp > 0 || x.focusHours > 0 || x.approxQuestEvents > 0).length;

		const maxXp = Math.max(1, ...daily.map((x) => x.activityXp));
		const consistency = daily.map((x) => Math.min(1, x.activityXp / maxXp));
		const consistency01 = daily.reduce((s, v) => s + v, 0) / 7;

		const sortedByXp = [...daily].sort((a, b) => b.activityXp - a.activityXp);
		const bestDays = sortedByXp.filter((x) => x.activityXp > 0).slice(0, 2);
		const worstCandidates = [...daily].sort((a, b) => a.activityXp - b.activityXp);
		const improveZero = worstCandidates.filter((x) => x.activityXp === 0).slice(0, 3);
		const improveLow = worstCandidates.filter((x) => x.activityXp > 0).slice(0, 1);
		const improveMerged = [];
		const seenImp = new Set();
		for (const x of [...improveZero, ...improveLow]) {
			if (seenImp.has(x.date)) continue;
			seenImp.add(x.date);
			improveMerged.push(x);
			if (improveMerged.length >= 3) break;
		}

		const aiPayload = {
			displayName: String(user.displayName || user.username || "Player").trim(),
			weekLabel,
			days: daily.map((x) => ({
				date: x.date,
				label: x.weekdayShort,
				activityXp: x.activityXp,
				focusHours: x.focusHours,
				approxQuestEvents: x.approxQuestEvents,
			})),
			totals: {
				questsCompleted,
				focusHours: focusHoursTotal,
				activeDays,
			},
			bestDayDates: bestDays.map((x) => x.date),
			improveDayDates: improveMerged.map((x) => x.date),
			consistency01,
		};

		const ai = await generateWeeklyReportAi(aiPayload);

		return res.json({
			showModal: true,
			reportWeekId,
			weekLabel,
			daily,
			totals: {
				questsCompleted,
				focusHours: focusHoursTotal,
				activeDays,
			},
			bestDays: bestDays.map((x) => ({
				date: x.date,
				weekdayShort: x.weekdayShort,
				activityXp: x.activityXp,
			})),
			improveDays: improveMerged.map((x) => ({
				date: x.date,
				weekdayShort: x.weekdayShort,
				activityXp: x.activityXp,
			})),
			consistency,
			ai: {
				productivityScore: ai?.productivityScore ?? heuristicProductivityScore(aiPayload.totals, consistency01),
				headline: ai?.headline ?? "",
				summary: ai?.summary ?? "",
				improvementIdeas: ai?.improvementIdeas ?? [],
				source: ai?.source ?? "heuristic",
			},
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to build weekly report" });
	}
});

// POST /api/weekly-report/ack — body: { reportWeekId: "YYYY-MM-DD" } (Monday of reported week)
router.post("/ack", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const { reportWeekId: expectedId } = getPreviousWeekBounds();
		const bodyId = String(req.body?.reportWeekId || "").trim();
		if (!bodyId || bodyId !== expectedId) {
			return res.status(400).json({ error: "Invalid report week" });
		}
		user.weeklyReportAckWeekId = expectedId;
		await user.save();
		return res.json({ ok: true, reportWeekId: expectedId });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to acknowledge weekly report" });
	}
});

export default router;
