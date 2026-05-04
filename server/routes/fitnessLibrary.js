import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { fitnessLibraryStats } from "../services/fitnessLibraryQuery.js";

const router = express.Router();

/** GET /api/fitness-library/stats — counts of ingested reference rows (for verifying sync). */
router.get("/stats", requireAuth, async (_req, res) => {
	try {
		const stats = await fitnessLibraryStats();
		return res.json(stats);
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load fitness library stats" });
	}
});

export default router;
