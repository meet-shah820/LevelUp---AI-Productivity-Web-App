import FitnessLibraryEntry from "../models/FitnessLibraryEntry.js";

const WGER_BASE = "https://wger.de/api/v2";

function stripHtml(html) {
	return String(html || "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function pickEnglishTranslation(translations) {
	const list = Array.isArray(translations) ? translations : [];
	const en = list.find((t) => Number(t.language) === 2);
	if (en) return en;
	return list[0] || {};
}

function buildSearchBlob({ name, description, categoryLabel, equipmentLabels, muscleLabels }) {
	const parts = [
		name,
		description,
		categoryLabel,
		...(equipmentLabels || []),
		...(muscleLabels || []),
	];
	return parts
		.join(" ")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 16000);
}

/**
 * Fetch exerciseinfo pages from wger (English, language id 2) and upsert into FitnessLibraryEntry.
 * @param {{ maxItems?: number, fetchImpl?: typeof fetch }} opts
 */
export async function ingestWgerExerciseLibrary(opts = {}) {
	const maxItems = Math.min(5000, Math.max(50, Number(opts.maxItems) || Number(process.env.FITNESS_LIBRARY_WGER_MAX) || 500));
	const fetchImpl = opts.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== "function") {
		throw new Error("Global fetch is required for wger ingest (Node 18+)");
	}

	let offset = 0;
	const pageSize = 100;
	let totalRows = 0;
	const licenseNote = "CC-BY-SA 3 (wger)";

	while (totalRows < maxItems) {
		const pageLimit = Math.min(pageSize, maxItems - totalRows);
		const url = `${WGER_BASE}/exerciseinfo/?language=2&limit=${pageLimit}&offset=${offset}`;
		// eslint-disable-next-line no-await-in-loop
		const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
		if (!res.ok) {
			throw new Error(`wger HTTP ${res.status} for ${url}`);
		}
		// eslint-disable-next-line no-await-in-loop
		const data = await res.json();
		const results = data.results || [];
		if (results.length === 0) break;

		const bulk = [];
		for (const row of results) {
			const tr = pickEnglishTranslation(row.translations);
			const name = String(tr.name || "").trim();
			if (!name) continue;
			const description = stripHtml(tr.description || tr.description_source || "");
			const categoryLabel = row.category?.name ? String(row.category.name) : "";
			const equipmentLabels = (row.equipment || []).map((e) => String(e.name || "").trim()).filter(Boolean);
			const muscleLabels = [
				...(row.muscles || []).map((m) => String(m.name_en || m.name || "").trim()),
				...(row.muscles_secondary || []).map((m) => String(m.name_en || m.name || "").trim()),
			].filter(Boolean);
			const externalId = String(row.uuid || row.id);
			const searchBlob = buildSearchBlob({
				name,
				description,
				categoryLabel,
				equipmentLabels,
				muscleLabels,
			});
			bulk.push({
				updateOne: {
					filter: { source: "wger", externalId },
					update: {
						$set: {
							source: "wger",
							externalId,
							kind: "exercise",
							name: name.slice(0, 400),
							description: description.slice(0, 8000),
							categoryLabel: categoryLabel.slice(0, 200),
							equipmentLabels,
							muscleLabels,
							searchBlob,
							licenseShort: row.license?.short_name || licenseNote,
							sourceUrl: `https://wger.de/en/exerciseinfo/${row.id}/`,
							ingestedAt: new Date(),
						},
					},
					upsert: true,
				},
			});
		}
		if (bulk.length) {
			// eslint-disable-next-line no-await-in-loop
			await FitnessLibraryEntry.bulkWrite(bulk, { ordered: false });
		}
		totalRows += results.length;
		offset += results.length;
		if (!data.next || results.length < pageLimit) break;
	}
	return { exercisesProcessed: totalRows, maxItems };
}

const STOP = new Set([
	"the",
	"and",
	"for",
	"with",
	"this",
	"that",
	"from",
	"your",
	"you",
	"into",
	"over",
	"under",
	"week",
	"weeks",
	"month",
	"goal",
	"want",
	"need",
	"help",
	"make",
	"best",
	"more",
	"less",
]);

function textSearchString(goalTitle, description) {
	const s = `${goalTitle} ${description || ""}`
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 1)
		.slice(0, 24)
		.join(" ");
	return s;
}

function goalTokens(goalTitle, description) {
	const raw = `${goalTitle} ${description || ""}`
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ");
	return raw
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * @param {{ goalTitle: string, description?: string, limit?: number }} opts
 * @returns {Promise<Array<{ name: string, description: string, categoryLabel: string, equipmentLabels: string[], muscleLabels: string[], source: string, sourceUrl: string }>>}
 */
export async function findRelevantFitnessLibrary(opts) {
	const limit = Math.min(40, Math.max(4, Number(opts.limit) || 18));
	const goalTitle = String(opts.goalTitle || "").trim();
	const description = String(opts.description || "").trim();
	if (!goalTitle) return [];

	const textQuery = textSearchString(goalTitle, description);
	let rows = [];
	if (textQuery.length >= 2) {
		try {
			rows = await FitnessLibraryEntry.find(
				{ $text: { $search: textQuery } },
				{ score: { $meta: "textScore" } }
			)
				.sort({ score: { $meta: "textScore" } })
				.limit(limit)
				.lean();
		} catch {
			rows = [];
		}
	}

	if (rows.length < 6) {
		const tokens = goalTokens(goalTitle, description);
		const or = tokens.slice(0, 10).map((t) => ({
			searchBlob: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
		}));
		if (or.length) {
			const extra = await FitnessLibraryEntry.find(or.length === 1 ? or[0] : { $or: or })
				.limit(limit * 2)
				.lean();
			const seen = new Set(rows.map((r) => `${r.source}:${r.externalId}`));
			for (const e of extra) {
				const k = `${e.source}:${e.externalId}`;
				if (seen.has(k)) continue;
				seen.add(k);
				rows.push(e);
				if (rows.length >= limit * 2) break;
			}
		}
	}

	const scoreRow = (row) => {
		const blob = `${row.name} ${row.searchBlob || ""}`.toLowerCase();
		const tokens = goalTokens(goalTitle, description);
		let s = Number(row.score) || 0;
		for (const t of tokens) {
			if (blob.includes(t)) s += 2;
		}
		return s;
	};

	const dedup = new Map();
	for (const r of rows) {
		const k = `${r.source}:${r.externalId}`;
		if (!dedup.has(k)) dedup.set(k, r);
	}
	const merged = [...dedup.values()]
		.map((r) => ({ r, s: scoreRow(r) }))
		.sort((a, b) => b.s - a.s)
		.slice(0, limit)
		.map(({ r }) => r);

	return merged.map((r) => ({
		name: r.name,
		description: String(r.description || "").slice(0, 900),
		categoryLabel: r.categoryLabel || "",
		equipmentLabels: r.equipmentLabels || [],
		muscleLabels: r.muscleLabels || [],
		source: r.source,
		sourceUrl: r.sourceUrl || "",
		licenseShort: r.licenseShort || "",
	}));
}

const FREE_EXERCISE_DB_URL =
	"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

/**
 * Ingest exercises from yuhonas/free-exercise-db (public JSON; see repo for image licenses).
 * @param {{ maxItems?: number, fetchImpl?: typeof fetch }} opts
 */
export async function ingestFreeExerciseDbLibrary(opts = {}) {
	const maxItems = Math.min(
		3000,
		Math.max(20, Number(opts.maxItems) || Number(process.env.FITNESS_LIBRARY_FREE_EXERCISE_DB_MAX) || 873)
	);
	const fetchImpl = opts.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== "function") {
		throw new Error("Global fetch is required for free-exercise-db ingest (Node 18+)");
	}
	const res = await fetchImpl(FREE_EXERCISE_DB_URL, { headers: { Accept: "application/json" } });
	if (!res.ok) {
		throw new Error(`free-exercise-db HTTP ${res.status}`);
	}
	const data = await res.json();
	const list = Array.isArray(data) ? data : [];
	const licenseNote = "free-exercise-db (see github.com/yuhonas/free-exercise-db; images separate license)";
	let written = 0;
	const bulk = [];
	for (const row of list) {
		if (written >= maxItems) break;
		const name = String(row?.name || "").trim();
		if (!name) continue;
		const externalId = String(row?.id || name).trim().slice(0, 240);
		const instructions = Array.isArray(row?.instructions) ? row.instructions.join("\n") : "";
		const description = String(instructions || "").trim().slice(0, 8000);
		const categoryLabel = String(row?.category || row?.force || "").trim();
		const equipment = String(row?.equipment || "").trim();
		const equipmentLabels = equipment ? [equipment] : [];
		const primary = Array.isArray(row?.primaryMuscles) ? row.primaryMuscles : [];
		const secondary = Array.isArray(row?.secondaryMuscles) ? row.secondaryMuscles : [];
		const muscleLabels = [...primary, ...secondary].map((m) => String(m || "").trim()).filter(Boolean);
		const level = String(row?.level || "").trim();
		const searchBlob = buildSearchBlob({
			name,
			description,
			categoryLabel: [categoryLabel, level].filter(Boolean).join(" "),
			equipmentLabels,
			muscleLabels,
		});
		bulk.push({
			updateOne: {
				filter: { source: "free-exercise-db", externalId },
				update: {
					$set: {
						source: "free-exercise-db",
						externalId,
						kind: "exercise",
						name: name.slice(0, 400),
						description,
						categoryLabel: categoryLabel.slice(0, 200),
						equipmentLabels,
						muscleLabels,
						searchBlob,
						licenseShort: licenseNote,
						sourceUrl: `https://github.com/yuhonas/free-exercise-db/blob/main/exercises/${encodeURIComponent(externalId)}.json`,
						ingestedAt: new Date(),
					},
				},
				upsert: true,
			},
		});
		written++;
		if (bulk.length >= 250) {
			// eslint-disable-next-line no-await-in-loop
			await FitnessLibraryEntry.bulkWrite(bulk.splice(0, bulk.length), { ordered: false });
		}
	}
	if (bulk.length) {
		await FitnessLibraryEntry.bulkWrite(bulk, { ordered: false });
	}
	return { exercisesUpserted: Math.min(written, maxItems), maxItems };
}

const API_NINJA_MUSCLES = [
	"abdominals",
	"abductors",
	"adductors",
	"biceps",
	"calves",
	"chest",
	"forearms",
	"glutes",
	"hamstrings",
	"lats",
	"lower_back",
	"middle_back",
	"neck",
	"quadriceps",
	"traps",
	"triceps",
	"shoulders",
];

/**
 * Ingest from api.api-ninjas.com/v1/exercises (requires API_NINJAS_KEY).
 * @param {{ maxPerMuscle?: number, fetchImpl?: typeof fetch }} opts
 */
export async function ingestApiNinjasExerciseLibrary(opts = {}) {
	const apiKey = String(process.env.API_NINJAS_KEY || "").trim();
	if (!apiKey) {
		return { skipped: true, reason: "API_NINJAS_KEY not set" };
	}
	const maxPerMuscle = Math.min(20, Math.max(1, Number(opts.maxPerMuscle) || 10));
	const fetchImpl = opts.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== "function") {
		throw new Error("Global fetch is required for API Ninjas ingest (Node 18+)");
	}
	const licenseNote = "API Ninjas (api-ninjas.com; subject to their terms)";
	let upserted = 0;
	const seen = new Set();
	for (const muscle of API_NINJA_MUSCLES) {
		const url = `https://api.api-ninjas.com/v1/exercises?muscle=${encodeURIComponent(muscle)}`;
		// eslint-disable-next-line no-await-in-loop
		const res = await fetchImpl(url, { headers: { Accept: "application/json", "X-Api-Key": apiKey } });
		if (!res.ok) {
			// eslint-disable-next-line no-console
			console.warn(`[fitness-library] api-ninjas muscle=${muscle} HTTP ${res.status}`);
			continue;
		}
		// eslint-disable-next-line no-await-in-loop
		const rows = await res.json();
		if (!Array.isArray(rows)) continue;
		const bulk = [];
		for (const row of rows.slice(0, maxPerMuscle)) {
			const name = String(row?.name || "").trim();
			if (!name) continue;
			const type = String(row?.type || "").trim();
			const equipment = String(row?.equipment || "").trim();
			const difficulty = String(row?.difficulty || "").trim();
			const instr = String(row?.instructions || "").trim();
			const dedupeKey = `${name}|${equipment}`.toLowerCase();
			if (seen.has(dedupeKey)) continue;
			seen.add(dedupeKey);
			const externalId = dedupeKey.replace(/\s+/g, "_").slice(0, 200);
			const equipmentLabels = equipment ? [equipment] : [];
			const muscleLabels = [String(row?.muscle || muscle)].filter(Boolean);
			const categoryLabel = [type, difficulty].filter(Boolean).join(" · ").slice(0, 200);
			const description = instr.slice(0, 8000);
			const searchBlob = buildSearchBlob({
				name,
				description,
				categoryLabel,
				equipmentLabels,
				muscleLabels,
			});
			bulk.push({
				updateOne: {
					filter: { source: "api-ninjas", externalId },
					update: {
						$set: {
							source: "api-ninjas",
							externalId,
							kind: "exercise",
							name: name.slice(0, 400),
							description,
							categoryLabel: categoryLabel.slice(0, 200),
							equipmentLabels,
							muscleLabels,
							searchBlob,
							licenseShort: licenseNote,
							sourceUrl: "https://api-ninjas.com/api/exercises",
							ingestedAt: new Date(),
						},
					},
					upsert: true,
				},
			});
		}
		if (bulk.length) {
			// eslint-disable-next-line no-await-in-loop
			await FitnessLibraryEntry.bulkWrite(bulk, { ordered: false });
			upserted += bulk.length;
		}
	}
	return { exercisesUpserted: upserted, muscles: API_NINJA_MUSCLES.length };
}

/**
 * Run configured ingesters (wger + free-exercise-db; api-ninjas if API_NINJAS_KEY set).
 */
export async function ingestAllFitnessLibrarySources(opts = {}) {
	const out = {};
	out.wger = await ingestWgerExerciseLibrary(opts);
	/** Do not pass wger `maxItems` into free-exercise-db — each source has its own cap/env. */
	out.freeExerciseDb = await ingestFreeExerciseDbLibrary({
		maxItems: opts.maxFreeExerciseDb,
		fetchImpl: opts.fetchImpl,
	});
	out.apiNinjas = await ingestApiNinjasExerciseLibrary(opts);
	return out;
}

export async function fitnessLibraryStats() {
	const total = await FitnessLibraryEntry.countDocuments();
	const bySource = await FitnessLibraryEntry.aggregate([
		{ $group: { _id: "$source", n: { $sum: 1 } } },
		{ $sort: { n: -1 } },
	]);
	return { total, bySource };
}
