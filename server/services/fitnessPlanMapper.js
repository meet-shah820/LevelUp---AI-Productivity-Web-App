/**
 * Maps Gemini fitness-program JSON (user schema) into the app's rich quest plan shape.
 */

function normalizeStatType(raw) {
	const s = String(raw ?? "")
		.toLowerCase()
		.trim();
	if (["str", "int", "agi", "vit"].includes(s)) return s;
	const map = { strength: "str", intelligence: "int", agility: "agi", vitality: "vit" };
	return map[s] || "str";
}

function normalizeDifficulty(raw) {
	const s = String(raw ?? "")
		.toLowerCase()
		.trim();
	if (["easy", "medium", "hard"].includes(s)) return s;
	return "medium";
}

function inferStatFromMovement(name) {
	const n = String(name || "").toLowerCase();
	if (/\b(run|jog|bike|row|cardio|skip|jump|sprint|walk|steps)\b/.test(n)) return "agi";
	if (/\b(plank|sleep|hydrat|breath|stretch|mobility|yoga|recovery)\b/.test(n)) return "vit";
	if (/\b(log|track|plan|journal|measure|test)\b/.test(n)) return "int";
	return "str";
}

function formatWorkoutLines(workout) {
	if (!Array.isArray(workout) || workout.length === 0) return "";
	return workout
		.map((w) => {
			const name = String(w?.name || "Exercise").trim();
			const equip = String(w?.equipment || "").trim();
			const sets = Number(w?.sets) || 0;
			const reps = String(w?.reps ?? "").trim() || "?";
			const rest = Number(w?.rest_seconds) || 0;
			const cues = String(w?.form_cues || "").trim();
			const inj = String(w?.injury_prevention || "").trim();
			const head = equip ? `${name} (${equip})` : name;
			const line = `${head}: ${sets} sets × ${reps} reps, rest ${rest}s.`;
			const parts = [cues ? `${line} Cues: ${cues}` : line];
			if (inj) parts.push(`Injury prevention: ${inj}`);
			return parts.join(" ");
		})
		.join("\n");
}

function mapDaily(dq, goalTitle, indexInArray = 0) {
	const day = Number(dq?.day) || indexInArray + 1;
	const titleRaw = String(dq?.title || "").trim();
	const title =
		titleRaw.length > 0
			? titleRaw.slice(0, 160)
			: `Day ${day} training mission`.slice(0, 160);
	const objective = String(dq?.objective || "").trim();
	const workout = formatWorkoutLines(dq?.workout);
	const completion = String(dq?.completion_rule || dq?.completionRule || "").trim();
	const tip = String(dq?.motivation_tip || dq?.motivationTip || "").trim();

	const parts = [objective && `OBJECTIVE\n${objective}`, workout && `WORKOUT\n${workout}`, tip && `EXECUTION NOTE\n${tip}`].filter(
		Boolean
	);
	let instructions =
		parts.join("\n\n") || `Complete the training mission for day ${day} toward: ${String(goalTitle).slice(0, 200)}.`;
	if (instructions.length < 60) {
		instructions += `\n\nSESSION LOG: Record each exercise with sets, reps (or seconds), and rest used in one dated line.`;
	}

	const firstName = Array.isArray(dq?.workout) && dq.workout[0]?.name ? String(dq.workout[0].name) : title;
	const statType = inferStatFromMovement(firstName);

	/** First sessions Easy, then Medium, then Hard — stable by template order (not AI day numbers). */
	const difficulty = indexInArray < 2 ? "easy" : indexInArray < 6 ? "medium" : "hard";

	return {
		title,
		instructions: instructions.slice(0, 12000),
		completionStandard: completion || `Success criterion: Log session for day ${day} with sets/reps or duration completed as written.`,
		statType,
		xp: day % 3 === 0 ? 72 : day % 2 === 0 ? 65 : 58,
		difficulty,
	};
}

function mapWeekly(wq, idx) {
	const week = Number(wq?.week) || idx + 1;
	const objective = String(wq?.objective || "").trim();
	const success = String(wq?.success_criteria || wq?.successCriteria || "").trim();
	const adapt = String(wq?.expected_adaptation || wq?.expectedAdaptation || "").trim();
	const title = `Week ${week} checkpoint`.slice(0, 160);
	const instructions = [objective && `WEEKLY OBJECTIVE\n${objective}`, success && `COMPLETION CONDITIONS\n${success}`, adapt && `EXPECTED ADAPTATION\n${adapt}`]
		.filter(Boolean)
		.join("\n\n")
		.slice(0, 12000);

	return {
		title,
		instructions: instructions.length >= 55 ? instructions : `${instructions}\n\nMeasurable: Log 3+ sessions and one weekly metric (load, reps, or time) vs prior week.`,
		completionStandard:
			success && !/^Success criterion:/i.test(success)
				? `Success criterion: ${success}`
				: success || `Success criterion: Week ${week} criteria logged with numbers (sessions, load, or time).`,
		statType: week % 4 === 0 ? "vit" : week % 3 === 0 ? "agi" : "str",
		xp: 200 + week * 15,
		difficulty: idx < 1 ? "easy" : idx < 4 ? "medium" : "hard",
	};
}

function mapMonthly(mq, idx) {
	const month = Number(mq?.month) || idx + 1;
	const goal = String(mq?.goal || "").trim();
	const targets = String(mq?.progress_targets || mq?.progressTargets || "").trim();
	const consistency = String(mq?.consistency_requirement || mq?.consistencyRequirement || "").trim();
	const title = `Month ${month} milestone`.slice(0, 160);
	const instructions = [goal && `MONTHLY GOAL\n${goal}`, targets && `PROGRESS TARGETS\n${targets}`, consistency && `CONSISTENCY\n${consistency}`]
		.filter(Boolean)
		.join("\n\n")
		.slice(0, 12000);

	return {
		title,
		instructions: instructions.length >= 55 ? instructions : `${instructions}\n\nMeasurable: One performance test plus 12+ logged training days in the month.`,
		completionStandard:
			consistency && !/^Success criterion:/i.test(consistency)
				? `Success criterion: ${consistency}`
				: targets && !/^Success criterion:/i.test(targets)
					? `Success criterion: ${targets}`
					: `Success criterion: Month ${month} milestone documented with test numbers and training log.`,
		statType: month % 2 === 0 ? "str" : "agi",
		xp: 400 + month * 40,
		difficulty: idx < 1 ? "easy" : idx < 3 ? "medium" : "hard",
	};
}

/**
 * @param {Record<string, unknown>} raw - Parsed AI JSON (snake_case or camelCase keys)
 * @param {string} goalTitle
 * @param {{ dailyTarget: number, weeklyTarget: number, monthlyTarget: number }} counts
 * @returns {{ plan: object, fitnessSnapshot: object|null }}
 */
export function mapFitnessAiJsonToPlan(raw, goalTitle, counts) {
	const profile = raw?.user_profile || raw?.userProfile || {};
	const goalFromProfile = String(profile?.goal || "").trim();
	const level = String(profile?.level || "").trim();
	const dpw = Number(profile?.days_per_week || profile?.daysPerWeek) || null;

	const dailySrc = Array.isArray(raw?.daily_quests) ? raw.daily_quests : Array.isArray(raw?.dailyQuests) ? raw.dailyQuests : [];
	const weeklySrc = Array.isArray(raw?.weekly_quests) ? raw.weekly_quests : Array.isArray(raw?.weeklyQuests) ? raw.weeklyQuests : [];
	const monthlySrc = Array.isArray(raw?.monthly_quests) ? raw.monthly_quests : Array.isArray(raw?.monthlyQuests) ? raw.monthlyQuests : [];

	let dailyQuests = dailySrc.map((d, i) => mapDaily(d, goalTitle, i)).filter((q) => q.title && q.instructions.length >= 40);
	let weeklyQuests = weeklySrc.map((w, i) => mapWeekly(w, i)).filter((q) => q.title && q.instructions.length >= 40);
	let monthlyQuests = monthlySrc.map((m, i) => mapMonthly(m, i)).filter((q) => q.title && q.instructions.length >= 40);

	const dt = Math.max(2, Math.min(15, counts.dailyTarget));
	const wt = Math.max(2, Math.min(12, counts.weeklyTarget));
	const mt = Math.max(1, Math.min(8, counts.monthlyTarget));

	if (dailyQuests.length > dt) dailyQuests = dailyQuests.slice(0, dt);
	if (weeklyQuests.length > wt) weeklyQuests = weeklyQuests.slice(0, wt);
	if (monthlyQuests.length > mt) monthlyQuests = monthlyQuests.slice(0, mt);

	const recovery = raw?.recovery_logic || raw?.recoveryLogic || null;

	const progressionRule = recovery?.trigger_condition
		? String(recovery.trigger_condition).slice(0, 800)
		: "If a daily or weekly quest is missed, complete the assigned Recovery Quest (reduced volume) before resuming full progression.";

	const plan = {
		goalRestated: goalFromProfile || String(goalTitle).trim().slice(0, 500),
		currentPhase: "Foundation",
		progressionRule,
		dailyQuests: dailyQuests.map((q) => ({
			title: q.title,
			statType: normalizeStatType(q.statType),
			xp: q.xp,
			difficulty: normalizeDifficulty(q.difficulty),
			instructions: q.instructions,
			completionStandard: q.completionStandard,
		})),
		weeklyQuests: weeklyQuests.map((q) => ({
			title: q.title,
			statType: normalizeStatType(q.statType),
			xp: q.xp,
			difficulty: normalizeDifficulty(q.difficulty),
			instructions: q.instructions,
			completionStandard: q.completionStandard,
		})),
		monthlyQuests: monthlyQuests.map((q) => ({
			title: q.title,
			statType: normalizeStatType(q.statType),
			xp: q.xp,
			difficulty: normalizeDifficulty(q.difficulty),
			instructions: q.instructions,
			completionStandard: q.completionStandard,
		})),
	};

	const capArr = (arr, max) => (Array.isArray(arr) ? arr.slice(0, max) : []);
	const fitnessSnapshot = {
		user_profile: {
			goal: goalFromProfile || goalTitle,
			level: level || "beginner to intermediate",
			days_per_week: dpw ?? undefined,
		},
		recovery_logic: recovery || undefined,
		/** Raw AI program for Program modules UI (equipment + schedule copy). */
		daily_quests: capArr(dailySrc, 45),
		weekly_quests: capArr(weeklySrc, 14),
		monthly_quests: capArr(monthlySrc, 10),
	};

	return { plan, fitnessSnapshot };
}
