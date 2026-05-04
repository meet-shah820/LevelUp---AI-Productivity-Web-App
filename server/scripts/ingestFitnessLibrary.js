/**
 * One-shot (or cron) job: pull open-license exercise data into MongoDB for AI grounding.
 *
 * Usage (from project root):
 *   npm run ingest:fitness
 *
 * Env:
 *   MONGODB_URI — same as server
 *   FITNESS_LIBRARY_WGER_MAX — max rows from wger (default 500)
 *   FITNESS_LIBRARY_FREE_EXERCISE_DB_MAX — cap for free-exercise-db JSON (default 873)
 *   API_NINJAS_KEY — optional; enables api-ninjas.com exercise ingest
 */
import mongoose from "mongoose";
import { loadProjectEnv } from "../config/loadEnv.js";
import { ingestAllFitnessLibrarySources } from "../services/fitnessLibraryQuery.js";

loadProjectEnv({ mode: "server" });

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/productivity_app";

async function main() {
	await mongoose.connect(mongoUri, { dbName: "productivity_app" });
	// eslint-disable-next-line no-console
	console.log("Connected. Ingesting fitness library sources (wger, free-exercise-db, optional api-ninjas)…");
	const maxItems = Number(process.env.FITNESS_LIBRARY_WGER_MAX) || 500;
	const out = await ingestAllFitnessLibrarySources({ maxItems });
	// eslint-disable-next-line no-console
	console.log("Done.", out);
	await mongoose.disconnect();
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
