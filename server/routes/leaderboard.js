import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { buildLeaderboardSnapshot, LEADERBOARD_RANKS } from "../services/leaderboardSnapshot.js";

const router = express.Router();

// GET /api/leaderboard?limit=50&rank=E — rank bracket E|D|C|B|A|S (default: your current rank)
router.get("/", requireAuth, async (req, res) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const rawRank = req.query.rank != null ? String(req.query.rank).trim().toUpperCase() : "";
		const rankBracket =
			rawRank && LEADERBOARD_RANKS.includes(rawRank) ? rawRank : null;
		const data = await buildLeaderboardSnapshot({
			limit,
			viewerId: req.user._id,
			rankBracket,
		});
		return res.json(data);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to load leaderboard" });
	}
});

export default router;
