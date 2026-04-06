import express from "express";
import User from "../models/User.js";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import History from "../models/History.js";
import AchievementUnlock from "../models/AchievementUnlock.js";

const router = express.Router();

router.post("/reset", async (_req, res) => {
	try {
		await Quest.deleteMany({});
		await Goal.deleteMany({});
		await History.deleteMany({});
		await AchievementUnlock.deleteMany({});
		await User.updateMany({}, { $set: { level: 1, xp: 0, streak: 0, stats: { strength: 0, intelligence: 0, agility: 0, vitality: 0 } } });
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to reset" });
	}
});

export default router;

