import express from "express";
import mongoose from "mongoose";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import { getUserForReq } from "../utils/demoUser.js";
import {
	generateFullGoalQuestPlan,
	buildBriefingPayloadFromRichQuest,
	estimateGoalHorizonMonths,
} from "../services/gemini.js";
import { BRIEFING_SCHEMA_VERSION } from "../constants/questBriefing.js";
import { buildStoredPenaltyForQuest } from "../utils/questPenalty.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";

const router = express.Router();

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
const LEGACY_DIFF_TO_RARITY = {
	Easy: "common",
	Medium: "rare",
	Hard: "epic",
	Epic: "legendary",
};

function normalizeGoalRarity(g) {
	if (g.rarity && Object.prototype.hasOwnProperty.call(RARITY_ORDER, g.rarity)) return g.rarity;
	if (g.difficulty && LEGACY_DIFF_TO_RARITY[g.difficulty]) return LEGACY_DIFF_TO_RARITY[g.difficulty];
	return "common";
}

function parseOptionalDate(raw) {
	if (raw == null || raw === "") return null;
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Cap total inserted rows so one goal cannot explode the DB. */
function computeSeedWindows(months, dailyTemplateCount, weeklyTemplateCount, monthlyTemplateCount) {
	const m = Math.max(1, Math.min(36, months));
	let daysToSeed = Math.min(45, Math.max(7, Math.round(m * 1.2)));
	let weeksToSeed = Math.min(16, Math.max(4, Math.ceil(m / 1.5)));
	let monthsToSeed =
		monthlyTemplateCount > 0 ? Math.min(8, Math.max(2, Math.ceil(m / 4))) : 0;
	const dc = Math.max(1, dailyTemplateCount);
	const wc = Math.max(1, weeklyTemplateCount);
	const mc = Math.max(1, monthlyTemplateCount);
	while (daysToSeed > 7 && daysToSeed * dc > 120) daysToSeed -= 1;
	while (weeksToSeed > 4 && weeksToSeed * wc > 56) weeksToSeed -= 1;
	while (monthsToSeed > 2 && monthsToSeed * mc > 24) monthsToSeed -= 1;
	return { daysToSeed, weeksToSeed, monthsToSeed };
}

function penaltyDoc(tf, q) {
	const p = buildStoredPenaltyForQuest({
		type: tf,
		difficulty: q.difficulty || "medium",
		statType: q.statType,
	});
	return {
		title: p.title,
		summary: p.summary,
		howTo: p.howTo,
		doneWhen: p.doneWhen,
		steps: p.steps,
		whatYouImprove: p.whatYouImprove,
	};
}

// GET /api/goals — sorted by rarity: common → mythic (easiest → hardest)
router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const raw = await Goal.find({ userId: user._id, status: "active" }).lean();
		if (raw.length === 0) {
			await Quest.deleteMany({ userId: user._id });
		}
		const goals = raw
			.map((g) => {
				const rarity = normalizeGoalRarity(g);
				return { ...g, rarity, _r: RARITY_ORDER[rarity] ?? 0 };
			})
			.sort((a, b) => {
				if (a._r !== b._r) return a._r - b._r;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			})
			.map(({ _r, ...g }) => g);
		return res.json({ goals });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to fetch goals" });
	}
});

// POST /api/goals
router.post("/", async (req, res) => {
	try {
		const {
			title,
			category,
			rarity: rawRarity,
			deadline: rawDeadline,
			description: rawDescription,
		} = req.body || {};
		if (!title) {
			return res.status(400).json({ error: "title is required" });
		}

		const rarity =
			rawRarity && Object.prototype.hasOwnProperty.call(RARITY_ORDER, String(rawRarity).toLowerCase())
				? String(rawRarity).toLowerCase()
				: "common";

		const user = await getUserForReq(req);
		const goalCategory = category || "general";
		const deadline = parseOptionalDate(rawDeadline);
		const description = String(rawDescription || "").trim().slice(0, 2000);

		const goal = await Goal.create({
			userId: user._id,
			title,
			category: goalCategory,
			rarity,
			description,
			deadline,
		});

		const userLevel = calculateLevelFromXp(user.xp);
		const plan = await generateFullGoalQuestPlan({
			goalTitle: title,
			category: goalCategory,
			currentLevel: userLevel,
			deadlineDate: deadline,
			description,
		});

		const months = estimateGoalHorizonMonths(deadline, "");
		const { daysToSeed, weeksToSeed, monthsToSeed } = computeSeedWindows(
			months,
			plan.dailyQuests.length,
			plan.weeklyQuests.length,
			plan.monthlyQuests.length
		);

		const questsToInsert = [];
		const now = new Date();

		for (let i = 0; i < daysToSeed; i++) {
			const date = new Date(now);
			date.setDate(date.getDate() + i);
			date.setHours(12, 0, 0, 0);
			for (const q of plan.dailyQuests) {
				const briefing = buildBriefingPayloadFromRichQuest(q);
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: Math.round(q.xp),
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "daily",
					date,
					expiresAt: null,
					isExpired: false,
					penalty: penaltyDoc("daily", q),
					briefing: {
						...briefing,
						requirements: "",
					},
					briefingGeneratedAt: new Date(),
					briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
				});
			}
		}

		for (let w = 0; w < weeksToSeed; w++) {
			const weekDate = new Date(now);
			weekDate.setDate(weekDate.getDate() + w * 7);
			weekDate.setHours(12, 0, 0, 0);
			for (const q of plan.weeklyQuests) {
				const briefing = buildBriefingPayloadFromRichQuest(q);
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: Math.round(q.xp),
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "weekly",
					date: weekDate,
					expiresAt: null,
					isExpired: false,
					penalty: penaltyDoc("weekly", q),
					briefing: {
						...briefing,
						requirements: "",
					},
					briefingGeneratedAt: new Date(),
					briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
				});
			}
		}

		for (let m = 0; m < monthsToSeed; m++) {
			const monthDate = new Date(now);
			monthDate.setMonth(monthDate.getMonth() + m);
			monthDate.setDate(1);
			monthDate.setHours(12, 0, 0, 0);
			for (const q of plan.monthlyQuests) {
				const briefing = buildBriefingPayloadFromRichQuest(q);
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: Math.round(q.xp),
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "monthly",
					date: monthDate,
					expiresAt: null,
					isExpired: false,
					penalty: penaltyDoc("monthly", q),
					briefing: {
						...briefing,
						requirements: "",
					},
					briefingGeneratedAt: new Date(),
					briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
				});
			}
		}

		if (questsToInsert.length) {
			await Quest.insertMany(questsToInsert);
		}

		const goalsActive = await Goal.find({ userId: user._id, status: "active" }).lean();
		const hist = await History.find({ userId: user._id }).lean();
		const questsCompleted = hist.filter((h) => h.type === "quest_complete" && h.xpChange > 0).length;
		const focusXp = hist.filter((h) => h.type === "focus_session").reduce((s, h) => s + (h.xpChange || 0), 0);
		const focusHours = focusXp / (9 * 60);
		await evaluateAndRecordAchievements({ user, goals: goalsActive, questsCompleted, focusHours });

		const rank = await recalculateAndSaveUserRank(user._id, { preferGemini: true });

		return res.status(201).json({ goalId: goal._id, rank: rank || user.rank || "E" });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to create goal" });
	}
});

// DELETE /api/goals/:id — archive so it no longer appears in GET / (active-only)
router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid goal id" });
		}
		const user = await getUserForReq(req);
		const goal = await Goal.findOneAndUpdate(
			{ _id: id, userId: user._id },
			{ status: "archived" },
			{ new: true }
		);
		if (!goal) {
			return res.status(404).json({ error: "Goal not found" });
		}
		await Quest.deleteMany({ goalId: goal._id, userId: user._id });
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to delete goal" });
	}
});

export default router;

