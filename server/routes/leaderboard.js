import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
	buildLeaderboardSnapshot,
	LEADERBOARD_RANKS,
	LEADERBOARD_PREVIEW_LIMIT,
	LEADERBOARD_ELITE_MAX_LIMIT,
} from "../services/leaderboardSnapshot.js";
import { meetsMinTierWithReq } from "../utils/billingTier.js";

const router = express.Router();

const LEADERBOARD_REQUIRES_GOOGLE = "leaderboard_requires_google";

// GET /api/leaderboard?limit=50&rank=E — rank bracket E|D|C|B|A|S (default: your current rank)
router.get("/", requireAuth, async (req, res) => {
	try {
		if (!req.user.googleId) {
			return res.status(403).json({
				error: "The leaderboard is only available for accounts signed in with Google.",
				code: LEADERBOARD_REQUIRES_GOOGLE,
				requiresGoogle: true,
			});
		}
		const requestedLimit = Math.min(LEADERBOARD_ELITE_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 50));
		const fullLeaderboardUnlocked = meetsMinTierWithReq(req.user, "elite", req);
		const limit = fullLeaderboardUnlocked
			? requestedLimit
			: Math.min(requestedLimit, LEADERBOARD_PREVIEW_LIMIT);
		const rawRank = req.query.rank != null ? String(req.query.rank).trim().toUpperCase() : "";
		const rankBracket =
			rawRank && LEADERBOARD_RANKS.includes(rawRank) ? rawRank : null;
		const data = await buildLeaderboardSnapshot({
			limit,
			viewerId: req.user._id,
			rankBracket,
			visibilityLimit: fullLeaderboardUnlocked ? null : LEADERBOARD_PREVIEW_LIMIT,
			fullLeaderboardUnlocked,
		});
		return res.json(data);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to load leaderboard" });
	}
});

export default router;
