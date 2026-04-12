/**
 * Deterministic penalty / discipline protocols shown in place of the main quest while it is incomplete.
 * Quests no longer expire; completing the card awards the quest's normal XP (you execute the penalty protocol first).
 */

function stepsFromHowTo(howTo, doneWhen) {
	const raw = String(howTo || "").trim();
	let steps = raw
		.split(/\n{2,}|\r\n\r\n/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (steps.length < 2) {
		steps = raw
			.split(/\n/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	if (steps.length < 1) steps = [raw];
	const dw = String(doneWhen || "").trim();
	if (dw) {
		const line = /^Success criterion:/i.test(dw) ? dw : `Success criterion: ${dw}`;
		steps.push(line);
	}
	return steps.slice(0, 14).map((s) => s.slice(0, 1200));
}

function tier(difficulty) {
	const d = String(difficulty || "medium").toLowerCase();
	if (d === "easy") return 0;
	if (d === "hard") return 2;
	return 1;
}

const STAT = { str: "str", int: "int", agi: "agi", vit: "vit" };

/** @param {{ type: string, difficulty?: string, statType?: string }} q */
export function buildStoredPenaltyForQuest(q) {
	const tf = q.type === "weekly" ? "weekly" : q.type === "monthly" ? "monthly" : "daily";
	const t = tier(q.difficulty);
	const st = STAT[q.statType] || "str";

	/** @type {Record<string, Record<number, Record<string, { title: string, howTo: string, doneWhen: string }>>>} */
	const table = {
		daily: {
			0: {
				str: {
					title: "Penalty: Execute 30 push-ups in 3 sets of 10 with 90 seconds rest",
					howTo:
						"Warm up 3 minutes with arm circles and thoracic rotations. Set 1: 10 push-ups with full ROM, rest 90 seconds. Set 2: 10 push-ups, rest 90 seconds. Set 3: 10 push-ups. Log set counts and rest times on one line.",
					doneWhen: "30 push-ups completed with 3 logged sets and timestamps.",
				},
				int: {
					title: "Penalty: Write 250 words auditing yesterday's execution failures",
					howTo:
						"Open one document. Minute 0–8 list 5 concrete failures from yesterday (missed task, late block, skipped quest). Minute 8–20 write one corrective command per failure with a number (minutes, reps, or count). Minute 20–25 read aloud once.",
					doneWhen: "One document ≥250 words with 5 failures and 5 numbered corrective commands.",
				},
				agi: {
					title: "Penalty: 12-minute footwork drill — 40 high-knees × 4 rounds, 60s rest",
					howTo:
						"Set one timer for 12 minutes. Rounds 1–4: perform 40 high-knees counting aloud, then rest exactly 60 seconds. Record round completion times on one line.",
					doneWhen: "4 rounds logged with 40 knees each and 60s rests noted.",
				},
				vit: {
					title: "Penalty: Hydration and sleep log — 500ml water × 4 within 6 hours + bedtime",
					howTo:
						"Between wake and 6 hours later: drink 500ml water at hour 0, 2, 4, and 6 (use one bottle marked in ml). Before sleep write lights-out time and wake time target on one line.",
					doneWhen: "4 hydration timestamps and one lights-out line recorded same day.",
				},
			},
			1: {
				str: {
					title: "Penalty: Execute 50 bodyweight squats + 30 push-ups in one session",
					howTo:
						"10-minute cap after warm-up. Perform 50 squats (any depth standard you can repeat) in sets of 10 with 45s rest, then 30 push-ups in sets of 10 with 60s rest. No phone until finished. Log total minutes.",
					doneWhen: "80 total reps completed and session duration written.",
				},
				int: {
					title: "Penalty: Execute 45-minute deep-work block on the linked goal only",
					howTo:
						"Single timer 45 minutes. One tab or one offline artifact only. Produce one dated output: 15 bullet facts, 10 action lines, 5 risks with mitigations. Save filename includes today's date.",
					doneWhen: "One file exists with 30 lines minimum and date in name.",
				},
				agi: {
					title: "Penalty: 8,000 steps + 3×60s plank with 90s rest",
					howTo:
						"Complete 8000 steps tracked in one app export screenshot. Then 3 plank holds of 60 seconds with 90 seconds walking rest between. Log step count and each plank second count.",
					doneWhen: "Screenshot shows ≥8000 steps and plank times logged.",
				},
				vit: {
					title: "Penalty: Cold exposure 60s + 20-minute walk same day",
					howTo:
						"Cold shower or cold water immersion on arms/face for 60 continuous seconds (timer visible). Within 8 hours walk 20 minutes at brisk pace. Log both with times.",
					doneWhen: "Two timestamps: cold 60s completed, walk 20 minutes completed.",
				},
			},
			2: {
				str: {
					title: "Penalty: Execute 100 burpees partitioned 5×20 with 120s between sets",
					howTo:
						"Warm-up 5 minutes. Sets 1–5: 20 burpees each, 120 seconds rest between sets. If form breaks, pause timer until 20 reps are clean. Log each set finish time.",
					doneWhen: "100 burpees logged in 5 sets with rest periods noted.",
				},
				int: {
					title: "Penalty: Produce 90-minute analysis — 600 words + 10 numbered sources",
					howTo:
						"90-minute single sitting. 600 words minimum on one obstacle blocking the linked goal. Include 10 numbered sources (book page, URL, or dataset name). End with 3 immediate next commands with durations.",
					doneWhen: "One document ≥600 words, 10 sources, 3 timed next commands.",
				},
				agi: {
					title: "Penalty: 5 km walk or jog continuous — no pauses over 60s",
					howTo:
						"Track distance in one app. Maintain movement except pauses ≤60 seconds for water. Screenshot summary with distance and elapsed time.",
					doneWhen: "One export shows ≥5.0 km and total elapsed time.",
				},
				vit: {
					title: "Penalty: Zero alcohol/sugar today + 8 hours time-in-bed",
					howTo:
						"Declare start time. Consume no alcohol and no added sugar until sleep. In bed with lights off for 8 hours (alarm set). Morning log: in-bed time, out-of-bed time.",
					doneWhen: "Written log confirms 8h window in bed and compliance statement.",
				},
			},
		},
		weekly: {
			0: {
				str: {
					title: "Penalty: 4×45 min strength sessions this week (log each)",
					howTo:
						"Schedule 4 sessions before Sunday 23:59. Each 45 minutes: 10m warm-up, 30m main lifts or calisthenics volume, 5m cool-down. Log date, exercises, sets×reps for each session in one file.",
					doneWhen: "4 dated session logs in one file before week end.",
				},
				int: {
					title: "Penalty: 1,200 words + 1 scored self-test on the linked goal",
					howTo:
						"Write 1200 words across ≤3 sittings building one artifact toward the goal. Create 20 quiz items; score yourself; miss ≤3 or repeat until pass. Save both in one folder.",
					doneWhen: "Word doc ≥1200 words and answer key with score ≤3 misses.",
				},
				agi: {
					title: "Penalty: 50,000 steps this week + 4 mobility sessions ×15 min",
					howTo:
						"Track weekly steps; screenshot weekly total ≥50000. Four separate 15-minute mobility sessions (hips, T-spine, ankles, shoulders) logged with dates.",
					doneWhen: "Step screenshot + 4 mobility logs submitted in one note.",
				},
				vit: {
					title: "Penalty: 7-day sleep window — same wake ±30 min + 7 logs",
					howTo:
						"Pick one wake time. Wake within ±30 minutes all 7 days. Log wake time and subjective focus 0–10 daily.",
					doneWhen: "7 lines of wake times within ±30m and 7 focus scores.",
				},
			},
			1: {
				str: {
					title: "Penalty: Weekly volume — 200 reps lower body + 150 reps upper in logs",
					howTo:
						"Across Mon–Sun accumulate 200 lower-body reps (squat/lunge/hinge) and 150 upper-body reps (push/pull) with form standard you can repeat. Spread across ≥3 days. One spreadsheet with daily subtotals summing to targets.",
					doneWhen: "Spreadsheet shows daily splits totaling ≥200 and ≥150.",
				},
				int: {
					title: "Penalty: Ship one deliverable draft (≥2 hours) tied to the goal",
					howTo:
						"One draft artifact (doc, deck, code branch, or sheet) requiring ≥2 hours tracked in one timer log. Filename includes week date range. Share or store in one known folder.",
					doneWhen: "File exists with time log ≥120 minutes and week in title.",
				},
				agi: {
					title: "Penalty: 3×5 km sessions + 2×30 min skill footwork sessions",
					howTo:
						"Three separate days: 5 km each (tracked). Two days: 30 minutes footwork or agility ladder drills. Log distances and drill dates.",
					doneWhen: "5 sessions logged meeting distances/durations.",
				},
				vit: {
					title: "Penalty: Meal prep 10 protein portions + alcohol-free week",
					howTo:
						"Prepare 10 equal protein portions (weighed once) stored labeled. Zero alcohol Mon–Sun. Daily checkbox note.",
					doneWhen: "Photo of 10 containers + 7 checkmarks for alcohol-free.",
				},
			},
			2: {
				str: {
					title: "Penalty: 6×60 min training blocks + 1 test set (AMRAP or timed hold)",
					howTo:
						"Six hours total training across the week in blocks ≥60 minutes. End week with one test: either max reps in 5 minutes of one movement or max plank hold. Log hours and test result.",
					doneWhen: "6 hour-logs + one test number recorded.",
				},
				int: {
					title: "Penalty: 2,500-word execution memo + 60-minute teach-aloud recording",
					howTo:
						"Write 2500 words: plan, risks, calendar blocks, metrics. Record yourself reading the summary for 60 minutes max (stop early if done). Store audio + doc in one folder.",
					doneWhen: "Doc word count ≥2500 and audio file duration logged.",
				},
				agi: {
					title: "Penalty: 30 km total running/walking + 4 hill repeats session",
					howTo:
						"Week total ≥30 km tracked. One session: 4 hill repeats (walk/jog up, easy down) with heart rate note each. Export weekly distance.",
					doneWhen: "Weekly export ≥30 km + repeat session notes.",
				},
				vit: {
					title: "Penalty: 10 nights in-bed ≥7.5h + daily veg servings tracked",
					howTo:
						"10 consecutive or weekly nights: time in bed ≥7.5 hours logged. Each day log ≥3 vegetable servings with examples.",
					doneWhen: "10 sleep lines + 10 veg lines minimum.",
				},
			},
		},
		monthly: {
			0: {
				str: {
					title: "Penalty: 16 hour-long workouts logged this month",
					howTo:
						"Spread 16 sessions across the month; each ≥55 minutes active work. One calendar or sheet with dates and workout type per row.",
					doneWhen: "16 dated rows each ≥55 minutes work.",
				},
				int: {
					title: "Penalty: One 15-page equivalent deep dossier on the goal domain",
					howTo:
						"~3750 words or 15 pages structured: overview, constraints, plan, metrics, review cadence. Table of contents required.",
					doneWhen: "Single PDF or doc meeting length and sections.",
				},
				agi: {
					title: "Penalty: 120 km locomotion this month (tracked)",
					howTo:
						"Run/walk/hike totaling ≥120 km in one monthly export. Minimum 12 active days.",
					doneWhen: "Export shows ≥120 km and ≥12 days with activity.",
				},
				vit: {
					title: "Penalty: 25 nights sleep log + monthly blood pressure 7-day average",
					howTo:
						"Log 25 nights with sleep window. Take BP morning and evening for 7 consecutive days; compute average systolic/diastolic.",
					doneWhen: "25 sleep lines + 14 BP readings + averages written.",
				},
			},
			1: {
				str: {
					title: "Penalty: Progressive test — start and end month strength benchmark",
					howTo:
						"Day 1 and last day: same test (e.g., max push-ups in 2 min or 5RM squat). Video or witness note optional. Log both scores.",
					doneWhen: "Two dated scores for the same test.",
				},
				int: {
					title: "Penalty: 40 hours tracked on the linked goal in one timesheet",
					howTo:
						"Log in 30-minute minimum blocks across the month. Sum must reach 40 hours. Export or screenshot totals.",
					doneWhen: "Timesheet totals ≥40 hours with dated blocks.",
				},
				agi: {
					title: "Penalty: Complete one timed 10 km event + 8 weeks of 2 speed sessions/wk notes",
					howTo:
						"Race or solo timed 10 km with recorded time. Across the month, 8 sessions labeled 'speed' with duration and distance or intervals noted.",
					doneWhen: "10 km time logged + 8 speed session lines.",
				},
				vit: {
					title: "Penalty: Body comp or waist measure day 1 and day 28 + food log 20 days",
					howTo:
						"Measure waist same time of day twice. Log meals on 20 distinct days with calorie estimate or portions.",
					doneWhen: "Two waist measures + 20 dated food logs.",
				},
			},
			2: {
				str: {
					title: "Penalty: 24 sessions ≥45 min + deload week protocol written",
					howTo:
						"24 training sessions. One week must be deload (≤50% usual volume) with written rules before starting that week.",
					doneWhen: "24 logs + one deload plan document.",
				},
				int: {
					title: "Penalty: Publish or share one artifact publicly (post, repo, or PDF)",
					howTo:
						"Ship one artifact tied to the goal with a public URL or file share link. Include 300-word README of intent and metrics.",
					doneWhen: "Link live + README word count ≥300.",
				},
				agi: {
					title: "Penalty: Monthly mileage 200 km + longest single session 25 km",
					howTo:
						"Track monthly total ≥200 km. One outing ≥25 km continuous movement.",
					doneWhen: "Monthly export + long session note.",
				},
				vit: {
					title: "Penalty: 30-day no-ultraprocessed challenge with daily photo log",
					howTo:
						"Define banned items in writing. 30 daily photos of meals. If any slip, restart count from day 1.",
					doneWhen: "30 consecutive compliant photos or documented restart chain to 30.",
				},
			},
		},
	};

	const pack = table[tf]?.[t]?.[st] || table.daily[1].str;
	const howTo = pack.howTo;
	const doneWhen = /^Success criterion:/i.test(pack.doneWhen)
		? pack.doneWhen
		: `Success criterion: ${pack.doneWhen}`;
	return {
		title: pack.title,
		summary: pack.title,
		howTo,
		doneWhen,
		steps: stepsFromHowTo(howTo, doneWhen),
		whatYouImprove:
			"Penalty protocol — execute fully, then mark this quest complete for standard XP. Main quest text is withheld until completion.",
	};
}

/** @param {Record<string, unknown>} q */
export function resolvePenaltyForQuest(q) {
	const p = q.penalty;
	if (p && String(p.title || "").trim()) {
		const howTo = String(p.howTo || "").trim();
		const doneWhen = String(p.doneWhen || "").trim();
		return {
			title: String(p.title).trim(),
			summary: String(p.summary || p.title || "").trim(),
			howTo,
			doneWhen: doneWhen
				? /^Success criterion:/i.test(doneWhen)
					? doneWhen
					: `Success criterion: ${doneWhen}`
				: "",
			steps:
				Array.isArray(p.steps) && p.steps.length
					? p.steps.map((s) => String(s))
					: stepsFromHowTo(howTo, doneWhen),
			whatYouImprove: String(
				p.whatYouImprove ||
					"Penalty protocol — execute fully before marking this quest complete."
			).trim(),
		};
	}
	return buildStoredPenaltyForQuest({
		type: q.type || "daily",
		difficulty: q.difficulty,
		statType: q.statType,
	});
}

export function executionPreviewFromHowTo(howTo, maxLen = 420) {
	const h = String(howTo || "").trim();
	if (!h) return "";
	return h.length > maxLen ? `${h.slice(0, maxLen - 1)}…` : h;
}
