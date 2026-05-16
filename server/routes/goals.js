import express from "express";
import mongoose from "mongoose";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import {
	generateFitnessSystemFromRoadmap,
	generateSupplementalFitnessRichQuests,
	buildBriefingPayloadFromRichQuest,
	estimateGoalHorizonMonths,
} from "../services/gemini.js";
import { BRIEFING_SCHEMA_VERSION } from "../constants/questBriefing.js";
import { buildStoredPenaltyForQuest } from "../utils/questPenalty.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";
import { findRelevantFitnessLibrary } from "../services/fitnessLibraryQuery.js";
import {
	enrichAndPersistGoalProgramModules,
	PROGRAM_MODULES_CACHE_VERSION,
} from "../services/programModulesEnrichment.js";
import { computeCurrentRotationMovementRows } from "../services/programModulesRotation.js";
import { assessGoalFitnessRelevance } from "../services/goalTopicGate.js";
import { buildAiQuestPlanContext } from "../services/questPlanContext.js";
import { billingTierRank, meetsMinTierWithReq, adminPreviewBypassActive } from "../utils/billingTier.js";

const router = express.Router();

const REALIGN_QUEST_PLANNER_NOTE = `RE-ALIGNMENT RUN: The app is replacing future incomplete standard quests for this goal. Design fresh daily / weekly / monthly templates that match ONLY the PRIMARY TRAINING GOAL. Use USER CONTEXT — especially recentCompletedQuestTitles — to avoid repeating the same titles while staying goal-specific. Combine database facts with sound programming judgment.`;

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

function normalizeUserProfile(raw) {
	if (!raw || typeof raw !== "object") return null;
	const r = raw;
	const levelRaw = String(r.level || "").toLowerCase().trim();
	const level =
		levelRaw === "beginner" || levelRaw === "intermediate" || levelRaw === "advanced"
			? levelRaw
			: "beginner";
	const days = Number(r.availableDaysPerWeek);
	const duration = Number(r.sessionDurationMinutes);
	const availableDaysPerWeek =
		Number.isFinite(days) ? Math.max(1, Math.min(7, Math.round(days))) : 3;
	const sessionDurationMinutes =
		Number.isFinite(duration) ? Math.max(10, Math.min(240, Math.round(duration))) : 45;
	const equipment = String(r.equipment || "").trim().slice(0, 500);
	const constraints = String(r.constraints || "").trim().slice(0, 1200);
	return { level, availableDaysPerWeek, sessionDurationMinutes, equipment, constraints };
}

function buildAiDescriptionWithProfile(description, userProfile) {
	const desc = String(description || "").trim();
	if (!userProfile) return desc;
	const lines = [
		"USER_PROFILE",
		`level: ${userProfile.level}`,
		`available_days_per_week: ${userProfile.availableDaysPerWeek}`,
		`session_duration_minutes: ${userProfile.sessionDurationMinutes}`,
		userProfile.equipment ? `equipment: ${userProfile.equipment}` : "",
		userProfile.constraints ? `constraints: ${userProfile.constraints}` : "",
	].filter(Boolean);
	const block = lines.join("\n");
	return desc ? `${desc}\n\n${block}` : block;
}

// Total quest instances to seed per goal (across daily + weekly + monthly).
// This should scale beyond the old "5 quests" feel so multiple goals produce noticeably more content.
const QUEST_TOTAL_MIN = 10;
const QUEST_TOTAL_MAX = 30;

/** XP for the onboarding quest: creating the first active training program (quest-like reward). */
const ONBOARDING_FIRST_PROGRAM_XP = 100;

/** Total quest rows to create for one goal: 10–30, longer deadline horizon → closer to 30. */
function targetCombinedQuestCount(months) {
	const m = Number(months);
	const clamped = Number.isFinite(m) ? Math.max(1, Math.min(36, m)) : 3;
	return Math.min(
		QUEST_TOTAL_MAX,
		Math.max(QUEST_TOTAL_MIN, Math.round(10 + ((clamped - 1) / 35) * 20))
	);
}

/** Pro+: full cap; Starter: tighter; Free: tighter (matches catalog tier limits). Admin preview: full cap. */
function cappedQuestTargetCombinedCount(months, user, req) {
	const base = targetCombinedQuestCount(months);
	if (req && adminPreviewBypassActive(req)) return base;
	const r = billingTierRank(user);
	if (r >= 2) return base;
	if (r >= 1) return Math.min(base, 22);
	return Math.min(base, 14);
}

function searchSeedAllocation(Dlen, Wlen, Mlen, target) {
	let best = null;
	const maxDays = 21;
	const maxWeeks = 8;
	const maxMonths = Mlen > 0 ? 4 : 0;

	for (let monthsToSeed = 0; monthsToSeed <= maxMonths; monthsToSeed++) {
		for (let weeksToSeed = 0; weeksToSeed <= maxWeeks; weeksToSeed++) {
			for (let daysToSeed = 0; daysToSeed <= maxDays; daysToSeed++) {
				if (Dlen > 0 && daysToSeed === 0) continue;
				if (Dlen === 0 && daysToSeed > 0) continue;

				const total = daysToSeed * Dlen + weeksToSeed * Wlen + monthsToSeed * Mlen;
				if (total < QUEST_TOTAL_MIN || total > QUEST_TOTAL_MAX) continue;

				const diff = Math.abs(total - target);
				if (
					!best ||
					diff < best.diff ||
					(diff === best.diff && total > best.total)
				) {
					best = { daysToSeed, weeksToSeed, monthsToSeed, total, diff };
				}
			}
		}
	}
	return best;
}

/**
 * Pick rolling windows so total inserted quests stays in [6, 15] (deadline-scaled target).
 * May trim template arrays when the AI returns very long lists so totals can fit in range.
 * @returns {{ seedPlan: object, daysToSeed: number, weeksToSeed: number, monthsToSeed: number }}
 */
function allocateQuestSeedWindowsWithPlan(months, plan) {
	const target = targetCombinedQuestCount(months);

	const trim = (p, dailyCap, weeklyCap, monthlyCap) => ({
		...p,
		dailyQuests: Array.isArray(p.dailyQuests) ? p.dailyQuests.slice(0, dailyCap) : [],
		weeklyQuests: Array.isArray(p.weeklyQuests) ? p.weeklyQuests.slice(0, weeklyCap) : [],
		monthlyQuests: Array.isArray(p.monthlyQuests) ? p.monthlyQuests.slice(0, monthlyCap) : [],
	});

	let seedPlan = plan;
	let capCfg = [
		[40, 24, 14],
		[8, 6, 4],
		[5, 4, 3],
	];

	let allocation = null;
	for (const [dc, wc, mc] of capCfg) {
		seedPlan = trim(plan, dc, wc, mc);
		const Dlen = seedPlan.dailyQuests.length;
		const Wlen = seedPlan.weeklyQuests.length;
		const Mlen = seedPlan.monthlyQuests.length;

		if (Dlen + Wlen + Mlen === 0) {
			allocation = null;
			continue;
		}

		allocation = searchSeedAllocation(Dlen, Wlen, Mlen, target);
		if (allocation) break;
	}

	if (!allocation) {
		seedPlan = trim(plan, 5, 4, 3);
		const Dlen = seedPlan.dailyQuests.length;
		const Wlen = seedPlan.weeklyQuests.length;
		const Mlen = seedPlan.monthlyQuests.length;
		allocation = searchSeedAllocation(Dlen, Wlen, Mlen, target);
	}

	if (!allocation) {
		seedPlan = trim(plan, 5, 4, 3);
		const Dlen = seedPlan.dailyQuests.length;
		const Wlen = seedPlan.weeklyQuests.length;
		const Mlen = seedPlan.monthlyQuests.length;
		let daysToSeed = Dlen ? 1 : 0;
		let weeksToSeed = Wlen ? 1 : 0;
		let monthsToSeed = Mlen ? 1 : 0;
		let total = daysToSeed * Dlen + weeksToSeed * Wlen + monthsToSeed * Mlen;
		while (total < QUEST_TOTAL_MIN && Dlen > 0 && daysToSeed < 21) {
			daysToSeed += 1;
			total += Dlen;
		}
		while (total < QUEST_TOTAL_MIN && Wlen > 0 && weeksToSeed < 8) {
			weeksToSeed += 1;
			total += Wlen;
		}
		while (total < QUEST_TOTAL_MIN && Mlen > 0 && monthsToSeed < 4) {
			monthsToSeed += 1;
			total += Mlen;
		}
		while (total > QUEST_TOTAL_MAX && daysToSeed > 0) {
			daysToSeed -= 1;
			total -= Dlen;
		}
		while (total > QUEST_TOTAL_MAX && weeksToSeed > 0) {
			weeksToSeed -= 1;
			total -= Wlen;
		}
		while (total > QUEST_TOTAL_MAX && monthsToSeed > 0) {
			monthsToSeed -= 1;
			total -= Mlen;
		}
		return { seedPlan, daysToSeed, weeksToSeed, monthsToSeed };
	}

	return {
		seedPlan,
		daysToSeed: allocation.daysToSeed,
		weeksToSeed: allocation.weeksToSeed,
		monthsToSeed: allocation.monthsToSeed,
	};
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

function coerceUInt(n, fallback = 0) {
	const x = Number(n);
	if (!Number.isFinite(x) || x < 0) return fallback;
	return Math.floor(x);
}

function timerConfigForQuestRow(q, questType) {
	const difficulty = String(q?.difficulty || "medium").toLowerCase();
	if (!(difficulty === "medium" || difficulty === "hard")) return null;
	const blob = `${String(q?.completionStandard || "")}\n${String(q?.instructions || "")}\n${String(q?.title || "")}`;
	const m = blob.match(/\b(\d{1,3})\s*(min|mins|minute|minutes)\b/i);
	let expected = m ? Number(m[1]) : NaN;

	// Defaults by quest window type (daily < weekly < monthly).
	const base =
		questType === "monthly"
			? difficulty === "hard"
				? 120
				: 90
			: questType === "weekly"
				? difficulty === "hard"
					? 90
					: 60
				: difficulty === "hard"
					? 45
					: 30;

	if (!Number.isFinite(expected) || expected <= 0) expected = base;
	expected = Math.max(5, Math.min(240, Math.round(expected)));
	const maxEffectiveDurationMin = Math.max(expected, Math.min(360, Math.round(expected * 2)));

	const baseXp = Math.max(0, Math.round(Number(q?.xp) || 0));
	const xpPerMinute = Math.max(1, Math.min(60, Math.round(baseXp / Math.max(10, expected) / 4)));

	return { expectedDurationMin: expected, maxEffectiveDurationMin, xpPerMinute };
}

/**
 * Ensure rolling window counts produce a projected quest total in [6, 15] when possible.
 * Fixes NaN windows and edge cases where math yields 5 (e.g. 1×5 dailies only).
 */
function reconcileWindowsWithTemplateCounts(daysToSeed, weeksToSeed, monthsToSeed, seedPlan) {
	let d = coerceUInt(daysToSeed);
	let w = coerceUInt(weeksToSeed);
	let mo = coerceUInt(monthsToSeed);
	const D = seedPlan.dailyQuests?.length ?? 0;
	const W = seedPlan.weeklyQuests?.length ?? 0;
	const M = seedPlan.monthlyQuests?.length ?? 0;

	const projected = () => d * D + w * W + mo * M;

	if (D > 0 && d === 0) d = 1;

	for (let guard = 0; guard < 100; guard++) {
		const p = projected();
		if (p >= QUEST_TOTAL_MIN && p <= QUEST_TOTAL_MAX) {
			return { daysToSeed: d, weeksToSeed: w, monthsToSeed: mo };
		}
		if (p < QUEST_TOTAL_MIN) {
			if (D > 0 && d < 30) {
				d += 1;
				continue;
			}
			if (W > 0 && w < 12) {
				w += 1;
				continue;
			}
			if (M > 0 && mo < 8) {
				mo += 1;
				continue;
			}
			break;
		}
		if (p > QUEST_TOTAL_MAX) {
			if (M > 0 && mo > 0) {
				mo -= 1;
				continue;
			}
			if (W > 0 && w > 0) {
				w -= 1;
				continue;
			}
			if (D > 0 && d > 1) {
				d -= 1;
				continue;
			}
			break;
		}
	}

	return { daysToSeed: d, weeksToSeed: w, monthsToSeed: mo };
}

function addDailyDayAtOffset(questsToInsert, seedPlan, userId, goalId, now, dayOffset) {
	const date = new Date(now);
	date.setDate(date.getDate() + dayOffset);
	date.setHours(12, 0, 0, 0);
	for (const q of seedPlan.dailyQuests) {
		const briefing = buildBriefingPayloadFromRichQuest(q);
		const trainingTimer = timerConfigForQuestRow(q, "daily");
		questsToInsert.push({
			userId,
			goalId,
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
			...(trainingTimer ? { trainingTimer } : {}),
			briefing: {
				...briefing,
				requirements: "",
			},
			briefingGeneratedAt: new Date(),
			briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
		});
	}
}

function addWeeklyWeekAtOffset(questsToInsert, seedPlan, userId, goalId, now, weekIndex) {
	const weekDate = new Date(now);
	weekDate.setDate(weekDate.getDate() + weekIndex * 7);
	weekDate.setHours(12, 0, 0, 0);
	for (const q of seedPlan.weeklyQuests) {
		const briefing = buildBriefingPayloadFromRichQuest(q);
		const trainingTimer = timerConfigForQuestRow(q, "weekly");
		questsToInsert.push({
			userId,
			goalId,
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
			...(trainingTimer ? { trainingTimer } : {}),
			briefing: {
				...briefing,
				requirements: "",
			},
			briefingGeneratedAt: new Date(),
			briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
		});
	}
}

function addMonthlyMonthAtOffset(questsToInsert, seedPlan, userId, goalId, now, monthIndex) {
	const monthDate = new Date(now);
	monthDate.setMonth(monthDate.getMonth() + monthIndex);
	monthDate.setDate(1);
	monthDate.setHours(12, 0, 0, 0);
	for (const q of seedPlan.monthlyQuests) {
		const briefing = buildBriefingPayloadFromRichQuest(q);
		const trainingTimer = timerConfigForQuestRow(q, "monthly");
		questsToInsert.push({
			userId,
			goalId,
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
			...(trainingTimer ? { trainingTimer } : {}),
			briefing: {
				...briefing,
				requirements: "",
			},
			briefingGeneratedAt: new Date(),
			briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
		});
	}
}

function trimQuestBatchToMax(questsToInsert) {
	while (questsToInsert.length > QUEST_TOTAL_MAX) {
		questsToInsert.pop();
	}
}

/**
 * Clamp batch to [QUEST_TOTAL_MIN, QUEST_TOTAL_MAX], preferring exactly `targetCount` when possible.
 * Pads by extending rolling windows from templates, then AI + fallback supplemental rows for the goal.
 */
async function finalizeQuestBatchToTarget(
	questsToInsert,
	seedPlan,
	userId,
	goalId,
	now,
	daysToSeed,
	weeksToSeed,
	monthsToSeed,
	targetCount,
	supplementCtx
) {
	const target = Math.min(QUEST_TOTAL_MAX, Math.max(QUEST_TOTAL_MIN, Math.round(Number(targetCount) || QUEST_TOTAL_MIN)));

	trimQuestBatchToMax(questsToInsert);
	while (questsToInsert.length > target) {
		questsToInsert.pop();
	}

	let padDay = coerceUInt(daysToSeed);
	let padWeek = coerceUInt(weeksToSeed);
	let padMonth = coerceUInt(monthsToSeed);
	let guard = 0;
	while (questsToInsert.length < target && questsToInsert.length < QUEST_TOTAL_MAX && guard++ < 120) {
		if (seedPlan.dailyQuests?.length > 0) {
			addDailyDayAtOffset(questsToInsert, seedPlan, userId, goalId, now, padDay);
			padDay += 1;
			continue;
		}
		if (seedPlan.weeklyQuests?.length > 0) {
			addWeeklyWeekAtOffset(questsToInsert, seedPlan, userId, goalId, now, padWeek);
			padWeek += 1;
			continue;
		}
		if (seedPlan.monthlyQuests?.length > 0) {
			addMonthlyMonthAtOffset(questsToInsert, seedPlan, userId, goalId, now, padMonth);
			padMonth += 1;
			continue;
		}
		break;
	}

	trimQuestBatchToMax(questsToInsert);
	while (questsToInsert.length > target) {
		questsToInsert.pop();
	}

	const supplementToCeiling = async (ceiling, maxPasses = 4) => {
		if (!supplementCtx || ceiling <= 0) return;
		for (let pass = 0; pass < maxPasses && questsToInsert.length < ceiling && questsToInsert.length < QUEST_TOTAL_MAX; pass++) {
			const need = Math.min(ceiling - questsToInsert.length, QUEST_TOTAL_MAX - questsToInsert.length);
			if (need <= 0) break;
			const beforeLen = questsToInsert.length;
			const existingTitles = questsToInsert.map((q) => String(q.title || ""));
			let rows = [];
			try {
				rows = await generateSupplementalFitnessRichQuests({
					goalTitle: supplementCtx.goalTitle,
					description: supplementCtx.description,
					count: need,
					existingTitles,
					currentLevel: supplementCtx.currentLevel,
					userDbContext: supplementCtx.userDbContext ?? null,
					libraryContext: supplementCtx.libraryContext ?? null,
				});
			} catch (sup) {
				// eslint-disable-next-line no-console
				console.warn("[goals] supplemental AI quests:", sup?.message || sup);
				rows = [];
			}
			let off = padDay;
			for (const row of rows) {
				if (questsToInsert.length >= ceiling) break;
				if (questsToInsert.length >= QUEST_TOTAL_MAX) break;
				pushOneDailyFromRichRow(questsToInsert, row, userId, goalId, now, off);
				off += 1;
			}
			padDay = off;
			if (questsToInsert.length === beforeLen) break;
		}
	};

	await supplementToCeiling(target);

	trimQuestBatchToMax(questsToInsert);
	while (questsToInsert.length > target) {
		questsToInsert.pop();
	}

	// Hard floor: never return fewer than QUEST_TOTAL_MIN when we can pad or supplement.
	guard = 0;
	while (questsToInsert.length < QUEST_TOTAL_MIN && questsToInsert.length < QUEST_TOTAL_MAX && guard++ < 80) {
		if (seedPlan.dailyQuests?.length > 0) {
			addDailyDayAtOffset(questsToInsert, seedPlan, userId, goalId, now, padDay);
			padDay += 1;
			continue;
		}
		if (seedPlan.weeklyQuests?.length > 0) {
			addWeeklyWeekAtOffset(questsToInsert, seedPlan, userId, goalId, now, padWeek);
			padWeek += 1;
			continue;
		}
		if (seedPlan.monthlyQuests?.length > 0) {
			addMonthlyMonthAtOffset(questsToInsert, seedPlan, userId, goalId, now, padMonth);
			padMonth += 1;
			continue;
		}
		break;
	}

	const floorCeiling = Math.min(QUEST_TOTAL_MAX, Math.max(QUEST_TOTAL_MIN, target));
	await supplementToCeiling(floorCeiling, 4);

	trimQuestBatchToMax(questsToInsert);
	// If still above target after floor pass (e.g. floor added extras), trim back to target cap.
	while (questsToInsert.length > target) {
		questsToInsert.pop();
	}
}

function pushOneDailyFromRichRow(questsToInsert, q, userId, goalId, now, dayOffset) {
	const date = new Date(now);
	date.setDate(date.getDate() + dayOffset);
	date.setHours(12, 0, 0, 0);
	const briefing = buildBriefingPayloadFromRichQuest(q);
	const trainingTimer = timerConfigForQuestRow(q, "daily");
	questsToInsert.push({
		userId,
		goalId,
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
		...(trainingTimer ? { trainingTimer } : {}),
		briefing: {
			...briefing,
			requirements: "",
		},
		briefingGeneratedAt: new Date(),
		briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
	});
}

async function buildQuestDocumentsFromPlan(
	userId,
	goalId,
	plan,
	deadline,
	supplementCtx = null,
	now = new Date(),
	userForTierCap = null,
	reqForTierCap = null
) {
	const months = estimateGoalHorizonMonths(deadline, "");
	const targetQuestCount = userForTierCap
		? cappedQuestTargetCombinedCount(months, userForTierCap, reqForTierCap)
		: targetCombinedQuestCount(months);
	let { seedPlan, daysToSeed, weeksToSeed, monthsToSeed } = allocateQuestSeedWindowsWithPlan(months, plan);
	({ daysToSeed, weeksToSeed, monthsToSeed } = reconcileWindowsWithTemplateCounts(
		daysToSeed,
		weeksToSeed,
		monthsToSeed,
		seedPlan
	));

	const questsToInsert = [];

	for (let i = 0; i < daysToSeed; i++) {
		addDailyDayAtOffset(questsToInsert, seedPlan, userId, goalId, now, i);
	}

	for (let w = 0; w < weeksToSeed; w++) {
		addWeeklyWeekAtOffset(questsToInsert, seedPlan, userId, goalId, now, w);
	}

	for (let m = 0; m < monthsToSeed; m++) {
		addMonthlyMonthAtOffset(questsToInsert, seedPlan, userId, goalId, now, m);
	}

	trimQuestBatchToMax(questsToInsert);

	await finalizeQuestBatchToTarget(
		questsToInsert,
		seedPlan,
		userId,
		goalId,
		now,
		daysToSeed,
		weeksToSeed,
		monthsToSeed,
		targetQuestCount,
		supplementCtx
	);

	return questsToInsert;
}

/**
 * Regenerate AI plan, replace incomplete quests from today onward, refresh program modules cache.
 * @param {{ skipTopicGate?: boolean, plannerNote?: string, req?: import("express").Request }} options
 */
async function realignGoalQuestsFromAi(user, goalDoc, options = {}) {
	const { skipTopicGate = false, plannerNote, req: reqTier } = options;
	const title = goalDoc.title;
	const description = String(goalDoc.description || "").trim().slice(0, 2000);
	const userProfile = goalDoc.userProfile && typeof goalDoc.userProfile === "object" ? goalDoc.userProfile : null;
	const aiDescription = buildAiDescriptionWithProfile(description, userProfile);
	const deadline = goalDoc.deadline || null;

	if (!skipTopicGate) {
		const topicCheck = await assessGoalFitnessRelevance(String(title), aiDescription);
		if (!topicCheck.ok) {
			const err = new Error("goal_topic_mismatch");
			err.code = "goal_topic_mismatch";
			err.payload = topicCheck;
			throw err;
		}
	}

	const userFresh = await User.findById(user._id).lean();
	const userDbContext = await buildAiQuestPlanContext(user._id, {
		excludeGoalId: goalDoc._id,
		primaryGoal: { title, description },
	});

	const libraryEntries = await findRelevantFitnessLibrary({
		goalTitle: title,
		description,
		limit: 22,
	});
	const libraryContext =
		libraryEntries.length > 0
			? {
					entries: libraryEntries,
					note: "Open-license exercise reference ingested into this app (e.g. wger). Ground quest exercise names and equipment in these rows when relevant.",
				}
			: null;

	const userLevel = calculateLevelFromXp(userFresh?.xp ?? user.xp ?? 0);
	const { plan, system } = await generateFitnessSystemFromRoadmap({
		goalTitle: title,
		currentLevel: userLevel,
		deadlineDate: deadline,
		description: aiDescription,
		userProfile,
		userDbContext,
		libraryContext,
	});

	const snapshotPatch = { fitnessLibraryMatchCount: libraryEntries.length };
	if (system && typeof system === "object") {
		snapshotPatch.fitnessPlanSnapshot = system;
	}
	await Goal.findByIdAndUpdate(goalDoc._id, snapshotPatch);

	const boundary = new Date();
	boundary.setHours(0, 0, 0, 0);
	await Quest.deleteMany({
		goalId: goalDoc._id,
		userId: user._id,
		isCompleted: false,
		date: { $gte: boundary },
	});

	const questsToInsert = await buildQuestDocumentsFromPlan(
		user._id,
		goalDoc._id,
		plan,
		deadline,
		{
			goalTitle: title,
			description,
			currentLevel: userLevel,
			userDbContext,
			libraryContext,
		},
		new Date(),
		user,
		reqTier ?? null
	);
	if (questsToInsert.length) {
		await Quest.insertMany(questsToInsert);
	}

	try {
		await enrichAndPersistGoalProgramModules(goalDoc._id);
	} catch (enr) {
		// eslint-disable-next-line no-console
		console.warn("[goals] program modules enrichment on realign:", enr?.message || enr);
	}

	return { fitnessLibraryMatchCount: libraryEntries.length };
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

/**
 * GET /api/goals/program-modules — stored AI program (schedule + equipment/movement detail). No quest instances.
 */
router.get("/program-modules", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		if (!meetsMinTierWithReq(user, "starter", req)) {
			return res.status(403).json({
				error: "tier_required",
				needsTier: "starter",
				message: "Program schedule insights require Starter or higher.",
			});
		}
		let goals = await Goal.find({ userId: user._id, status: "active" })
			.select("title description deadline createdAt fitnessPlanSnapshot programModulesCache userProfile")
			.sort({ createdAt: 1 })
			.lean();
		for (const g of goals) {
			const ver = g.programModulesCache?.version ?? 0;
			const needs =
				!Array.isArray(g.programModulesCache?.movements) ||
				g.programModulesCache.movements.length === 0 ||
				ver < PROGRAM_MODULES_CACHE_VERSION;
			if (needs) {
				try {
					await enrichAndPersistGoalProgramModules(g._id);
					const fresh = await Goal.findById(g._id).select("programModulesCache").lean();
					g.programModulesCache = fresh?.programModulesCache ?? g.programModulesCache;
				} catch (enr) {
					// eslint-disable-next-line no-console
					console.warn("[goals] program modules enrichment:", enr?.message || enr);
				}
			}
		}
		const modules = await Promise.all(
			goals.map(async (g) => {
				const cache =
					g.programModulesCache && typeof g.programModulesCache === "object" ? g.programModulesCache : null;
				const fullMovements = Array.isArray(cache?.movements) ? cache.movements : [];
				const snap =
					g.fitnessPlanSnapshot && typeof g.fitnessPlanSnapshot === "object" ? g.fitnessPlanSnapshot : null;
				let currentRotationMovements = [];
				try {
					currentRotationMovements = await computeCurrentRotationMovementRows(
						user._id,
						g._id,
						snap,
						fullMovements
					);
				} catch (rot) {
					// eslint-disable-next-line no-console
					console.warn("[goals] current rotation movements:", rot?.message || rot);
				}
				return {
					goalId: String(g._id),
					title: g.title,
					description: String(g.description || "").trim().slice(0, 1200),
					deadline: g.deadline ? new Date(g.deadline).toISOString() : null,
					createdAt: g.createdAt ? new Date(g.createdAt).toISOString() : null,
					fitnessPlanSnapshot: snap,
					userProfile: g.userProfile && typeof g.userProfile === "object" ? g.userProfile : null,
					programModulesCache: cache,
					currentRotationMovements,
				};
			})
		);
		return res.json({ modules });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load program modules" });
	}
});

// POST /api/goals
router.post("/", async (req, res) => {
	try {
		const {
			title,
			rarity: rawRarity,
			deadline: rawDeadline,
			description: rawDescription,
			userProfile: rawUserProfile,
		} = req.body || {};
		if (!title) {
			return res.status(400).json({ error: "title is required" });
		}

		const rarity =
			rawRarity && Object.prototype.hasOwnProperty.call(RARITY_ORDER, String(rawRarity).toLowerCase())
				? String(rawRarity).toLowerCase()
				: "common";

		const user = await getUserForReq(req);
		const priorActiveGoalCount = await Goal.countDocuments({ userId: user._id, status: "active" });
		if (priorActiveGoalCount >= 1 && !meetsMinTierWithReq(user, "starter", req)) {
			return res.status(403).json({
				error: "tier_required",
				needsTier: "starter",
				code: "multi_goals_starter_only",
				message: "Adding another active program requires Starter or higher.",
			});
		}
		const goalCategory = "Fitness";
		const deadline = parseOptionalDate(rawDeadline);
		const description = String(rawDescription || "").trim().slice(0, 2000);
		const userProfile = normalizeUserProfile(rawUserProfile);
		const aiDescription = buildAiDescriptionWithProfile(description, userProfile);

		const topicCheck = await assessGoalFitnessRelevance(String(title), aiDescription);
		if (!topicCheck.ok) {
			return res.status(422).json({
				error: "goal_topic_mismatch",
				message: topicCheck.message,
				suggestions: topicCheck.suggestions,
			});
		}

		const goal = await Goal.create({
			userId: user._id,
			title,
			category: goalCategory,
			rarity,
			description,
			userProfile,
			deadline,
		});

		const userDbContext = await buildAiQuestPlanContext(user._id, {
			excludeGoalId: goal._id,
			primaryGoal: { title, description },
		});

		const libraryEntries = await findRelevantFitnessLibrary({
			goalTitle: title,
			description,
			limit: 22,
		});
		const libraryContext =
			libraryEntries.length > 0
				? {
						entries: libraryEntries,
						note: "Open-license exercise reference ingested into this app (e.g. wger). Ground quest exercise names and equipment in these rows when relevant.",
					}
				: null;

		const userLevel = calculateLevelFromXp(user.xp);
		const { plan, system } = await generateFitnessSystemFromRoadmap({
			goalTitle: title,
			currentLevel: userLevel,
			deadlineDate: deadline,
			description: aiDescription,
			userProfile,
			userDbContext,
			libraryContext,
		});

		const snapshotPatch = { fitnessLibraryMatchCount: libraryEntries.length };
		if (system && typeof system === "object") {
			snapshotPatch.fitnessPlanSnapshot = system;
		}
		await Goal.findByIdAndUpdate(goal._id, snapshotPatch);

		const questsToInsert = await buildQuestDocumentsFromPlan(
			user._id,
			goal._id,
			plan,
			deadline,
			{
				goalTitle: title,
				description,
				currentLevel: userLevel,
				userDbContext,
				libraryContext,
			},
			new Date(),
			user,
			req
		);

		if (questsToInsert.length) {
			await Quest.insertMany(questsToInsert);
		}

		try {
			await enrichAndPersistGoalProgramModules(goal._id);
		} catch (enr) {
			// eslint-disable-next-line no-console
			console.warn("[goals] program modules enrichment on create:", enr?.message || enr);
		}

		if (priorActiveGoalCount === 0) {
			const userDoc = await User.findById(user._id);
			if (userDoc) {
				userDoc.xp = (userDoc.xp || 0) + ONBOARDING_FIRST_PROGRAM_XP;
				userDoc.level = calculateLevelFromXp(userDoc.xp);
				await userDoc.save();
				await History.create({
					userId: user._id,
					type: "first_goal_bonus",
					xpChange: ONBOARDING_FIRST_PROGRAM_XP,
					meta: { title: "Onboarding quest: first training program" },
				});
			}
		}

		const goalsActive = await Goal.find({ userId: user._id, status: "active" }).lean();
		const userForAchievements = await User.findById(user._id);
		const hist = await History.find({ userId: user._id }).lean();
		const questsCompleted = hist.filter((h) => h.type === "quest_complete" && h.xpChange > 0).length;
		const focusXp = hist.filter((h) => h.type === "focus_session").reduce((s, h) => s + (h.xpChange || 0), 0);
		const focusHours = focusXp / (9 * 60);
		await evaluateAndRecordAchievements({
			user: userForAchievements || user,
			goals: goalsActive,
			questsCompleted,
			focusHours,
		});

		const rank = await recalculateAndSaveUserRank(user._id, {
			preferGemini: meetsMinTierWithReq(userForAchievements || user, "elite", req),
		});

		return res.status(201).json({ goalId: goal._id, rank: rank || user.rank || "E" });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to create goal" });
	}
});

// PATCH /api/goals/:id — persist edits; re-run AI quest plan when title, description, or deadline change (Fitness)
router.patch("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid goal id" });
		}
		const user = await getUserForReq(req);
		const goal = await Goal.findOne({ _id: id, userId: user._id, status: "active" });
		if (!goal) {
			return res.status(404).json({ error: "Goal not found" });
		}

		const {
			title: rawTitle,
			description: rawDescription,
			deadline: rawDeadline,
			rarity: rawRarity,
			userProfile: rawUserProfile,
		} = req.body || {};

		const prevTitle = String(goal.title || "").trim();
		const prevDesc = String(goal.description || "").trim();
		const prevProfile =
			goal.userProfile && typeof goal.userProfile === "object" ? normalizeUserProfile(goal.userProfile) : null;
		const prevDeadlineDay =
			goal.deadline && !Number.isNaN(new Date(goal.deadline).getTime())
				? new Date(goal.deadline).toISOString().slice(0, 10)
				: "";

		const mergedTitle = rawTitle != null ? String(rawTitle).trim().slice(0, 500) : prevTitle;
		if (rawTitle != null && !mergedTitle) {
			return res.status(400).json({ error: "title cannot be empty" });
		}
		const mergedDesc =
			rawDescription != null ? String(rawDescription).trim().slice(0, 2000) : prevDesc;
		const mergedDeadline = rawDeadline !== undefined ? parseOptionalDate(rawDeadline) : goal.deadline;
		const mergedDeadlineDay =
			mergedDeadline && !Number.isNaN(new Date(mergedDeadline).getTime())
				? new Date(mergedDeadline).toISOString().slice(0, 10)
				: "";
		const mergedProfile = rawUserProfile !== undefined ? normalizeUserProfile(rawUserProfile) : prevProfile;

		const profileWouldChange =
			rawUserProfile !== undefined &&
			JSON.stringify(mergedProfile || {}) !== JSON.stringify(prevProfile || {});

		const textWouldChange =
			mergedTitle !== prevTitle ||
			mergedDesc !== prevDesc ||
			mergedDeadlineDay !== prevDeadlineDay ||
			profileWouldChange;

		if (textWouldChange && (rawTitle != null || rawDescription != null)) {
			const aiDescription = buildAiDescriptionWithProfile(mergedDesc, mergedProfile);
			const topicCheck = await assessGoalFitnessRelevance(mergedTitle, aiDescription);
			if (!topicCheck.ok) {
				return res.status(422).json({
					error: "goal_topic_mismatch",
					message: topicCheck.message,
					suggestions: topicCheck.suggestions,
				});
			}
		}

		if (rawTitle != null) goal.title = mergedTitle;
		if (rawDescription != null) goal.description = mergedDesc;
		if (rawDeadline !== undefined) goal.deadline = mergedDeadline;
		if (rawUserProfile !== undefined) goal.userProfile = mergedProfile;
		if (rawRarity != null && Object.prototype.hasOwnProperty.call(RARITY_ORDER, String(rawRarity).toLowerCase())) {
			goal.rarity = String(rawRarity).toLowerCase();
		}

		await goal.save();

		let realigned = false;
		if (textWouldChange && String(goal.category || "").toLowerCase() === "fitness") {
			if (!meetsMinTierWithReq(user, "starter", req)) {
				realigned = false;
			} else {
				try {
					await realignGoalQuestsFromAi(user, goal, { skipTopicGate: true, req });
					realigned = true;
				} catch (e) {
					if (e?.code === "goal_topic_mismatch") {
						return res.status(422).json({
							error: "goal_topic_mismatch",
							message: e.payload?.message,
							suggestions: e.payload?.suggestions ?? [],
						});
					}
					throw e;
				}
			}
		}

		const fresh = await Goal.findById(goal._id).lean();
		return res.json({ ok: true, goal: fresh, realigned });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to update goal" });
	}
});

// POST /api/goals/:id/refresh-quests — regenerate AI plan + replace incomplete future quests for this goal
router.post("/:id/refresh-quests", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid goal id" });
		}
		const user = await getUserForReq(req);
		const goal = await Goal.findOne({ _id: id, userId: user._id, status: "active" });
		if (!goal) {
			return res.status(404).json({ error: "Goal not found" });
		}
		if (String(goal.category || "").toLowerCase() !== "fitness") {
			return res.status(400).json({ error: "Quest refresh applies to fitness goals only" });
		}
		if (!meetsMinTierWithReq(user, "starter", req)) {
			return res.status(403).json({
				error: "tier_required",
				needsTier: "starter",
				message: "AI quest regeneration requires Starter or higher.",
			});
		}

		try {
			await realignGoalQuestsFromAi(user, goal, { req });
		} catch (e) {
			if (e?.code === "goal_topic_mismatch") {
				return res.status(422).json({
					error: "goal_topic_mismatch",
					message: e.payload?.message,
					suggestions: e.payload?.suggestions ?? [],
				});
			}
			throw e;
		}

		const fresh = await Goal.findById(goal._id).lean();
		return res.json({ ok: true, goal: fresh });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to refresh quests" });
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

