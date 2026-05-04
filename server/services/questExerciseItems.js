import { getWorkoutRowsForQuestFromSnapshot } from "./programModulesRotation.js";

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
 * @returns {{ key: string, label: string, meta: string|null }[]}
 */
export function buildQuestExerciseItemList(quest, goal, stepsFallback) {
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

	const steps = Array.isArray(stepsFallback)
		? stepsFallback.map((s) => String(s || "").trim()).filter((s) => s.length > 0)
		: [];
	return steps.map((label, i) => ({
		key: `step:${i}`,
		label: label.slice(0, 800),
		meta: null,
	}));
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
