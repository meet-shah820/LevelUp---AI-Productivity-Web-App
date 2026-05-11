/**
 * Optional: GEMINI_API_KEY in env — prints JSON achievement ideas for copy review.
 * Does not modify the database.
 */
import { loadProjectEnv } from "../config/loadEnv.js";
import { suggestTrainingAchievementIdeas } from "../services/gemini.js";

loadProjectEnv({ mode: "server" });

const ideas = await suggestTrainingAchievementIdeas();
if (!ideas) {
	// eslint-disable-next-line no-console
	console.error("No ideas (set GEMINI_API_KEY or check API).");
	process.exit(1);
}
// eslint-disable-next-line no-console
console.log(JSON.stringify(ideas, null, 2));
