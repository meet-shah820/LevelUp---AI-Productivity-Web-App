import { getWorkoutRowsForQuestFromSnapshot } from "./programModulesRotation.js";

/** Multiple prescription clauses in one string (e.g. squats, push-ups, plank). */
function looksCompoundExerciseNarrative(label) {
	const s = String(label || "");
	const m = s.match(/\d+\s*sets?\s+of\b/gi);
	return !!(m && m.length >= 2);
}

/** Meal prep + other compound briefings (protein portions + carb portions in one line). */
function looksCompoundMealPrepNarrative(label) {
	const s = String(label || "");
	return (
		/\d+\s+\w*\s*portions?\b/i.test(s) &&
		/\s+and\s+(?:\d+\s+|\w+\s+)?(?:carb|protein|fat|veg|vegetable|fiber)\w*\s+portions?\b/i.test(s)
	);
}

/** True when the row should be split into multiple checklist lines. */
function looksCompoundTaskNarrative(label) {
	return looksCompoundExerciseNarrative(label) || looksCompoundMealPrepNarrative(label);
}

/**
 * Split "Prepare … protein portions … and … carb portions …" plus optional ". Store … Photograph …" tail.
 * @param {string} t
 * @returns {string[]|null}
 */
function splitParallelMealPrepPortions(t) {
	const reAnd =
		/\s+and\s+(?=\d+(?:\.\d+)?\s+(?:carb|protein|fat|veg(?:etable)?|fiber)\w*\s+portions\b|\d+(?:\.\d+)?\s+\w+\s+portions\b)/i;
	if (!reAnd.test(t)) return null;

	const halves = t.split(reAnd).map((s) => s.trim()).filter(Boolean);
	if (halves.length < 2) return null;

	const first = halves[0].replace(/\.$/, "").trim();

	let secondBlock = halves.slice(1).join(" and ");

	/** Peel shared finish steps (store, photo, label) off the carb/fat clause */
	let tail = "";
	const peelPatterns = [/\.\s+(?=Store\b)/i, /\.\s+(?=Photograph\b)/i, /\.\s+(?=Label\s+)/i, /\.\s+(?=Pack\b)/i];
	let peelIdx = -1;
	for (const re of peelPatterns) {
		const idx = secondBlock.search(re);
		if (idx >= 0 && (peelIdx < 0 || idx < peelIdx)) peelIdx = idx;
	}
	if (peelIdx >= 0) {
		tail = secondBlock.slice(peelIdx + 1).trim();
		secondBlock = secondBlock.slice(0, peelIdx).trim();
	}

	let second = secondBlock.replace(/\.$/, "").trim();
	if (/^\d+(?:\.\d+)?\s/.test(second) && !/^prepare\b/i.test(second)) {
		second = `Prepare ${second}`;
	}

	const out = [first, second];
	if (tail) out.push(tail);
	return out;
}

/**
 * Turn one line of text into separate exercise lines when comma-separated "N sets of …" clauses exist,
 * or when multiple sentences each prescribe work.
 * @param {string} text
 * @returns {string[]}
 */
export function splitCompoundNarrativeToExercises(text) {
	let t = String(text || "").trim();
	if (!t) return [];

	// Drop generic logging / note tails so they don't stick to the last exercise
	t = t.replace(/\s*Log\s+reps?\b[^.]*\.?/i, "").trim();
	t = t.replace(/\s*Record\s+(each\s+)?reps?\b[^.]*\.?/i, "").trim();
	t = t.replace(/\s*Note:\s*[^.]+\.?/i, "").trim();

	const mealParts = splitParallelMealPrepPortions(t);
	if (mealParts && mealParts.length > 1) {
		return mealParts;
	}

	const commaSplit = t.split(/\s*,\s*(?=\d+\s*sets?\s+of\b)/i);
	if (commaSplit.length >= 2) {
		return commaSplit
			.map((p, idx) => {
				let line = p.trim();
				if (idx === 0) line = line.replace(/^(complete|then)\s+/i, "").trim();
				return line.replace(/\.$/, "").trim();
			})
			.filter((s) => s.length > 0);
	}

	const sentences = t
		.split(/\.\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 10);
	const exerciseLike = sentences.filter(
		(s) =>
			/\d+\s*sets?\s+of\b/i.test(s) ||
			/\b(squats?|push-?ups?|plank|deadlifts?|rows?|press(?:es)?|curls?|lunges?|pull-?ups?|burpees?)\b/i.test(s) ||
			/\b(portions?|meal|prep|kitchen|containers?)\b/i.test(s)
	);
	if (exerciseLike.length >= 2) {
		return exerciseLike.map((s) => s.replace(/\.$/, "").trim());
	}

	return [t];
}

/**
 * If a checklist row still bundles several exercises, split into one row each (stable sub-keys).
 * @param {{ key: string, label: string, meta: string|null }[]} items
 */
function expandCompoundStepItems(items) {
	const out = [];
	for (const it of items) {
		const parts = splitCompoundNarrativeToExercises(it.label);
		if (parts.length <= 1) {
			out.push(it);
			continue;
		}
		parts.forEach((label, j) => {
			out.push({
				key: `${it.key}:part:${j}`,
				label: label.slice(0, 800),
				meta: it.meta,
			});
		});
	}
	return out;
}

function normalizeKey(name) {
	return String(name || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function formatWorkoutMeta(w) {
	if (!w || typeof w !== "object") return null;
	const equip = String(w.equipment || "").trim();
	const sets = Number(w.sets) || 0;
	const reps = String(w.reps ?? "").trim();
	const rest = Number(w.rest_seconds) || 0;
	const cues = String(w.form_cues || "").trim();
	const parts = [];
	if (equip) parts.push(equip);
	if (sets || reps) parts.push(`${sets}×${reps || "?"}`);
	if (rest) parts.push(`rest ${rest}s`);
	let line = parts.join(" · ") || null;
	if (cues && cues.length < 160) line = line ? `${line} — ${cues}` : cues;
	return line;
}

/**
 * @param {Record<string, unknown>} quest — lean or doc
 * @param {Record<string, unknown>|null|undefined} goal — lean goal
 * @param {string[]} stepsFallback — briefing execution steps (ordered tasks)
 * @param {string} [howToFallback] — full how-to narrative (often lists several exercises in one block)
 * @returns {{ key: string, label: string, meta: string|null }[]}
 */
export function buildQuestExerciseItemList(quest, goal, stepsFallback, howToFallback = "") {
	const category = String(goal?.category || "")
		.toLowerCase()
		.trim();
	const snap = goal?.fitnessPlanSnapshot && typeof goal.fitnessPlanSnapshot === "object" ? goal.fitnessPlanSnapshot : null;

	if (category === "fitness" && snap) {
		const rows = getWorkoutRowsForQuestFromSnapshot(snap, quest.title, quest.type);
		if (rows.length > 0) {
			return rows.map((w, i) => ({
				key: `ex:${i}:${normalizeKey(w.name)}`,
				label: String(w.name || `Exercise ${i + 1}`).trim() || `Exercise ${i + 1}`,
				meta: formatWorkoutMeta(w),
			}));
		}

		const rec = snap.recovery_logic?.recovery_quest_structure;
		const rw = rec && typeof rec === "object" ? rec.workout : null;
		if (Array.isArray(rw) && rw.length > 0 && quest.questTag === "recovery") {
			return rw.map((w, i) => ({
				key: `rex:${i}:${normalizeKey(w.name)}`,
				label: String(w.name || `Recovery ${i + 1}`).trim(),
				meta: formatWorkoutMeta(w),
			}));
		}
	}

	const howTo = String(howToFallback || "").trim();

	const steps = Array.isArray(stepsFallback)
		? stepsFallback.map((s) => String(s || "").trim()).filter((s) => s.length > 0)
		: [];

	/** @type {{ key: string, label: string, meta: string|null }[]} */
	let items = steps.map((label, i) => ({
		key: `step:${i}`,
		label: label.slice(0, 800),
		meta: null,
	}));

	items = expandCompoundStepItems(items);

	// Single row still bundles multiple prescriptions (parser missed e.g. odd punctuation)
	if (items.length === 1 && looksCompoundTaskNarrative(items[0].label)) {
		const parts = splitCompoundNarrativeToExercises(items[0].label);
		if (parts.length > 1) {
			items = parts.map((label, j) => ({
				key: `${items[0].key}:part:${j}`,
				label: label.slice(0, 800),
				meta: null,
			}));
		}
	}

	// No steps (or empty): derive from howTo when it lists multiple exercises
	if (items.length === 0 && howTo) {
		const parts = splitCompoundNarrativeToExercises(howTo);
		if (parts.length > 0) {
			items = parts.map((label, i) => ({
				key: `howto:${i}`,
				label: label.slice(0, 800),
				meta: null,
			}));
		}
	}

	// Steps didn't split but howTo has clearer multiple clauses (briefing step duplicated vs howTo detail)
	if (
		items.length === 1 &&
		looksCompoundTaskNarrative(items[0].label) &&
		howTo &&
		looksCompoundTaskNarrative(howTo)
	) {
		const fromHow = splitCompoundNarrativeToExercises(howTo);
		if (fromHow.length > 1) {
			items = fromHow.map((label, i) => ({
				key: `howto:${i}`,
				label: label.slice(0, 800),
				meta: null,
			}));
		}
	}

	return items;
}

/**
 * @param {{ key: string, label: string, meta: string|null }[]} items
 * @param {Array<{ key?: string, completed?: boolean, completedAt?: Date|null }>|undefined|null} stored
 */
export function mergeExerciseProgress(items, stored) {
	const map = new Map();
	for (const p of stored || []) {
		if (p && typeof p.key === "string") map.set(p.key, p);
	}
	return items.map((it) => {
		const p = map.get(it.key);
		return {
			...it,
			completed: !!(p && p.completed),
			completedAt: p?.completedAt ? new Date(p.completedAt).toISOString() : null,
		};
	});
}
