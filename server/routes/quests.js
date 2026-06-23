import express from "express";
import mongoose from "mongoose";
import Quest from "../models/Quest.js";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import Goal from "../models/Goal.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";
import { meetsMinTierWithReq } from "../utils/billingTier.js";
import { scheduleLeaderboardBroadcast } from "../services/leaderboardHub.js";
import { generateQuestDetails } from "../services/gemini.js";
import { BRIEFING_SCHEMA_VERSION } from "../constants/questBriefing.js";
import { resolvePenaltyForQuest } from "../utils/questPenalty.js";
import { processReferralMilestone } from "../services/referralEngine.js";
import {
	mapQuestDifficulty,
	mapQuestToClientResponse,
	effectiveDifficultyForEasyMode,
} from "../utils/questClientView.js";
import {
	ensureRecoveryQuest,
	ensureStreakSaverQuest,
	buildEngagementPublic,
} from "../services/engagementMechanics.js";
import { buildQuestExerciseItemList, mergeExerciseProgress } from "../services/questExerciseItems.js";
import {
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
	rollingWeeklyStart,
	rollingWeeklyEnd,
	rollingMonthlyStart,
	rollingMonthlyEnd,
	periodKeyDaily,
	periodKeyWeeklyRolling,
	periodKeyMonthlyRolling,
	isQuestTimeframeMissedForPenalty,
} from "../utils/timeframePeriod.js";

const router = express.Router();

/** XP granted once when every quest in that timeframe window for the user is completed. */
const TIMEFRAME_SET_BONUS_XP = { daily: 150, weekly: 400, monthly: 900 };

function markAllExerciseProgressComplete({ questDoc, goalLean }) {
	const steps = Array.isArray(questDoc.briefing?.steps) ? questDoc.briefing.steps.map((s) => String(s)) : [];
	const howToLine = String(questDoc.briefing?.howTo || "").trim();
	const qPlain = questDoc?.toObject ? questDoc.toObject() : questDoc;
	const items = buildQuestExerciseItemList(qPlain, goalLean, steps, howToLine);
	if (!Array.isArray(items) || items.length === 0) return;

	const now = new Date();
	const prev = Array.isArray(questDoc.exerciseProgress) ? questDoc.exerciseProgress : [];
	const prevByKey = new Map(prev.map((p) => [p?.key, p]));

	questDoc.exerciseProgress = items.map((it) => {
		const key = String(it.key);
		const prior = prevByKey.get(key);
		return {
			key,
			completed: true,
			completedAt: prior?.completedAt && prior?.completed ? prior.completedAt : now,
		};
	});
}

/**
 * If completing `completedQuest` finishes the full set for its day/week/month, grant bonus XP once.
 * Mutates `user` (xp, level) and saves when a bonus is awarded.
 */
async function maybeAwardTimeframeSetBonus(user, completedQuest) {
	const t = completedQuest.type;
	if (!["daily", "weekly", "monthly"].includes(t)) {
		return { awarded: 0, leveledUp: false };
	}

	const ref = completedQuest.date ? new Date(completedQuest.date) : new Date();
	let dateFilter;
	let periodKey;
	const bonusXp = TIMEFRAME_SET_BONUS_XP[t];
	if (bonusXp == null || bonusXp <= 0) return { awarded: 0, leveledUp: false };

	if (t === "daily") {
		dateFilter = { $gte: startOfDay(ref), $lte: endOfDay(ref) };
		periodKey = periodKeyDaily(ref);
	} else if (t === "weekly") {
		dateFilter = { $gte: rollingWeeklyStart(ref), $lte: rollingWeeklyEnd(ref) };
		periodKey = periodKeyWeeklyRolling(ref);
	} else {
		dateFilter = { $gte: rollingMonthlyStart(ref), $lte: rollingMonthlyEnd(ref) };
		periodKey = periodKeyMonthlyRolling(ref);
	}

	const inPeriod = await Quest.find({
		userId: user._id,
		type: t,
		date: dateFilter,
	}).lean();

	if (inPeriod.length === 0 || !inPeriod.every((q) => q.isCompleted)) {
		return { awarded: 0, leveledUp: false };
	}

	const existing = await History.findOne({
		userId: user._id,
		type: "timeframe_bonus",
		"meta.periodKey": periodKey,
	}).lean();
	if (existing) return { awarded: 0, leveledUp: false };

	const preBonusLevel = calculateLevelFromXp(user.xp);
	user.xp += bonusXp;
	const postBonusLevel = calculateLevelFromXp(user.xp);
	user.level = postBonusLevel;
	await user.save();

	const label =
		t === "daily" ? "daily quests" : t === "weekly" ? "weekly quests" : "monthly quests";
	await History.create({
		userId: user._id,
		type: "timeframe_bonus",
		xpChange: bonusXp,
		meta: { periodKey, timeframe: t, bonusKind: "all_complete", label },
	});

	if (postBonusLevel > preBonusLevel) {
		await History.create({
			userId: user._id,
			type: "level_up",
			xpChange: 0,
			meta: { level: postBonusLevel },
		});
	}

	return { awarded: bonusXp, leveledUp: postBonusLevel > preBonusLevel };
}

// GET /api/quests?timeframe=daily|weekly|monthly&difficulty=easy|medium|hard
router.get("/", async (req, res) => {
	try {
		const timeframe = (req.query.timeframe || "daily").toString();
		const goalId = req.query.goalId ? req.query.goalId.toString() : null;
		const diffRaw = req.query.difficulty ? String(req.query.difficulty).toLowerCase() : null;
		const user = await getUserForReq(req);
		const userId = user._id;
		if (timeframe === "daily") {
			await ensureRecoveryQuest(user);
			await ensureStreakSaverQuest(user);
		}
		const engagement = buildEngagementPublic(user);
		const cr = engagement.comebackBonusQuestsRemaining;
		const ez = engagement.easyModeTier;
		let filter = { userId, type: timeframe };
		if (goalId) filter = { ...filter, goalId };
		if (diffRaw && ["easy", "medium", "hard"].includes(diffRaw)) {
			filter = { ...filter, difficulty: diffRaw };
		}
		if (timeframe === "daily") {
			const start = new Date();
			start.setHours(0, 0, 0, 0);
			const end = new Date();
			end.setHours(23, 59, 59, 999);
			filter = { ...filter, date: { $gte: start, $lte: end } };
		}
		// For weekly/monthly, switch to rolling windows per quest: fetch all by type and filter in JS
		let quests;
		if (timeframe === "weekly") {
			const allWeekly = await Quest.find({ ...filter, type: "weekly" }).sort({ createdAt: -1 }).lean();
			const now = new Date();
			quests = allWeekly.filter((q) => {
				const start = rollingWeeklyStart(q.date || now);
				const end = rollingWeeklyEnd(q.date || now);
				return now >= start && now <= end;
			});
		} else if (timeframe === "monthly") {
			const allMonthly = await Quest.find({ ...filter, type: "monthly" }).sort({ createdAt: -1 }).lean();
			const now = new Date();
			quests = allMonthly.filter((q) => {
				const start = rollingMonthlyStart(q.date || now);
				const end = rollingMonthlyEnd(q.date || now);
				return now >= start && now <= end;
			});
		} else {
			quests = await Quest.find({ ...filter }).sort({ createdAt: -1 }).lean();
		}
		return res.json({
			quests: quests.map((q) =>
				mapQuestToClientResponse(q, { comebackBonusQuestsRemaining: cr, easyModeTier: ez })
			),
			engagement,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to fetch quests" });
	}
});

function exercisesForQuestResponse(questDoc, goalLean, detailSteps, howToOverride) {
	const steps = Array.isArray(detailSteps) ? detailSteps.map((s) => String(s)) : [];
	const qPlain = questDoc?.toObject ? questDoc.toObject() : questDoc;
	const howTo =
		howToOverride !== undefined && howToOverride !== null
			? String(howToOverride || "").trim()
			: String(questDoc.briefing?.howTo || "").trim();
	const items = buildQuestExerciseItemList(qPlain, goalLean, steps, howTo);
	return mergeExerciseProgress(items, questDoc.exerciseProgress);
}

function hasStoredBriefing(questDoc) {
	if (!questDoc.briefingSchemaVersion || questDoc.briefingSchemaVersion < BRIEFING_SCHEMA_VERSION) {
		return false;
	}
	const b = questDoc.briefing;
	if (!b || !b.summary || String(b.summary).trim().length < 8) return false;
	if (!Array.isArray(b.steps) || b.steps.length < 1) return false;
	if (!String(b.whatYouImprove || "").trim()) return false;
	return true;
}

// GET /api/quests/:id/details — System briefing (Gemini); cached on quest after first load
router.get("/:id/details", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid quest id" });
		}
		const user = await getUserForReq(req);
		const quest = await Quest.findOne({ _id: id, userId: user._id });
		if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		const goal = quest.goalId ? await Goal.findById(quest.goalId).lean() : null;
		const userLevel = calculateLevelFromXp(user.xp);
		const diff = mapQuestDifficulty(quest.difficulty);
		const specialTags = new Set(["recovery", "welcome_bonus", "streak_saver"]);

		if (!quest.isCompleted) {
			if (specialTags.has(quest.questTag)) {
				const userSnap = await User.findById(user._id).select("comebackBonusQuestsRemaining").lean();
				const cr = userSnap?.comebackBonusQuestsRemaining ?? 0;
				const projectedXp = cr > 0 ? Math.round(quest.xpReward * 2) : quest.xpReward;
				const b = quest.briefing || {};
				const stepArr = Array.isArray(b.steps) ? b.steps.map((s) => String(s)) : [];
				return res.json({
					quest: {
						id: quest._id,
						title: quest.title,
						xpReward: projectedXp,
						statType: quest.statType,
						type: quest.type,
						isCompleted: false,
						goalId: quest.goalId,
						difficulty: diff,
					},
					goal: goal
						? { id: goal._id, title: goal.title, category: goal.category }
						: null,
					details: {
						summary: String(b.summary || "").trim() || quest.title,
						whatYouImprove: String(b.whatYouImprove || "").trim(),
						doneWhen: String(b.doneWhen || "").trim(),
						steps: stepArr,
						tips: String(b.tips || "").trim(),
						source: String(b.source || "fallback"),
						howTo: String(b.howTo || "").trim(),
					},
					exercises: exercisesForQuestResponse(quest, goal, stepArr),
					isPenaltyActive: false,
					originalTitle: quest.title,
					questTag: quest.questTag,
				});
			}
			if (isQuestTimeframeMissedForPenalty(quest)) {
				const effD = effectiveDifficultyForEasyMode(quest.difficulty, user.easyModeTier || 0);
				const pen = resolvePenaltyForQuest({ ...quest.toObject(), difficulty: effD });
				const crPen = Math.max(0, Number(user.comebackBonusQuestsRemaining || 0));
				const projectedXpPen = crPen > 0 ? Math.round(quest.xpReward * 2) : quest.xpReward;
				return res.json({
					quest: {
						id: quest._id,
						title: pen.title,
						xpReward: projectedXpPen,
						statType: quest.statType,
						type: quest.type,
						isCompleted: false,
						goalId: quest.goalId,
						difficulty: mapQuestDifficulty(effD),
					},
					goal: goal
						? { id: goal._id, title: goal.title, category: goal.category }
						: null,
					details: {
						summary: pen.summary,
						whatYouImprove: pen.whatYouImprove,
						doneWhen: pen.doneWhen,
						steps: pen.steps,
						tips: "",
						source: "fallback",
						howTo: pen.howTo || "",
					},
					exercises: exercisesForQuestResponse(quest, goal, pen.steps, pen.howTo),
					isPenaltyActive: true,
					originalTitle: quest.title,
				});
			}

			let detailsInWindow;
			if (hasStoredBriefing(quest)) {
				detailsInWindow = {
					summary: quest.briefing.summary,
					whatYouImprove: quest.briefing.whatYouImprove || "",
					doneWhen: quest.briefing.doneWhen || "",
					steps: quest.briefing.steps,
					tips: quest.briefing.tips || "",
					source: quest.briefing.source || "fallback",
					howTo: quest.briefing.howTo || "",
				};
			} else {
				const briefDiffIw = mapQuestDifficulty(
					effectiveDifficultyForEasyMode(quest.difficulty, user.easyModeTier || 0)
				);
				detailsInWindow = await generateQuestDetails({
					questTitle: quest.title,
					goalTitle: goal?.title || "Your goal",
					goalCategory: goal?.category || "general",
					goalRarity: goal?.rarity || "common",
					questType: quest.type || "daily",
					statType: quest.statType,
					xpReward: quest.xpReward,
					difficulty: briefDiffIw,
					userLevel,
					isCompleted: false,
				});
				quest.briefing = {
					summary: detailsInWindow.summary,
					whatYouImprove: detailsInWindow.whatYouImprove || "",
					doneWhen: detailsInWindow.doneWhen || "",
					requirements: "",
					howTo: detailsInWindow.howTo || "",
					steps: detailsInWindow.steps || [],
					tips: detailsInWindow.tips || "",
					source: detailsInWindow.source === "gemini" ? "gemini" : "fallback",
				};
				quest.briefingGeneratedAt = new Date();
				quest.briefingSchemaVersion = BRIEFING_SCHEMA_VERSION;
				await quest.save();
			}
			const briefDiffOut = mapQuestDifficulty(
				effectiveDifficultyForEasyMode(quest.difficulty, user.easyModeTier || 0)
			);
			const crIw = Math.max(0, Number(user.comebackBonusQuestsRemaining || 0));
			const projectedXpIw = crIw > 0 ? Math.round(quest.xpReward * 2) : quest.xpReward;
			return res.json({
				quest: {
					id: quest._id,
					title: quest.title,
					xpReward: projectedXpIw,
					statType: quest.statType,
					type: quest.type,
					isCompleted: false,
					goalId: quest.goalId,
					difficulty: briefDiffOut,
				},
				goal: goal
					? { id: goal._id, title: goal.title, category: goal.category }
					: null,
				details: {
					...detailsInWindow,
					howTo: detailsInWindow.howTo || "",
				},
				exercises: exercisesForQuestResponse(quest, goal, detailsInWindow.steps),
				isPenaltyActive: false,
				originalTitle: quest.title,
			});
		}

		let details;
		if (hasStoredBriefing(quest)) {
			details = {
				summary: quest.briefing.summary,
				whatYouImprove: quest.briefing.whatYouImprove || "",
				doneWhen: quest.briefing.doneWhen || "",
				steps: quest.briefing.steps,
				tips: quest.briefing.tips || "",
				source: quest.briefing.source || "fallback",
				howTo: quest.briefing.howTo || "",
			};
		} else {
			const briefDiff = mapQuestDifficulty(
				effectiveDifficultyForEasyMode(quest.difficulty, user.easyModeTier || 0)
			);
			details = await generateQuestDetails({
				questTitle: quest.title,
				goalTitle: goal?.title || "Your goal",
				goalCategory: goal?.category || "general",
				goalRarity: goal?.rarity || "common",
				questType: quest.type || "daily",
				statType: quest.statType,
				xpReward: quest.xpReward,
				difficulty: briefDiff,
				userLevel,
				isCompleted: !!quest.isCompleted,
			});
			quest.briefing = {
				summary: details.summary,
				whatYouImprove: details.whatYouImprove || "",
				doneWhen: details.doneWhen || "",
				requirements: "",
				howTo: details.howTo || "",
				steps: details.steps || [],
				tips: details.tips || "",
				source: details.source === "gemini" ? "gemini" : "fallback",
			};
			quest.briefingGeneratedAt = new Date();
			quest.briefingSchemaVersion = BRIEFING_SCHEMA_VERSION;
			await quest.save();
		}

		return res.json({
			quest: {
				id: quest._id,
				title: quest.title,
				xpReward: quest.xpReward,
				statType: quest.statType,
				type: quest.type,
				isCompleted: quest.isCompleted,
				goalId: quest.goalId,
				difficulty: diff,
			},
			goal: goal
				? { id: goal._id, title: goal.title, category: goal.category }
				: null,
			details: {
				...details,
				howTo: details.howTo || "",
			},
			exercises: exercisesForQuestResponse(quest, goal, details.steps),
			isPenaltyActive: false,
			originalTitle: quest.title,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load quest details" });
	}
});

// PATCH /api/quests/:id/exercise-check — toggle individual exercise / step completion
router.patch("/:id/exercise-check", async (req, res) => {
	try {
		const { id } = req.params;
		const key = req.body?.key != null ? String(req.body.key).slice(0, 200) : "";
		const completed = !!req.body?.completed;
		if (!mongoose.Types.ObjectId.isValid(id) || !key) {
			return res.status(400).json({ error: "Invalid request" });
		}
		const user = await getUserForReq(req);
		const quest = await Quest.findOne({ _id: id, userId: user._id });
		if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		const goal = quest.goalId ? await Goal.findById(quest.goalId).lean() : null;
		const steps = Array.isArray(quest.briefing?.steps) ? quest.briefing.steps.map((s) => String(s)) : [];
		const howToLine = String(quest.briefing?.howTo || "").trim();
		const qPlain = quest.toObject();
		const items = buildQuestExerciseItemList(qPlain, goal, steps, howToLine);
		const valid = new Set(items.map((it) => it.key));
		if (!valid.has(key)) {
			return res.status(400).json({ error: "Unknown exercise key" });
		}

		const arr = Array.isArray(quest.exerciseProgress) ? [...quest.exerciseProgress] : [];
		const idx = arr.findIndex((p) => p && p.key === key);
		if (idx >= 0) {
			arr[idx] = {
				...arr[idx],
				key,
				completed,
				completedAt: completed ? new Date() : null,
			};
		} else {
			arr.push({ key, completed, completedAt: completed ? new Date() : null });
		}
		quest.exerciseProgress = arr;
		await quest.save();

		const exercises = exercisesForQuestResponse(quest, goal, steps, howToLine);
		return res.json({ exercises });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to update exercise progress" });
	}
});

// PATCH /api/quests/:id/complete
router.patch("/:id/complete", async (req, res) => {
	try {
		const { id } = req.params;
		const quest = await Quest.findById(id);
		if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		if (quest.isCompleted) {
			return res.json({ updated: false, leveledUp: false });
		}

		const timerActiveSecondsRaw = req.body?.timerActiveSeconds;
		const timerActiveSeconds = Number.isFinite(Number(timerActiveSecondsRaw))
			? Math.max(0, Math.min(24 * 60 * 60, Math.round(Number(timerActiveSecondsRaw))))
			: 0;

		quest.isCompleted = true;
		try {
			const goal = quest.goalId ? await Goal.findById(quest.goalId).lean() : null;
			markAllExerciseProgressComplete({ questDoc: quest, goalLean: goal });
		} catch {
			// If checklist derivation fails, still allow quest completion.
		}

		// Update user stats and xp
		const user = await User.findById(quest.userId);
		if (!user) {
			return res.status(500).json({ error: "User not found for quest" });
		}

		const difficulty = String(quest.difficulty || "medium").toLowerCase();
		const timerEligible = difficulty === "medium" || difficulty === "hard";
		const baseXpReward = Number(quest.xpReward) || 0;

		const resolveTimerConfig = () => {
			const t = quest.trainingTimer || {};
			let expected = Number(t.expectedDurationMin);
			let maxEff = Number(t.maxEffectiveDurationMin);
			let ppm = Number(t.xpPerMinute);
			if (!Number.isFinite(expected) || expected <= 0) expected = difficulty === "hard" ? 45 : 30;
			if (!Number.isFinite(maxEff) || maxEff <= 0) maxEff = Math.round(expected * 2);
			if (!Number.isFinite(ppm) || ppm <= 0) {
				// Conservative default: at expected time, bonus ≈ 20–30% of base XP.
				ppm = Math.max(1, Math.round(baseXpReward / Math.max(10, expected) / 4));
			}
			expected = Math.max(5, Math.min(240, Math.round(expected)));
			maxEff = Math.max(expected, Math.min(360, Math.round(maxEff)));
			ppm = Math.max(1, Math.min(60, Math.round(ppm)));
			return { expectedDurationMin: expected, maxEffectiveDurationMin: maxEff, xpPerMinute: ppm };
		};

		const computeTimerBonusXp = () => {
			if (!timerEligible) return { bonusXp: 0, cfg: null, effectiveMinutes: 0 };
			if (!timerActiveSeconds || timerActiveSeconds < 30) return { bonusXp: 0, cfg: null, effectiveMinutes: 0 };
			if (timerActiveSeconds > 6 * 60 * 60) return { bonusXp: 0, cfg: null, effectiveMinutes: 0 }; // anti-farm hard stop

			const cfg = resolveTimerConfig();
			const minutes = timerActiveSeconds / 60;
			const effectiveMinutes = Math.min(minutes, cfg.maxEffectiveDurationMin);

			// Non-linear bonus curve with diminishing returns.
			const expected = cfg.expectedDurationMin;
			const ppm = cfg.xpPerMinute;

			const m1 = Math.min(effectiveMinutes, expected);
			const m2 = Math.max(0, Math.min(effectiveMinutes, expected * 1.5) - expected);
			const m3 = Math.max(0, effectiveMinutes - expected * 1.5);

			let raw = 0;
			raw += m1 * ppm; // normal gains up to expected
			raw += m2 * ppm * 0.35; // diminished after expected → expected*1.5
			raw += m3 * ppm * 0.1; // heavily diminished beyond expected*1.5

			// Efficiency factor: modest boost for finishing near/under expected, penalty if far over.
			const ratio = effectiveMinutes / expected;
			let efficiency = 1;
			if (ratio < 0.75) efficiency = 1.05;
			else if (ratio <= 1.2) efficiency = 1.0;
			else if (ratio <= 1.5) efficiency = 0.85;
			else efficiency = 0.6;

			let bonus = Math.round(raw * efficiency);
			const cap = Math.max(0, Math.round(baseXpReward * 0.8));
			if (bonus > cap) bonus = cap;
			if (bonus < 0) bonus = 0;
			return { bonusXp: bonus, cfg, effectiveMinutes };
		};

		const timerBonus = computeTimerBonusXp();

		const comebackOn = (user.comebackBonusQuestsRemaining || 0) > 0;
		const mult = comebackOn ? 2 : 1;
		const baseXpGrant = Math.round(baseXpReward * mult);
		// Bonus XP is awarded for execution quality/time, independent of comeback multiplier.
		const xpGrant = baseXpGrant + (timerBonus.bonusXp || 0);

		const preLevel = calculateLevelFromXp(user.xp);
		user.xp += xpGrant;

		// increment appropriate stat
		const incMap = {
			str: "strength",
			int: "intelligence",
			agi: "agility",
			vit: "vitality",
		};
		const statKey = incMap[quest.statType] || "strength";
		user.stats[statKey] = (user.stats[statKey] || 0) + 1;

		const postLevel = calculateLevelFromXp(user.xp);
		user.level = postLevel;
		if (comebackOn) {
			user.comebackBonusQuestsRemaining = Math.max(0, (user.comebackBonusQuestsRemaining || 0) - 1);
		}
		const qTag = quest.questTag || "standard";
		if (qTag === "recovery") {
			user.easyModeTier = 4;
		} else if ((user.easyModeTier || 0) > 0) {
			user.easyModeTier = Math.max(0, (user.easyModeTier || 0) - 1);
		}
		await user.save();

		quest.lastCompletionTimer = {
			activeSeconds: timerActiveSeconds || null,
			bonusXpAwarded: timerBonus.bonusXp || 0,
			completedAt: new Date(),
		};
		// Persist config if we had to synthesize it (so subsequent runs are stable).
		if (timerEligible) {
			const cfg = timerBonus.cfg || resolveTimerConfig();
			quest.trainingTimer = cfg;
		}
		await quest.save();

		await History.create({
			userId: user._id,
			type: "quest_complete",
			xpChange: xpGrant,
			questId: quest._id,
			meta: {
				statType: quest.statType,
				title: quest.title,
				...(mult === 2 ? { comebackMultiplier: 2, baseXpReward } : {}),
				...(timerBonus.bonusXp
					? {
							timerActiveSeconds,
							timerBonusXp: timerBonus.bonusXp,
							timerExpectedDurationMin: timerBonus.cfg?.expectedDurationMin,
							timerMaxEffectiveDurationMin: timerBonus.cfg?.maxEffectiveDurationMin,
							timerXpPerMinute: timerBonus.cfg?.xpPerMinute,
						}
					: timerActiveSeconds
						? { timerActiveSeconds, timerBonusXp: 0 }
						: {}),
			},
		});
		if (postLevel > preLevel) {
			await History.create({
				userId: user._id,
				type: "level_up",
				xpChange: 0,
				meta: { level: postLevel },
			});
		}

		const bonus = await maybeAwardTimeframeSetBonus(user, quest);
		const leveledUpFromBonus = bonus.leveledUp;

		const goals = await Goal.find({ userId: user._id, status: "active" }).lean();
		const questsCompleted = await History.countDocuments({ userId: user._id, type: "quest_complete", xpChange: { $gt: 0 } });
		if (questsCompleted === 1) {
			try {
				await processReferralMilestone(user._id, "first_quest");
			} catch (refErr) {
				// eslint-disable-next-line no-console
				console.warn("[quests] referral first_quest failed", refErr);
			}
		}
		const focusXp = await History.aggregate([
			{ $match: { userId: user._id, type: "focus_session" } },
			{ $group: { _id: null, total: { $sum: "$xpChange" } } },
		]);
		const focusHours = (focusXp?.[0]?.total || 0) / (9 * 60);
		await evaluateAndRecordAchievements({ user, goals, questsCompleted, focusHours });

		const rank = await recalculateAndSaveUserRank(user._id, {
			preferGemini: meetsMinTierWithReq(user, "elite", req),
		});

		return res.json({
			updated: true,
			leveledUp: postLevel > preLevel || leveledUpFromBonus,
			timeframeBonusXp: bonus.awarded || 0,
			xpGranted: xpGrant,
			timerBonusXp: timerBonus.bonusXp || 0,
			comebackMultiplier: mult,
			comebackBonusQuestsRemaining: user.comebackBonusQuestsRemaining ?? 0,
			easyModeTier: user.easyModeTier ?? 0,
			user: {
				level: user.level,
				xp: user.xp,
				stats: user.stats,
				rank: rank || user.rank || "E",
			},
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to complete quest" });
	}
});

// PATCH /api/quests/:id/revert
router.patch("/:id/revert", async (req, res) => {
	try {
		const { id } = req.params;
		const quest = await Quest.findById(id);
	 if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		if (!quest.isCompleted) {
			return res.json({ updated: false });
		}
		const user = await User.findById(quest.userId);
		if (!user) return res.status(500).json({ error: "User not found for quest" });

		// revert quest completion
		quest.isCompleted = false;
		// also revert per-exercise checklist state so the quest is truly "undone"
		quest.exerciseProgress = [];
		await quest.save();

		const lastGrant = await History.findOne({
			userId: user._id,
			questId: quest._id,
			type: "quest_complete",
			xpChange: { $gt: 0 },
		})
			.sort({ occurredAt: -1 })
			.lean();
		const granted = lastGrant?.xpChange ?? quest.xpReward;

		// decrement xp and stat (minimum 0)
		user.xp = Math.max(0, user.xp - granted);
		const map = { str: "strength", int: "intelligence", agi: "agility", vit: "vitality" };
		const key = map[quest.statType] || "strength";
		user.stats[key] = Math.max(0, (user.stats[key] || 0) - 1);
		user.level = calculateLevelFromXp(user.xp);
		if (lastGrant?.meta?.comebackMultiplier === 2) {
			user.comebackBonusQuestsRemaining = Math.min(3, (user.comebackBonusQuestsRemaining || 0) + 1);
		}
		await user.save();

		await History.create({
			userId: user._id,
			type: "quest_complete",
			xpChange: -granted,
			questId: quest._id,
			meta: { reverted: true, statType: quest.statType, title: quest.title },
		});

		scheduleLeaderboardBroadcast();

		return res.json({
			updated: true,
			user: { level: user.level, xp: user.xp, stats: user.stats },
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to revert quest" });
	}
});

export default router;

