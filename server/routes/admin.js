import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { resetUserProgress } from "../services/resetUserProgress.js";

const router = express.Router();

/** @deprecated Prefer POST /api/settings/reset-progress */
router.post("/reset", requireAuth, async (req, res) => {
	try {
		const result = await resetUserProgress(req.user._id);
		return res.json(result);
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to reset" });
	}
});

export default router;
