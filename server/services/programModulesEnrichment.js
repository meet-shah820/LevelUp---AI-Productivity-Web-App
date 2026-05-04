import FitnessLibraryEntry from "../models/FitnessLibraryEntry.js";
import Goal from "../models/Goal.js";
import { findRelevantFitnessLibrary } from "./fitnessLibraryQuery.js";

const WGER_BASE = "https://wger.de/api/v2";
const CACHE_VERSION = 1;

function stripHtml(html) {
	return String(html || "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(s) {
	return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeKey(name) {
	return String(name || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

/**
 * Collect unique movements from stored AI snapshot (daily_quests.workout + recovery).
 * @param {Record<string, unknown>|null|undefined} snapshot
 * @returns {Array<{ name: string, equipment: string, form_cues: string, injury_prevention: string }>}
 */
export function extractWorkoutRowsFromSnapshot(snapshot) {
	if (!snapshot || typeof snapshot !== "object") return [];
	/** @type {Map<string, { name: string, equipment: string, form_cues: string, injury_prevention: string }>} */
	const map = new Map();
	const merge = (raw) => {
		if (!raw || typeof raw !== "object") return;
		const w = raw;
		const name = String(w.name || "").trim();
		if (!name) return;
		const key = normalizeKey(name);
		const equipment = String(w.equipment || "").trim();
		const form_cues = String(w.form_cues || "").trim();
		const injury_prevention = String(w.injury_prevention || "").trim();
		const prev = map.get(key);
		if (!prev) {
			map.set(key, { name, equipment, form_cues, injury_prevention });
			return;
		}
		map.set(key, {
			name,
			equipment: equipment || prev.equipment,
			form_cues: [prev.form_cues, form_cues].filter(Boolean).join("\n\n").slice(0, 12000),
			injury_prevention: [prev.injury_prevention, injury_prevention].filter(Boolean).join("\n\n").slice(0, 6000),
		});
	};
	const daily = snapshot.daily_quests;
	if (Array.isArray(daily)) {
		for (const day of daily) {
			const dq = day && typeof day === "object" ? day : {};
			const wo = dq.workout;
			if (Array.isArray(wo)) wo.forEach(merge);
		}
	}
	const recovery = snapshot.recovery_logic;
	if (recovery && typeof recovery === "object") {
		const struct = recovery.recovery_quest_structure;
		if (struct && typeof struct === "object") {
			const rw = struct.workout;
			if (Array.isArray(rw)) rw.forEach(merge);
		}
	}
	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} exerciseName
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function findLibraryRowByExerciseName(exerciseName) {
	const trimmed = String(exerciseName || "").trim();
	if (!trimmed) return null;
	const exact = await FitnessLibraryEntry.findOne({
		name: new RegExp(`^${escapeRegex(trimmed)}$`, "i"),
	}).lean();
	if (exact) return exact;
	try {
		const token = trimmed.split(/\s+/).filter((w) => w.length > 2).slice(0, 5).join(" ");
		if (token.length >= 3) {
			const hits = await FitnessLibraryEntry.find(
				{ $text: { $search: token } },
				{ score: { $meta: "textScore" } }
			)
				.sort({ score: { $meta: "textScore" } })
				.limit(1)
				.lean();
			if (hits.length) return hits[0];
		}
	} catch {
		/* no text index */
	}
	const first = trimmed.split(/\s+/)[0];
	if (first && first.length >= 4) {
		const rx = new RegExp(escapeRegex(first), "i");
		return FitnessLibraryEntry.findOne({ searchBlob: rx }).lean();
	}
	return null;
}

/**
 * Live wger lookup when DB has no row (open API, CC-BY-SA content).
 * @param {string} exerciseName
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function fetchWgerExerciseHint(exerciseName, opts = {}) {
	const fetchImpl = opts.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== "function") return null;
	const term = String(exerciseName || "").trim().slice(0, 80);
	if (term.length < 2) return null;
	try {
		const url = `${WGER_BASE}/exercise/?language=2&limit=5&search=${encodeURIComponent(term)}`;
		const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
		if (!res.ok) return null;
		const data = await res.json();
		const ex = data.results?.[0];
		if (!ex?.id) return null;
		let info = null;
		let infoId = ex.id;
		let ir = await fetchImpl(`${WGER_BASE}/exerciseinfo/${infoId}/`, {
			headers: { Accept: "application/json" },
		});
		if (ir.ok) {
			info = await ir.json();
		} else if (ex.exercise_base) {
			ir = await fetchImpl(`${WGER_BASE}/exercisebaseinfo/${ex.exercise_base}/`, {
				headers: { Accept: "application/json" },
			});
			if (ir.ok) {
				info = await ir.json();
				infoId = ex.exercise_base;
			}
		}
		if (!info) return null;
		const translations = Array.isArray(info.translations) ? info.translations : [];
		const en = translations.find((t) => Number(t.language) === 2) || translations[0] || {};
		const description = stripHtml(en.description || en.description_source || "").slice(0, 8000);
		return {
			description,
			source: "wger",
			sourceUrl: `https://wger.de/en/exerciseinfo/${infoId}/`,
			licenseShort: info.license?.short_name || "CC-BY-SA 3 (wger)",
			categoryLabel: info.category?.name ? String(info.category.name) : "",
		};
	} catch {
		return null;
	}
}

/**
 * @param {import("mongoose").Types.ObjectId|string} goalId
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function enrichAndPersistGoalProgramModules(goalId, opts = {}) {
	const goal = await Goal.findById(goalId).lean();
	if (!goal) return null;
	const snap = goal.fitnessPlanSnapshot && typeof goal.fitnessPlanSnapshot === "object" ? goal.fitnessPlanSnapshot : null;
	const extracted = extractWorkoutRowsFromSnapshot(snap);

	let movements = [];
	let source = "snapshot";

	if (extracted.length > 0) {
		for (const row of extracted) {
			const lib = await findLibraryRowByExerciseName(row.name);
			const live = !lib || !String(lib.description || "").trim() ? await fetchWgerExerciseHint(row.name, opts) : null;
			const description = [
				lib && String(lib.description || "").trim(),
				live && String(live.description || "").trim(),
			]
				.filter(Boolean)
				.join("\n\n")
				.slice(0, 12000);
			const equipmentLabels = lib?.equipmentLabels && Array.isArray(lib.equipmentLabels) ? lib.equipmentLabels : [];
			const equipmentSummary = [row.equipment, equipmentLabels.join(", ").trim()].filter(Boolean).join(" · ").slice(0, 500);

			movements.push({
				name: row.name,
				equipmentSummary,
				equipmentLabels,
				description,
				form_cues: row.form_cues,
				injury_prevention: row.injury_prevention,
				referenceSource: lib?.source || live?.source || null,
				referenceUrl: lib?.sourceUrl || live?.sourceUrl || null,
				licenseShort: lib?.licenseShort || live?.licenseShort || null,
				categoryLabel: lib?.categoryLabel || live?.categoryLabel || "",
			});
		}
	} else {
		source = "goal_library_fallback";
		const rows = await findRelevantFitnessLibrary({
			goalTitle: goal.title,
			description: goal.description || "",
			limit: 28,
		});
		movements = rows.map((r) => ({
			name: r.name,
			equipmentSummary: (r.equipmentLabels || []).join(", "),
			equipmentLabels: r.equipmentLabels || [],
			description: String(r.description || "").slice(0, 12000),
			form_cues: "",
			injury_prevention: "",
			referenceSource: r.source,
			referenceUrl: r.sourceUrl,
			licenseShort: r.licenseShort,
			categoryLabel: r.categoryLabel || "",
			fromGoalContextFallback: true,
		}));
	}

	const cache = {
		version: CACHE_VERSION,
		updatedAt: new Date().toISOString(),
		source,
		movements,
	};

	await Goal.findByIdAndUpdate(goalId, { programModulesCache: cache });
	return cache;
}
