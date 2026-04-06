import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
let genAI;
if (apiKey) {
	genAI = new GoogleGenerativeAI(apiKey);
}

function normalizeStatType(raw) {
	const s = String(raw ?? "")
		.toLowerCase()
		.trim();
	if (["str", "int", "agi", "vit"].includes(s)) return s;
	const map = { strength: "str", intelligence: "int", agility: "agi", vitality: "vit" };
	return map[s] || "str";
}

/** Effort / time — NOT the same as timeframe (daily/weekly/monthly). */
function normalizeDifficulty(raw) {
	const s = String(raw ?? "")
		.toLowerCase()
		.trim();
	if (["easy", "medium", "hard"].includes(s)) return s;
	return "medium";
}

/** No assistant voice: advice, motivation, vague growth language. */
const BANNED_SOFT_LANGUAGE =
	/\b(improve|improving|learn|learning|practice|practicing|try\b|should|could|maybe|perhaps|journey|mindset|motivat|inspire|believes?|consider|thinking about|work on|get better|enhance|develop|developing|advice|tips?|explain|suggestion|recommend|hopefully|you can|you might|remember to|don't forget|it's important|great job|keep up|stay positive)\b/i;

function titleHasNumericRequirement(title) {
	return /\d/.test(String(title || ""));
}

function textHasMeasurableSignal(text) {
	const s = String(text || "");
	if (/\d/.test(s)) return true;
	return /\b(minutes?|hours?|seconds?|reps?|sets?|times|rounds|pages|words|ml|oz|lb|kg|steps|calories|%)\b/i.test(
		s
	);
}

/** Titles must not hide the real work behind generic placeholders. */
const VAGUE_QUEST_PLACEHOLDERS =
	/\b(personal task|training drill|\ba drill\b|generic task|some task|checklist line item|related work|your work)\b/i;

function normalizeCompact(s) {
	return String(s || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

/** True if the title repeats or quotes the goal — forbidden (goal is shown in the UI). */
function titleEmbedsGoalText(title, goalTitle) {
	const t = normalizeCompact(title);
	const g = normalizeCompact(goalTitle);
	if (g.length < 10) return false;
	if (t.includes(g)) return true;
	const head = g.slice(0, Math.min(42, g.length));
	if (head.length >= 14 && t.includes(head)) return true;
	return /\btoward\s+['"][^'"]{10,}['"]/i.test(title);
}

function inferDomain(goalTitle, category) {
	const s = `${goalTitle} ${category}`.toLowerCase();
	if (
		/\b(car|vehicle|lambo|auto|motorcycle|boat|buy|purchase|save|savings|money|finance|invest|debt|loan|fund|apr|mortgage|down payment|luxury|bank|credit|tax|401k|ira|dividend|stock|bond|crypto|invoice|profit|revenue|earn|income|business|startup|llc|sell|customer|brand|launch|franchise)\b/.test(
			s
		)
	)
		return "money";
	if (/\b(run|gym|fitness|muscle|weight|marathon|squat|deadlift|pushup|health|workout|plank|body)\b/.test(s))
		return "fitness";
	if (/\b(exam|study|degree|course|language|code|learn|book|chapter|quiz|certification)\b/.test(s))
		return "study";
	return "general";
}

/** Quest content must match inferred goal domain (no random fitness rows for a money goal). */
function titleMatchesDomain(title, goalTitle, category) {
	const dom = inferDomain(goalTitle, category || "general");
	const t = String(title).toLowerCase();
	if (dom === "money") {
		return /\$|€|£|%|\b(apr|savings|deposit|loan|cost|payment|balance|invoice|budget|spreadsheet|transfer|quote|insurance|revenue|llc|bank|credit|invest|fund|tax|price|listing|income|expense|profit|customer|pitch|register|ein|cashflow|ledger|dividend|broker|model|dealer|vehicle|financing|lease|down)\b/i.test(
			t
		);
	}
	if (dom === "fitness") {
		return /\b(rep|set|minute|km|mile|lb|kg|walk|run|plank|squat|pushup|session|steps|cardio|stretch)\b/i.test(t);
	}
	if (dom === "study") {
		return /\b(page|word|chapter|quiz|course|note|exam|problem|minute|flashcard|lecture)\b/i.test(t);
	}
	return true;
}

function validateQuestBatch(rows, goalTitle, category) {
	const errors = [];
	const cat = category || "general";
	if (!rows || rows.length < 5) errors.push("expected 5 quests");
	(rows || []).forEach((q, i) => {
		const t = String(q?.title || "");
		if (!titleHasNumericRequirement(t)) errors.push(`quest[${i}] title must include a digit (time, count, quantity)`);
		if (BANNED_SOFT_LANGUAGE.test(t)) errors.push(`quest[${i}] title contains banned vague/motivational wording`);
		if (VAGUE_QUEST_PLACEHOLDERS.test(t)) {
			errors.push(`quest[${i}] title uses placeholder wording — name the exact task, drill, file, or amount for the goal`);
		}
		if (titleEmbedsGoalText(t, goalTitle)) {
			errors.push(`quest[${i}] title must not quote or paste the goal — keep it short; the app shows the goal separately`);
		}
		if (t.length > 118) {
			errors.push(`quest[${i}] title too long — use a short imperative under ~95 characters`);
		}
		if (!titleMatchesDomain(t, goalTitle, cat)) {
			errors.push(
				`quest[${i}] title must match the goal domain (e.g. finance for money or purchase goals — not unrelated exercises)`
			);
		}
	});
	return { ok: errors.length === 0, errors };
}

function briefingPassesSystemRules(parsed) {
	if (!parsed) return false;
	const fields = [parsed.summary, parsed.whatYouImprove, parsed.doneWhen, ...(parsed.steps || [])].join(
		" "
	);
	if (BANNED_SOFT_LANGUAGE.test(fields)) return false;
	const steps = parsed.steps || [];
	if (steps.length < 1 || steps.length > 6) return false;
	if (!String(parsed.whatYouImprove || "").trim()) return false;
	const dw = String(parsed.doneWhen || "").trim();
	if (!/^Success criterion:/i.test(dw)) return false;
	if (!textHasMeasurableSignal(dw)) return false;
	return true;
}

function sanitizeQuestRows(rows) {
	return (rows || [])
		.filter((q) => q && q.title && q.statType != null)
		.map((q) => ({
			title: String(q.title).slice(0, 110),
			statType: normalizeStatType(q.statType),
			xp: Math.max(10, Number(q.xp) || 50),
			difficulty: normalizeDifficulty(q.difficulty),
		}));
}

/**
 * Ensures at least one easy, one medium, and one hard when length >= 3.
 * Mutates copies of rows only (returns new array).
 */
export function ensureDifficultyMix(rows) {
	if (!rows?.length) return rows || [];
	const out = rows.map((r) => ({ ...r }));
	if (out.length < 3) return out;

	const count = () => ({
		easy: out.filter((q) => q.difficulty === "easy").length,
		medium: out.filter((q) => q.difficulty === "medium").length,
		hard: out.filter((q) => q.difficulty === "hard").length,
	});
	let c = count();
	const tiers = ["easy", "medium", "hard"];

	for (const need of tiers) {
		while (c[need] < 1) {
			const donor = tiers.find((t) => t !== need && c[t] > 0);
			if (!donor) break;
			const idx = out.findIndex((q) => q.difficulty === donor);
			if (idx === -1) break;
			out[idx] = { ...out[idx], difficulty: need };
			c = count();
		}
	}
	return out;
}

/**
 * When taking a subset of quests (e.g. 3 weekly from 5), prefer picks that cover easy/medium/hard first.
 */
export function pickQuestsBalancedByDifficulty(rows, n) {
	if (!rows?.length || n <= 0) return [];
	if (rows.length <= n) return rows.slice(0, n);
	const source = ensureDifficultyMix(rows.map((r) => ({ ...r })));
	const picked = [];
	const usedIdx = new Set();
	const tierOrder = ["easy", "medium", "hard"];
	for (const tier of tierOrder) {
		if (picked.length >= n) break;
		const idx = source.findIndex((q, i) => !usedIdx.has(i) && q.difficulty === tier);
		if (idx !== -1) {
			usedIdx.add(idx);
			picked.push(source[idx]);
		}
	}
	for (let i = 0; i < source.length && picked.length < n; i++) {
		if (!usedIdx.has(i)) {
			usedIdx.add(i);
			picked.push(source[i]);
		}
	}
	return picked.slice(0, n);
}

/** Offline quests: short titles, no goal name; domain matches goal+category; staircase progression. */
function fallbackQuests(goalTitle, category, timeframe) {
	const cat = category || "general";
	const dom = inferDomain(goalTitle || "", cat);
	const dailyXp = [50, 55, 60, 50, 65];
	const weeklyXp = [180, 220, 260, 200, 240];
	const monthlyXp = [420, 480, 520, 450, 500];
	const xpList =
		timeframe === "weekly" ? weeklyXp : timeframe === "monthly" ? monthlyXp : dailyXp;
	const stats = ["str", "int", "agi", "vit", "str"];
	const difficulties = ["easy", "medium", "hard", "easy", "medium"];

	const money = {
		daily: [
			`Transfer $25 to 1 savings bucket in 1 banking transfer`,
			`Write 75 words listing 1 next cost and 1 deposit date`,
			`Spend 20 minutes comparing 2 loan or savings APRs online`,
			`Read 12 pages from 1 finance chapter in 1 sitting`,
			`Log 10 income and expense lines in 1 spreadsheet for 15 minutes`,
		],
		weekly: [
			`Before Sunday 23:59: collect 3 insurance or loan quotes in 1 comparison table`,
			`Before Sunday 23:59: write 600 words on 1 financing or purchase option in 1 doc`,
			`Before Sunday 23:59: research 5 prices for 1 major purchase in 1 notes file`,
			`Before Sunday 23:59: schedule 1 meeting with 1 bank or advisor (45 minutes blocked)`,
			`Before Sunday 23:59: update 1 full monthly budget with 20 labeled rows`,
		],
		monthly: [
			`By month end: deliver 1 PDF with 1 table comparing 10 financing or listing options`,
			`By month end: log 40 hours on 1 side-income or business project in 1 timesheet`,
			`By month end: open 1 business bank account and deposit $100 in 1 visit`,
			`By month end: file 1 EIN or registration form for 1 business name`,
			`By month end: record 1 month of cashflow with 30 dated lines in 1 ledger`,
		],
	};
	const fitness = {
		daily: [
			`Complete 40 squats in 1 set with 1 logged rep count`,
			`Run 20 minutes at zone 2 in 1 outdoor session`,
			`Hold 1 plank for 60 seconds with 1 timer screenshot`,
			`Walk 8000 steps in 1 day per 1 app export`,
			`Drink 500ml water in 1 minute and log 1 hydration line`,
		],
		weekly: [
			`Before Sunday 23:59: complete 3 strength sessions of 40 minutes each`,
			`Before Sunday 23:59: run 15 km total across 3 runs in 1 training log`,
			`Before Sunday 23:59: stretch 10 minutes on 5 days in 1 checklist`,
			`Before Sunday 23:59: hit 50000 steps total in 1 week per 1 app`,
			`Before Sunday 23:59: 1 long run of 90 minutes at easy pace`,
		],
		monthly: [
			`By month end: complete 12 hour-long workouts in 1 calendar log`,
			`By month end: add 20 lb to 1 lift 1RM in 1 tested session`,
			`By month end: run 80 km total tracked in 1 export`,
			`By month end: 30 mobility sessions of 15 minutes in 1 habit grid`,
			`By month end: race 1 timed 5 km event with 1 official result`,
		],
	};
	const study = {
		daily: [
			`Read 15 pages from 1 textbook chapter in 1 sitting`,
			`Write 80 words summarizing 1 lecture in 1 note`,
			`Complete 25 practice problems in 1 timed block`,
			`Review 1 flashcard deck of 40 cards in 1 session`,
			`Watch 1 lecture segment of 30 minutes with 5 bullet notes`,
		],
		weekly: [
			`Before Sunday 23:59: finish 3 chapters totaling 120 pages in 1 book`,
			`Before Sunday 23:59: pass 1 practice exam with 1 score logged`,
			`Before Sunday 23:59: write 1500 words across 3 study notes`,
			`Before Sunday 23:59: complete 1 course module of 90 minutes`,
			`Before Sunday 23:59: 5 study blocks of 45 minutes on 1 topic`,
		],
		monthly: [
			`By month end: complete 1 full course certificate with 1 credential link`,
			`By month end: 40 hours study time in 1 time log`,
			`By month end: read 600 pages across 4 books in 1 reading list`,
			`By month end: score 90% on 1 final mock exam`,
			`By month end: build 1 portfolio project in 20 documented hours`,
		],
	};
	const general = {
		daily: [
			`Complete 1 focused task in 25 minutes with 1 timer`,
			`Write 60 words in 1 daily log with 1 timestamp`,
			`Clear 3 inbox items in 15 minutes`,
			`Organize 1 desk drawer for 10 minutes`,
			`Schedule 2 calendar blocks of 30 minutes each`,
		],
		weekly: [
			`Before Sunday 23:59: finish 1 project milestone in 4 hours total`,
			`Before Sunday 23:59: attend 2 meetings and write 1 summary page`,
			`Before Sunday 23:59: process 20 backlog items in 1 list`,
			`Before Sunday 23:59: deep work 6 hours across 3 sessions`,
			`Before Sunday 23:59: review 1 weekly plan in 45 minutes`,
		],
		monthly: [
			`By month end: ship 1 deliverable with 1 client sign-off`,
			`By month end: 80 hours on 1 priority in 1 timesheet`,
			`By month end: close 10 tasks from 1 roadmap`,
			`By month end: 4 weekly reviews of 30 minutes each logged`,
			`By month end: archive 1 completed project folder`,
		],
	};

	const tfKey = timeframe === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : "daily";
	let pool = general[tfKey];
	if (dom === "money") pool = money[tfKey];
	else if (dom === "fitness") pool = fitness[tfKey];
	else if (dom === "study") pool = study[tfKey];

	const templates = pool;
	return templates.map((title, i) => ({
		title,
		statType: stats[i % stats.length],
		difficulty: difficulties[i % difficulties.length],
		xp:
			xpList[i] ??
			(timeframe === "weekly" ? 200 : timeframe === "monthly" ? 450 : 55),
	}));
}

function difficultyRules(cat) {
	return `Assign "difficulty": "easy" | "medium" | "hard" from effort and duration of THAT single command — not from timeframe label.
- easy: smallest time/count in the batch or lowest friction.
- medium: middle.
- hard: largest time/count or heaviest single-session demand in the batch.

MANDATORY: at least one easy, one medium, one hard in the 5. Category "${cat}" sets what commands are realistic.`;
}

function buildQuestJsonPrompt(tf, cat, strictFix, goalTitle) {
	const g = String(goalTitle || "unspecified goal").replace(/"/g, "'");
	const DIFFICULTY_RULES = difficultyRules(cat);
	const jsonShape =
		'[{"title":"string","statType":"str|int|agi|vit","xp":number,"difficulty":"easy|medium|hard"},...]';
	const systemCore = `You are the System. You issue SHORT DIRECT ORDERS only. Not an assistant: no pep talk, no explanations in the JSON.

PLAYER GOAL (internal context — infer domain and concrete steps from this; NEVER paste, quote, or repeat this text inside any "title"):
"${g}"

TITLE RULES (every "title" field):
- **Short**: aim under 95 characters; plain English; easy to read at a glance (e.g. "Write 75 words listing 1 next cost and 1 deposit date").
- **Never include the goal sentence** — the app already shows the goal. No "toward …", no quoted goal, no copying the goal text.
- **Domain**: Infer from the goal (money or purchase → savings, transfers, APRs, quotes, insurance, income, business filings, investing; fitness → reps, runs, sessions; study → pages, quizzes, notes; etc.). **All 5 quests must match that domain** — do not mix unrelated exercises or generic writing when the goal is financial or business.
- **Concrete**: name real actions (transfer $X, compare 3 quotes, register LLC, open business bank account, research 5 prices) without naming the full goal.
- **Staircase / decomposition**: Order 1→5 = ordered steps toward a larger outcome. Quest 1 = smallest prerequisite (e.g. save first $, list one expense); later quests = bigger chunks (e.g. meet lender, file business paperwork). For "start a business"–type goals, break into sequential micro-quests (research → name → register → bank → first sale).
- Single imperative. ONE action. MUST include digits ($, minutes, reps, pages, etc.).
- FORBIDDEN in titles: improve, learn, practice, try, should, journey, motivate, explain, personal task, training drill, plus any pasted text from PLAYER GOAL.

${DIFFICULTY_RULES}`;

	const fixBlock = strictFix
		? `\n\nSTRICT FIX: Titles failed checks. Make each title SHORT, no goal text inside, match goal domain (finance vs fitness vs study). Use staircase ordering. Include digits. Remove quotes of the goal.`
		: "";

	if (tf === "weekly") {
		return `${systemCore}
Time window: completable in one week (state deadline in title if needed, e.g. Before Sunday 23:59).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 150–450 per quest.`;
	}
	if (tf === "monthly") {
		return `${systemCore}
Time window: completable within one calendar month (state "By month end" or a date if needed).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 300–900 per quest.`;
	}
	return `${systemCore}
Time window: today (single session or single block unless one number bundles scope, e.g. 3 sets of 10).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 40–120 per quest.`;
}

/**
 * @param {{ goalTitle: string, currentLevel: number, category?: string, timeframe?: 'daily'|'weekly'|'monthly' }} opts
 */
export async function generateDailyQuests({ goalTitle, currentLevel, category, timeframe = "daily" }) {
	const cat = category || "general";
	const tf = timeframe === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : "daily";

	if (!genAI) {
		return ensureDifficultyMix(sanitizeQuestRows(fallbackQuests(goalTitle, cat, tf)));
	}

	const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
	const genConfig = {
		temperature: 0.35,
		topP: 0.85,
		maxOutputTokens: 4096,
	};

	const tryParse = async (strictFix) => {
		const prompt = `Category: ${cat}. Hunter level: ${currentLevel}.

${buildQuestJsonPrompt(tf, cat, strictFix, goalTitle)}`;
		const result = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: genConfig,
		});
		const text = result.response.text();
		const start = text.indexOf("[");
		const end = text.lastIndexOf("]");
		if (start === -1 || end === -1) return [];
		return JSON.parse(text.slice(start, end + 1));
	};

	let parsed = [];
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			parsed = await tryParse(attempt > 0);
			if (!Array.isArray(parsed)) parsed = [];
		} catch (e) {
			// eslint-disable-next-line no-console
			console.warn("[gemini] quest batch JSON parse failed:", tf, cat, e?.message || e);
			parsed = [];
		}
		const sanitized = sanitizeQuestRows(parsed);
		const v = validateQuestBatch(sanitized, goalTitle, cat);
		if (sanitized.length >= 5 && v.ok) {
			return ensureDifficultyMix(sanitized.slice(0, 5));
		}
		// eslint-disable-next-line no-console
		console.warn("[gemini] quest batch validation failed:", tf, cat, v.errors);
	}

	// eslint-disable-next-line no-console
	console.warn("[gemini] using fallback quest batch:", tf, cat);
	return ensureDifficultyMix(sanitizeQuestRows(fallbackQuests(goalTitle, cat, tf)));
}

const STAT_LABEL = { str: "Strength", int: "Intelligence", agi: "Agility", vit: "Vitality" };

/** Words from the quest title that the briefing should echo (anti-generic check). */
function significantTitleTokens(title) {
	return String(title || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 2);
}

function summaryEchoesQuestTitle(summary, questTitle) {
	const tokens = significantTitleTokens(questTitle);
	if (tokens.length === 0) return true;
	const s = String(summary || "").toLowerCase();
	return tokens.some((t) => s.includes(t));
}

function fallbackQuestDetails(ctx) {
	const {
		questTitle,
		goalTitle,
		goalCategory,
		goalRarity,
		questType,
		statType,
		xpReward,
		difficulty,
	} = ctx;
	const st = normalizeStatType(statType);
	const statName = STAT_LABEL[st] || "Strength";
	const d = normalizeDifficulty(difficulty);
	const diffLabel = d === "easy" ? "Easy" : d === "hard" ? "Hard" : "Medium";
	const horizon =
		questType === "weekly" ? "this week" : questType === "monthly" ? "this month" : "today";
	return {
		summary: `Directive: ${questTitle}. Class: ${diffLabel}. Window: ${horizon}. Category: ${goalCategory}. Rarity: ${goalRarity || "common"}. (Parent goal is shown in the app.)`,
		whatYouImprove: `Allocation: +${xpReward} XP → ${statName} (${st}). Execution counts toward the linked goal in this app.`,
		doneWhen: `Success criterion: ${questTitle} fully executed ${horizon}; proof = dated line with the named amount, file stub, or rep count from the title.`,
		steps: [
			`Open the one file, app, or sheet implied by the command and complete that command once.`,
			`Write the label or amount from the command on your log line.`,
			`Save 1 proof line: timestamp + value from the title.`,
		],
		tips: "",
	};
}

function buildQuestDetailsPrompt(ctx, strictRetry) {
	const {
		questTitle,
		goalTitle,
		goalCategory,
		goalRarity,
		questType,
		statType,
		xpReward,
		userLevel,
		isCompleted,
		difficulty,
	} = ctx;

	const d = normalizeDifficulty(difficulty);
	const diffLabel = d === "easy" ? "Easy" : d === "hard" ? "Hard" : "Medium";
	const statName = STAT_LABEL[normalizeStatType(statType)] || statType;
	const horizon =
		questType === "weekly" ? "within the current week" : questType === "monthly" ? "within the current month" : "today";
	const rarity = goalRarity ? String(goalRarity) : "common";
	const cat = goalCategory || "general";

	const retryBlock = strictRetry
		? `\n\nSTRICT FIX: tips "". steps 1–4. doneWhen starts with Success criterion:. Do not paste the full goal into summary; reference "the linked goal" only. Each step names a concrete artifact ($ amount, file, form, app screen) matching QUEST TITLE.`
		: "";

	const safeGoal = String(goalTitle).replace(/"/g, "'").slice(0, 200);

	return `You are the System. Emit structured ORDERS only. You are not an assistant: zero advice, zero tips (field tips must be ""), zero motivation, zero generic explanation.

QUEST TITLE (short command shown on the card — do not repeat the full goal text): "${questTitle}"
GOAL (context only — player sees it elsewhere; do NOT quote it verbatim in "summary" or "steps"): "${safeGoal}"
CATEGORY: ${cat} | RARITY: ${rarity}
TIME WINDOW: ${questType} — ${horizon}
DIFFICULTY: ${diffLabel}
STAT: ${statName} (${statType}) | XP: ${xpReward} | HUNTER LEVEL: ${userLevel} | ALREADY COMPLETED: ${isCompleted ? "yes" : "no"}
${retryBlock}

SPECIFICITY (mandatory):
- "summary": Restate QUEST TITLE with its numbers; add at most one short clause naming the work type (e.g. savings transfer, APR check) implied by the goal — **without** pasting the goal sentence.
- "steps": Each line imperative; name the exact artifact (spreadsheet row, bank app screen, quote PDF, registration site). Forbidden: "do the task" without naming what.

Write ONLY valid JSON (no markdown, no code fences):
{
  "summary": "1–2 sentences. System voice. No banned words (improve, learn, practice, try, should, journey, motivate, explain).",
  "whatYouImprove": "Two lines max. Line 1: Allocation: +${xpReward} XP → ${statName} (${statType}). Line 2: One line: counts toward the linked goal (do not repeat the full goal).",
  "doneWhen": "One sentence starting with Success criterion: — measurable; digits or units.",
  "steps": ["1–4 strings. Ordered micro-steps for THIS quest title only."],
  "tips": ""
}

RULES: "tips" MUST be exactly "". steps.length 1–4. No banned words in any field (improve, learn, practice, advice, explain, motivate).`;
}

function parseQuestDetailsJson(text, fb) {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1) return null;
	let raw;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
	const summary = String(raw.summary || fb.summary).slice(0, 1200);
	const whatYouImprove = String(
		raw.whatYouImprove || raw.what_you_improve || fb.whatYouImprove || ""
	).slice(0, 1200);
	let doneWhen = String(raw.doneWhen || raw.done_when || "").slice(0, 600);
	if (!doneWhen.trim()) {
		doneWhen = String(raw.requirements || fb.doneWhen || "").slice(0, 600);
	}
	doneWhen = doneWhen.trim();
	if (doneWhen && !/^Success criterion:/i.test(doneWhen)) {
		doneWhen = `Success criterion: ${doneWhen}`;
	}
	const steps = Array.isArray(raw.steps)
		? raw.steps.map((s) => String(s).slice(0, 400)).filter(Boolean).slice(0, 6)
		: fb.steps;
	const tips = "";
	if (!summary || steps.length < 1) return null;
	if (!whatYouImprove.trim()) {
		return null;
	}
	return {
		summary,
		whatYouImprove,
		doneWhen: doneWhen.trim() || fb.doneWhen,
		steps: steps.length ? steps : fb.steps,
		tips,
	};
}

/**
 * Rich briefing for a single quest (what / how / steps). Uses Gemini when configured.
 * @param {{ questTitle: string, goalTitle: string, goalCategory?: string, goalRarity?: string, questType: string, statType: string, xpReward: number, difficulty: string, userLevel: number, isCompleted: boolean }} ctx
 */
export async function generateQuestDetails(ctx) {
	const fb = fallbackQuestDetails(ctx);
	if (!genAI) {
		return { ...fb, source: "fallback" };
	}

	const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
	const genConfig = {
		temperature: 0.35,
		topP: 0.85,
		maxOutputTokens: 2048,
	};

	try {
		const run = async (strictRetry) => {
			const prompt = buildQuestDetailsPrompt(ctx, strictRetry);
			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: genConfig,
			});
			return result.response.text();
		};

		let text = await run(false);
		let parsed = parseQuestDetailsJson(text, fb);
		if (!parsed || !briefingPassesSystemRules(parsed)) {
			// eslint-disable-next-line no-console
			console.warn("[gemini] briefing parse/schema failed or rules violated; retry strict");
			text = await run(true);
			parsed = parseQuestDetailsJson(text, fb);
		}
		if (!parsed || !briefingPassesSystemRules(parsed)) {
			// eslint-disable-next-line no-console
			console.warn("[gemini] briefing using fallback (schema or System rules)");
			return { ...fb, source: "fallback" };
		}
		if (!summaryEchoesQuestTitle(parsed.summary, ctx.questTitle)) {
			text = await run(true);
			parsed = parseQuestDetailsJson(text, fb);
		}
		if (
			!parsed ||
			!briefingPassesSystemRules(parsed) ||
			!summaryEchoesQuestTitle(parsed.summary, ctx.questTitle)
		) {
			return { ...fb, source: "fallback" };
		}
		return { ...parsed, tips: "", source: "gemini" };
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn("[gemini] briefing error:", e?.message || e);
		return { ...fb, source: "fallback" };
	}
}

const RANK_LETTERS = new Set(["E", "D", "C", "B", "A", "S"]);

/**
 * Gemini evaluates holistic progress and returns a single rank letter, or null on failure.
 */
export async function evaluateHunterRank(contextSnapshot) {
	if (!genAI) return null;
	const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
	const prompt = `You are the "System" rank authority from Solo Leveling. Assign exactly ONE hunter rank letter.

Valid ranks ONLY: E, D, C, B, A, S (E = weakest beginner, S = apex — rarest).

Be STRICT:
- S requires near-maximum dedication: very high level OR massive quest volume, multiple achievements, strong attributes, serious focus hours, and broad skill unlocks. Casual players never get S.
- Most early accounts should be E or D.
- A/B are late-game; C is mid-game.

Player metrics (JSON):
${JSON.stringify(contextSnapshot)}

Reply with ONLY valid JSON (no markdown): {"rank":"X"} where X is one of E,D,C,B,A,S.`;

	try {
		const result = await model.generateContent(prompt);
		const text = result.response.text();
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start === -1 || end === -1) return null;
		const parsed = JSON.parse(text.slice(start, end + 1));
		const r = String(parsed.rank || "")
			.trim()
			.toUpperCase();
		return RANK_LETTERS.has(r) ? r : null;
	} catch {
		return null;
	}
}

