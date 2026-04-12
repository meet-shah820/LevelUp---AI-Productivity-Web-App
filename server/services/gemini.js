import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
let genAI;
if (apiKey) {
	genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * System behavior when generating quest batches on goal create.
 * Reply shape is still JSON-only (see generateDailyQuests); this drives content quality and goal-specificity.
 */
const GOAL_EXECUTION_SYSTEM_INSTRUCTION = `You are an elite execution system that converts a user's goal into a fully self-contained, step-by-step action roadmap.

You are NOT a coach, advisor, or motivator.
You are NOT allowed to ask questions.
You are NOT allowed to request additional information.
You must assume reasonable default conditions and proceed immediately.

The output must be a complete execution system the user can follow without needing any external search or clarification.

---

INPUT:
- The user message will contain EXACTLY ONE goal string for this batch.
- You must generate quests for THAT goal only — never for a different goal, never generic unrelated tasks, never illustrative examples from other domains.

You must NOT request:
- constraints
- background
- preferences
- experience level
- resources

You must internally assume:
- beginner-level starting point
- average human capability
- minimal required resources unless the goal clearly implies otherwise

---

CORE BEHAVIOR:

1. GOAL DECOMPOSITION SYSTEM
- Break the goal into a full multi-phase roadmap in your reasoning:
  Phase 1: Foundation
  Phase 2: Development
  Phase 3: Acceleration
  Phase 4: Mastery (if applicable)
- Only emit tasks relevant to the progression path for THIS goal.
- Do NOT skip foundational steps.

2. EXTREME TASK SPECIFICITY (MANDATORY)
Every quest command MUST embed:
- Exact action steps (compressed into the title where possible)
- Exact numbers (reps, sets, duration, quantities, timelines)
- Exact method of execution
- Rest times or pacing rules when applicable when they fit the title length

Each task must be executable WITHOUT external knowledge; if the goal needs domain steps, encode the concrete numbers and actions into the title text itself.

3. COMMAND STYLE ONLY
- Use direct imperative commands: Perform, Execute, Complete, Consume, Eliminate, Transfer, Write, Hold, Run, etc.
- No explanations unless required for execution clarity inside the short title
- No motivational language
- No general advice

4. PROGRESSION ENGINE (CRITICAL)
- Tasks must follow a difficulty curve within the batch (ordered steps).
- Assume Foundation phase unless the goal clearly implies a later phase; do not jump to advanced demands without prerequisites in earlier titles when ordering the 5 quests.

5. PUNISHMENT SYSTEM
- Do NOT add punishment quests to this JSON batch; the app stores exactly five primary quests per call. Apply discipline through harder measurable demands in later titles when appropriate, without labeling them "punishment."

6. FULL SELF-CONTAINED EXECUTION
- The user must NEVER need to Google anything; pack enough concrete steps and numbers into each title.

7. NO INTERACTIVE BEHAVIOR
- Do NOT ask questions
- Do NOT offer options
- Do NOT request confirmation
- Do NOT adapt based on missing data (assume defaults and proceed)

---

QUALITY ENFORCEMENT (mandatory internal check before you output JSON):
- No vague instructions in any title
- No external knowledge required beyond what is written in each title
- No questions asked to the user
- Every task is independently executable
- Every task includes concrete numbers and execution cues in the title
If any condition would fail, fix the titles internally before emitting JSON.

---

SOFTWARE OUTPUT CONTRACT (OVERRIDES FREE-FORM ROADMAP TEXT):
- Your entire reply MUST be ONLY a single JSON array of exactly 5 objects. No markdown, no "Goal:", no prose before or after.
- Shape: [{"title":"string","statType":"str|int|agi|vit","xp":number,"difficulty":"easy|medium|hard"},...]
- Each title: one standalone imperative for THE SINGLE GOAL in the user message; include digits (amounts, minutes, reps, pages, etc.); keep under ~95 characters when possible; NEVER paste or quote the full goal sentence inside a title (the app shows the goal separately).
- All 5 titles must stay strictly on-topic for that one goal (same domain as the goal: finance, fitness, study, etc.).
- **Natural phrasing (mandatory):** Use normal real-world words. For money: say **savings account**, **checking account**, **bank transfer** — never "savings bucket" unless the user's goal text uses that exact term. Avoid stacked **"1 … in 1 …"** boilerplate (BAD: "1 savings bucket in 1 banking transfer"; GOOD: "Transfer $25 to one savings account").`;

function escapeGoalForPrompt(goalTitle) {
	return String(goalTitle || "unspecified goal").replace(/"/g, "'");
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
		return /\$|€|£|%|\b(apr|savings|deposit|loan|cost|payment|balance|invoice|budget|spreadsheet|transfer|quote|insurance|revenue|llc|bank|credit|invest|fund|tax|price|listing|income|expense|profit|customer|pitch|register|ein|cashflow|ledger|dividend|broker|model|dealer|vehicle|financing|lease|down|financial|surplus|deficit|outreach|client|freelanc|invoice|subscription)\b/i.test(
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
			`Transfer $25 to one savings account`,
			`Write 75 words: one next cost and one deposit date`,
			`Spend 20 minutes comparing 2 loan or savings APRs online`,
			`Read 12 pages from one finance chapter in one sitting`,
			`Log 10 income and expense lines in one spreadsheet over 15 minutes`,
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

function buildQuestJsonPrompt(tf, cat, strictFix) {
	const DIFFICULTY_RULES = difficultyRules(cat);
	const jsonShape =
		'[{"title":"string","statType":"str|int|agi|vit","xp":number,"difficulty":"easy|medium|hard"},...]';
	const titleRules = `TITLE RULES (every "title" field) — applies ONLY to the single goal in this user message:
- **Short**: aim under 95 characters; plain English; easy to read at a glance (e.g. "Transfer $25 to one savings account" or "Write 75 words: one next cost, one deposit date").
- **Never include the goal sentence** — the app already shows the goal. No "toward …", no quoted goal, no copying the goal text.
- **Domain**: Infer from THE ONLY GOAL (money or purchase → savings, transfers, APRs, quotes, insurance, income, business filings, investing; fitness → reps, runs, sessions; study → pages, quizzes, notes; etc.). **All 5 quests must match that domain** — do not mix unrelated exercises or generic writing when the goal is financial or business.
- **Concrete**: name real actions (transfer $X, compare 3 quotes, register LLC, open a savings account, research 5 prices) without naming the full goal.
- **Readable finance wording:** Use **savings account**, **checking account**, **bank transfer** — not "savings bucket" or "banking bucket" unless the user's goal literally says bucket. Do not chain awkward "1 X in 1 Y" when one clause is enough.
- **Staircase / decomposition**: Order 1→5 = ordered steps toward a larger outcome for THIS goal only. Quest 1 = smallest prerequisite; later quests = bigger chunks.
- Single imperative. ONE action. MUST include digits ($, minutes, reps, pages, etc.).
- FORBIDDEN in titles: improve, learn, practice, try, should, journey, motivate, explain, personal task, training drill, plus any pasted text from THE ONLY GOAL.

${DIFFICULTY_RULES}`;

	const fixBlock = strictFix
		? `\n\nSTRICT FIX: Titles failed checks. Make each title SHORT, no goal text inside, match goal domain (finance vs fitness vs study). Use staircase ordering. Include digits. Remove quotes of the goal. Stay 100% specific to THE ONLY GOAL. For finance use natural terms (savings account, bank transfer); forbid "savings bucket" and redundant "1 … in 1 …" stacks.`
		: "";

	if (tf === "weekly") {
		return `${titleRules}
Time window: completable in one week (state deadline in title if needed, e.g. Before Sunday 23:59).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 150–450 per quest.`;
	}
	if (tf === "monthly") {
		return `${titleRules}
Time window: completable within one calendar month (state "By month end" or a date if needed).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 300–900 per quest.`;
	}
	return `${titleRules}
Time window: today (single session or single block unless one number bundles scope, e.g. 3 sets of 10).
${fixBlock}
Output ONLY JSON array (no markdown): ${jsonShape}
statType: str|int|agi|vit only. XP 40–120 per quest.`;
}

/** One structured roadmap for a single goal (used on goal create). */
const FULL_GOAL_PLAN_SYSTEM_INSTRUCTION = `You are an elite execution system. You convert ONE user goal into a self-contained execution roadmap.

You are NOT a coach. You do NOT ask questions. You do NOT request more information. Assume beginner defaults and proceed.

OUTPUT: Reply with ONLY one JSON object (no markdown fences, no commentary). Shape:
{
  "goalRestated": "string",
  "currentPhase": "Foundation" | "Development" | "Acceleration" | "Mastery",
  "progressionRule": "string — one measurable condition to advance phase",
  "dailyQuests": [ ... ],
  "weeklyQuests": [ ... ],
  "monthlyQuests": [ ... ]
}

Each quest object MUST be:
{
  "title": "Short imperative headline (Execute/Complete/Perform …). May omit digits in title if instructions contain all numbers.",
  "instructions": "Full execution block: WHAT, HOW step-by-step, durations, counts, scripts, rest rules — self-contained (no Google). Multiple paragraphs allowed.",
  "completionStandard": "Binary measurable completion line",
  "statType": "str" | "int" | "agi" | "vit",
  "xp": number,
  "difficulty": "easy" | "medium" | "hard"
}

QUEST COUNTS (scale to horizon the user message provides — use the higher end when the goal is large or the deadline is far):
- If horizon ~1–3 months: about 3–6 daily, 2–5 weekly, 2–4 monthly.
- If ~6 months: about 5–10 daily, 3–8 weekly, 3–6 monthly.
- If ~12+ months: about 8–15 daily, 5–12 weekly, 4–8 monthly.
- If no deadline/horizon given: assume ~12-week horizon; use ~3–5 daily, ~2–4 weekly, ~2–3 monthly.

Hard caps (do not exceed): 15 daily, 12 weekly, 8 monthly.

SCOPE: Every quest must advance ONLY the single goal in the user message. No unrelated domains. No generic filler.
STYLE: Imperative commands, concrete numbers inside instructions, no motivational fluff, no questions to the user.
PHRASING: Use normal English. For money tasks prefer **savings account**, **checking account**, **bank transfer**, **spreadsheet**, **invoice** — not "savings bucket" unless the user's goal uses that word. Avoid robotic **"1 … in 1 …"** chains (e.g. wrong: "1 savings bucket in 1 banking transfer"; right: "Transfer $25 to one savings account" or "One transfer of $25 to your savings account"). Titles and instructions must read naturally aloud.
PUNISHMENT: Do not emit a separate punishment list; fold difficulty into normal quests only.`;

function estimateHorizonMonths(deadlineDate, targetHorizonText) {
	const text = String(targetHorizonText || "")
		.toLowerCase()
		.trim();
	if (text) {
		if (/\b(24|twenty[\s-]*four)\s*(month|mo)\b|\b2\s*y\b|two\s*year/.test(text)) return 24;
		if (/\b(18|eighteen)\s*(month|mo)\b/.test(text)) return 18;
		if (/\b(12|twelve)\s*(month|mo)\b|\b1\s*y\b|one\s*year|annual/.test(text)) return 12;
		if (/\b(9|nine)\s*(month|mo)\b/.test(text)) return 9;
		if (/\b(6|six)\s*(month|mo)\b|half\s*a\s*year/.test(text)) return 6;
		if (/\b(3|three)\s*(month|mo)\b|\bquarter\b/.test(text)) return 3;
		if (/\b(2|two)\s*(month|mo)\b/.test(text)) return 2;
		if (/\b(1|one)\s*(month|mo)\b/.test(text)) return 1;
	}
	if (deadlineDate && !Number.isNaN(new Date(deadlineDate).getTime())) {
		const end = new Date(deadlineDate);
		const now = new Date();
		const ms = end.getTime() - now.getTime();
		const mo = ms / (30.44 * 86400000);
		if (mo > 0) return Math.min(36, Math.max(1, Math.ceil(mo)));
	}
	return 3;
}

/** Exported for goal route seeding windows. */
export function estimateGoalHorizonMonths(deadlineDate, targetHorizonText) {
	return estimateHorizonMonths(deadlineDate, targetHorizonText);
}

function contentMatchesDomain(title, instructions, goalTitle, category) {
	const probe = `${String(title)} ${String(instructions || "").slice(0, 600)}`;
	return titleMatchesDomain(probe, goalTitle, category);
}

function clampXpForTimeframe(tf, xp) {
	const n = Math.round(Number(xp));
	if (tf === "weekly") return Math.min(520, Math.max(130, n || 220));
	if (tf === "monthly") return Math.min(950, Math.max(280, n || 480));
	return Math.min(160, Math.max(35, n || 60));
}

function sanitizeRichQuestRow(raw, tf) {
	return {
		title: String(raw?.title || "").trim().slice(0, 165),
		instructions: String(raw?.instructions || raw?.instruction || "").trim().slice(0, 12000),
		completionStandard: String(
			raw?.completionStandard || raw?.completion_standard || raw?.doneWhen || ""
		)
			.trim()
			.slice(0, 2000),
		statType: normalizeStatType(raw?.statType),
		xp: clampXpForTimeframe(tf, raw?.xp),
		difficulty: normalizeDifficulty(raw?.difficulty),
	};
}

function validateRichQuestRow(q, goalTitle, category, label, i) {
	const errors = [];
	const t = String(q.title || "");
	const ins = String(q.instructions || "");
	if (!t.trim()) errors.push(`${label}[${i}] missing title`);
	if (t.length > 165) errors.push(`${label}[${i}] title too long`);
	if (ins.length < 55) errors.push(`${label}[${i}] instructions too short — need full execution detail`);
	if (!String(q.completionStandard || "").trim()) errors.push(`${label}[${i}] missing completionStandard`);
	if (BANNED_SOFT_LANGUAGE.test(t)) errors.push(`${label}[${i}] title uses banned vague wording`);
	if (titleEmbedsGoalText(t, goalTitle)) errors.push(`${label}[${i}] title must not paste the goal text`);
	if (!titleHasNumericRequirement(t) && !textHasMeasurableSignal(ins)) {
		errors.push(`${label}[${i}] need digits or units in title or instructions`);
	}
	if (!contentMatchesDomain(t, ins, goalTitle, category)) {
		errors.push(`${label}[${i}] content must match goal domain`);
	}
	const blob = `${t} ${ins}`;
	if (/\bsavings bucket\b|\bbanking bucket\b/i.test(blob)) {
		errors.push(
			`${label}[${i}] use standard wording: "savings account" / "bank transfer" — not "savings bucket"`
		);
	}
	return errors;
}

function capList(arr, max) {
	return (Array.isArray(arr) ? arr : []).slice(0, max);
}

function sanitizeAndValidateFullPlan(raw, goalTitle, category) {
	const cat = category || "general";
	const daily = capList(raw?.dailyQuests, 15)
		.map((r) => sanitizeRichQuestRow(r, "daily"))
		.filter((q) => q.title && q.instructions);
	const weekly = capList(raw?.weeklyQuests, 12)
		.map((r) => sanitizeRichQuestRow(r, "weekly"))
		.filter((q) => q.title && q.instructions);
	const monthly = capList(raw?.monthlyQuests, 8)
		.map((r) => sanitizeRichQuestRow(r, "monthly"))
		.filter((q) => q.title && q.instructions);

	const errors = [];
	if (daily.length < 2) errors.push("need at least 2 dailyQuests");
	if (weekly.length < 2) errors.push("need at least 2 weeklyQuests");
	["daily", "weekly", "monthly"].forEach((tf) => {
		const list = tf === "daily" ? daily : tf === "weekly" ? weekly : monthly;
		if (tf === "monthly" && list.length === 0) return;
		list.forEach((q, i) => {
			errors.push(...validateRichQuestRow(q, goalTitle, cat, tf, i));
		});
	});

	const plan = {
		goalRestated: String(raw?.goalRestated || "").trim().slice(0, 500),
		currentPhase: String(raw?.currentPhase || "Foundation").slice(0, 80),
		progressionRule: String(raw?.progressionRule || "").trim().slice(0, 800),
		dailyQuests: ensureDifficultyMix(
			daily.map((q) => ({
				title: q.title,
				statType: q.statType,
				xp: q.xp,
				difficulty: q.difficulty,
				instructions: q.instructions,
				completionStandard: q.completionStandard,
			}))
		),
		weeklyQuests: ensureDifficultyMix(
			weekly.map((q) => ({
				title: q.title,
				statType: q.statType,
				xp: q.xp,
				difficulty: q.difficulty,
				instructions: q.instructions,
				completionStandard: q.completionStandard,
			}))
		),
		monthlyQuests: ensureDifficultyMix(
			monthly.map((q) => ({
				title: q.title,
				statType: q.statType,
				xp: q.xp,
				difficulty: q.difficulty,
				instructions: q.instructions,
				completionStandard: q.completionStandard,
			}))
		),
	};

	return { plan, ok: errors.length === 0, errors };
}

function instructionsToSteps(instructions, completionStandard) {
	const raw = String(instructions || "").trim();
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
	const cs = String(completionStandard || "").trim();
	if (cs) steps.push(`Completion standard: ${cs}`);
	return steps.slice(0, 14).map((s) => s.slice(0, 1200));
}

/**
 * Briefing fields stored on Quest at creation so list + detail match ChatGPT-style depth without a second model call.
 */
export function buildBriefingPayloadFromRichQuest(q) {
	const st = normalizeStatType(q.statType);
	const statName = { str: "Strength", int: "Intelligence", agi: "Agility", vit: "Vitality" }[st] || st;
	const steps = instructionsToSteps(q.instructions, q.completionStandard);
	const cs = String(q.completionStandard || "").trim();
	const doneWhen = /^Success criterion:/i.test(cs) ? cs : `Success criterion: ${cs}`;
	return {
		summary: String(q.title || "").slice(0, 800),
		whatYouImprove: `Allocation: +${q.xp} XP → ${statName} (${st}). Execution advances the linked goal in this app.`,
		doneWhen,
		howTo: String(q.instructions || "").trim(),
		steps,
		tips: "",
		source: "gemini",
	};
}

function fallbackRichTemplate(goalTitle, category) {
	const cat = category || "general";
	const dom = inferDomain(goalTitle || "", cat);
	const g = escapeGoalForPrompt(goalTitle);
	if (dom === "money") {
		return {
			goalRestated: g,
			currentPhase: "Foundation",
			progressionRule: "Advance when 2 consecutive weeks hit all daily and weekly completion standards.",
			dailyQuests: [
				{
					title: "Execute daily financial baseline audit",
					instructions:
						"Sit at one desk with one calculator and one notebook. List every income source with exact monthly amounts. List every monthly expense category (housing, food, transport, subscriptions, debt). Subtract expenses from income once. Write the surplus or deficit as one number on one dated line. Repeat the same audit format daily for 7 days to confirm stability.",
					completionStandard: "One consistent surplus or deficit number identified for the month.",
					statType: "int",
					xp: 65,
					difficulty: "easy",
				},
				{
					title: "Execute expense elimination pass",
					instructions:
						"Open every bank and card app. Cancel 3 non-essential recurring charges in 30 minutes. Set one written food cap (example: $15/day maximum) in the notebook. Track every purchase for the rest of the day in the same notebook with time and amount.",
					completionStandard: "Three charges canceled and one full day logged under the food cap.",
					statType: "vit",
					xp: 70,
					difficulty: "medium",
				},
				{
					title: "Execute 2-hour income skill block",
					instructions:
						"Pick one skill only (sales calls, copywriting, or outbound email). Minute 0–30: watch one training module and write 10 bullets. Minute 30–120: draft one script of 120–180 words and send it to 20 prospects via email or DM using the same subject line for tracking.",
					completionStandard: "20 outbound messages sent with timestamps logged.",
					statType: "str",
					xp: 85,
					difficulty: "hard",
				},
			],
			weeklyQuests: [
				{
					title: "Execute weekly outreach sprint to 140 contacts",
					instructions:
						"Monday–Sunday: send 20 outreaches per day (140 total) for one defined offer. Use this exact script body once per message, filling only the bracketed name: \"Hi [Name] — I help [niche] increase replies on cold outreach. I will write 2 free samples. If you like them, we proceed at $100 per set. Reply YES for samples.\" Log each send in one spreadsheet row: time, channel, contact.",
					completionStandard: "140 logged sends in one week and at least 10 unique replies recorded.",
					statType: "str",
					xp: 280,
					difficulty: "hard",
				},
				{
					title: "Execute weekly savings lock-in transfer",
					instructions:
						"Calculate total net income received this week from all sources. Transfer 70% of that sum into one separate savings account in one transfer before Sunday 23:59. Do not withdraw during the week. Screenshot the balance after transfer.",
					completionStandard: "One transfer completed and balance screenshot saved with date.",
					statType: "vit",
					xp: 240,
					difficulty: "medium",
				},
			],
			monthlyQuests: [
				{
					title: "Execute month-end net worth snapshot",
					instructions:
						"On the last day of the month list all account balances on one page, sum assets, sum liabilities, compute net worth once. File the page as PDF with date in filename.",
					completionStandard: "One dated PDF with three totals: assets, liabilities, net worth.",
					statType: "int",
					xp: 420,
					difficulty: "medium",
				},
				{
					title: "Execute 30-day revenue offer test",
					instructions:
						"Run one fixed offer for 30 days at one price. Log daily: outreach count, calls booked, cash collected. End month: write 300-word retrospective with 3 metrics.",
					completionStandard: "30 consecutive daily log lines plus retrospective document.",
					statType: "str",
					xp: 520,
					difficulty: "hard",
				},
			],
		};
	}
	if (dom === "fitness") {
		return {
			goalRestated: g,
			currentPhase: "Foundation",
			progressionRule: "Advance when you complete 10 consecutive tracked training days without missing a scheduled session.",
			dailyQuests: [
				{
					title: "Execute mobility and steps baseline",
					instructions:
						"Perform 10 minutes of joint circles (neck, shoulders, hips, ankles) following a clock: 30 seconds per joint. Walk 8000 steps in one day tracked in one app export screenshot.",
					completionStandard: "One screenshot showing ≥8000 steps and a dated note confirming mobility block.",
					statType: "agi",
					xp: 55,
					difficulty: "easy",
				},
				{
					title: "Execute strength volume block",
					instructions:
						"Complete 3 sets of 12 squats, 3 sets of 10 push-ups, 3 sets of 30-second plank with 60 seconds rest between sets. Log reps and times on one line.",
					completionStandard: "All sets completed with numbers written on the log.",
					statType: "str",
					xp: 75,
					difficulty: "medium",
				},
				{
					title: "Execute zone-2 conditioning session",
					instructions:
						"Run or bike 25 minutes at conversational pace (zone 2). Wear a watch; keep heart rate below 180 minus age. Cool down 5 minutes walking.",
					completionStandard: "25-minute block completed with average heart rate note.",
					statType: "vit",
					xp: 70,
					difficulty: "medium",
				},
			],
			weeklyQuests: [
				{
					title: "Execute four structured workouts this week",
					instructions:
						"Schedule 4 sessions of 40 minutes. Each session: 8-minute warm-up, 24 minutes main work, 8-minute cool-down. Log date, duration, and session type for each.",
					completionStandard: "Four logs with 40 minutes each in one week.",
					statType: "str",
					xp: 260,
					difficulty: "hard",
				},
				{
					title: "Execute weekly meal prep block",
					instructions:
						"Prepare 10 protein portions (150g each) and 10 carb portions in one 2-hour kitchen block. Store in labeled containers. Photograph the full set.",
					completionStandard: "Photo dated with 20 containers ready.",
					statType: "vit",
					xp: 220,
					difficulty: "medium",
				},
			],
			monthlyQuests: [
				{
					title: "Execute monthly performance test day",
					instructions:
						"Test one lift or one timed run at month end. Record result, body weight, and sleep the night before on one page.",
					completionStandard: "One dated test sheet with numbers.",
					statType: "str",
					xp: 450,
					difficulty: "hard",
				},
			],
		};
	}
	return {
		goalRestated: g,
		currentPhase: "Foundation",
		progressionRule: "Advance when all current-phase daily quests hit completion standard for 14 consecutive days.",
		dailyQuests: [
			{
				title: "Execute 25-minute single-task block",
				instructions:
					"Set one timer for 25 minutes. Close all unrelated tabs and notifications. Work on one named task only. When the timer ends, write one line: task name, outcome, next action.",
				completionStandard: "One timer completed and one log line written.",
				statType: "int",
				xp: 50,
				difficulty: "easy",
			},
			{
				title: "Execute inbox and backlog reduction",
				instructions:
					"Process 15 items from one backlog list in 40 minutes: decide next action or delete/archive each. No item stays untouched.",
				completionStandard: "15 items processed with decisions recorded.",
				statType: "agi",
				xp: 65,
				difficulty: "medium",
			},
			{
				title: "Execute daily review in 12 minutes",
				instructions:
					"Minute 0–4 list tomorrow’s top 3 outcomes. Minute 4–8 list blockers. Minute 8–12 schedule 2 calendar blocks of 30 minutes for tomorrow.",
				completionStandard: "Written plan with 3 outcomes and 2 calendar blocks created.",
				statType: "vit",
				xp: 55,
				difficulty: "easy",
			},
		],
		weeklyQuests: [
			{
				title: "Execute weekly deep-work total 8 hours",
				instructions:
					"Across Mon–Sun complete 8 hours of focused work in blocks ≥45 minutes. Log each block: start time, end time, output artifact name.",
				completionStandard: "8 hours summed with 8+ log lines.",
				statType: "int",
				xp: 260,
				difficulty: "hard",
			},
			{
				title: "Execute one weekly milestone delivery",
				instructions:
					"Define one milestone tied to the goal. Produce one deliverable file or link. Share it with one stakeholder or store in one folder with date.",
				completionStandard: "One file/link exists with date in name or metadata.",
				statType: "str",
				xp: 230,
				difficulty: "medium",
			},
		],
		monthlyQuests: [
			{
				title: "Execute monthly retrospective",
				instructions:
					"Write 400 words: 3 wins, 3 failures, 3 changes for next month. Save as one document with month in title.",
				completionStandard: "One dated document ≥400 words.",
				statType: "int",
				xp: 400,
				difficulty: "medium",
			},
		],
	};
}

function buildFullPlanUserMessage({
	goalTitle,
	category,
	currentLevel,
	deadlineDate,
	targetHorizon,
	description,
	strictFix,
}) {
	const cat = category || "general";
	const months = estimateHorizonMonths(deadlineDate, targetHorizon);
	const g = escapeGoalForPrompt(goalTitle);
	const desc = String(description || "").trim().slice(0, 800);
	const deadlineLine =
		deadlineDate && !Number.isNaN(new Date(deadlineDate).getTime())
			? `Calendar deadline: ${new Date(deadlineDate).toISOString().slice(0, 10)}.`
			: "No calendar deadline provided.";
	const horizonLine = String(targetHorizon || "").trim()
		? `User horizon note: "${String(targetHorizon).replace(/"/g, "'").slice(0, 120)}".`
		: "";
	const fix = strictFix
		? "\n\nSTRICT FIX: Prior attempt failed validation. Ensure every quest has long instructions with numbers, completionStandard, domain matches the goal, titles do not paste the goal sentence, and arrays meet minimum lengths. Use natural finance wording (savings account, bank transfer); never \"savings bucket\" unless the goal says bucket; avoid redundant \"1 … in 1 …\" phrasing."
		: "";
	return `Category: ${cat}. Hunter level: ${currentLevel}.
${deadlineLine}
${horizonLine}
Estimated horizon for sizing quest counts: ~${months} month(s).

THE ONLY GOAL (every quest must exclusively serve this):
"${g}"
${desc ? `\nUser context (optional): ${desc}` : ""}
${fix}

Readable phrasing: for money, use standard terms like **savings account** and **bank transfer** — not \"savings bucket\" unless the user goal uses that word. Prefer one clear clause over stacked \"1 X in 1 Y\".

Output ONLY the JSON object described in your system instructions.`;
}

/**
 * @param {{ goalTitle: string, category?: string, currentLevel: number, deadlineDate?: Date|string|null, targetHorizon?: string, description?: string }} opts
 */
export async function generateFullGoalQuestPlan({
	goalTitle,
	category,
	currentLevel,
	deadlineDate = null,
	targetHorizon = "",
	description = "",
}) {
	const cat = category || "general";
	const fbTemplate = fallbackRichTemplate(goalTitle, cat);
	const fb = sanitizeAndValidateFullPlan(fbTemplate, goalTitle, cat);
	if (!genAI) return fb.plan;

	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-flash",
		systemInstruction: FULL_GOAL_PLAN_SYSTEM_INSTRUCTION,
	});
	const genConfig = {
		temperature: 0.35,
		topP: 0.88,
		maxOutputTokens: 8192,
	};

	const tryParse = async (strictFix) => {
		const prompt = buildFullPlanUserMessage({
			goalTitle,
			category: cat,
			currentLevel,
			deadlineDate,
			targetHorizon,
			description,
			strictFix,
		});
		const result = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: genConfig,
		});
		const text = result.response.text();
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start === -1 || end === -1) return null;
		return JSON.parse(text.slice(start, end + 1));
	};

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const raw = await tryParse(attempt > 0);
			if (!raw) continue;
			const { plan, ok, errors } = sanitizeAndValidateFullPlan(raw, goalTitle, cat);
			if (ok) return plan;
			// eslint-disable-next-line no-console
			console.warn("[gemini] full goal plan validation failed:", errors);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.warn("[gemini] full goal plan parse failed:", e?.message || e);
		}
	}
	// eslint-disable-next-line no-console
	console.warn("[gemini] using fallback full goal plan for:", cat);
	return fb.plan;
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

	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-flash",
		systemInstruction: GOAL_EXECUTION_SYSTEM_INSTRUCTION,
	});
	const genConfig = {
		temperature: 0.35,
		topP: 0.85,
		maxOutputTokens: 4096,
	};

	const tryParse = async (strictFix) => {
		const g = escapeGoalForPrompt(goalTitle);
		const prompt = `Category: ${cat}. Hunter level: ${currentLevel}.

THE ONLY GOAL — all 5 quests must exclusively decompose and advance THIS goal (no other topic, no generic filler):
"${g}"

${buildQuestJsonPrompt(tf, cat, strictFix)}`;
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
		howTo: "",
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
	const howTo = String(raw.howTo || raw.how_to || "").trim().slice(0, 8000);
	return {
		summary,
		whatYouImprove,
		doneWhen: doneWhen.trim() || fb.doneWhen,
		steps: steps.length ? steps : fb.steps,
		tips,
		howTo,
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
		return { ...parsed, tips: "", howTo: parsed.howTo || "", source: "gemini" };
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

