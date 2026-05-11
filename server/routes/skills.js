import express from "express";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import { SKILLS } from "../data/skills.js";

const router = express.Router();

async function getUser(req) {
	return await getUserForReq(req);
}

router.get("/", async (req, res) => {
	try {
		const user = await getUser(req);
		// Make skills 5x harder to unlock
		const withProgress = SKILLS.map((s) => {
			const effectiveUnlock = Math.max(1, (s.unlockLevel || 1) * 5);
			const unlocked = user.level >= effectiveUnlock;
			const level = unlocked ? Math.min(s.maxLevel, Math.max(1, user.level - effectiveUnlock + 1)) : 0;
			return { ...s, unlockLevel: effectiveUnlock, unlocked, level };
		});
		const unlocked = withProgress.filter((s) => s.unlocked);
		const locked = withProgress.filter((s) => !s.unlocked);
		const categories = ["Fitness"];
		const summary = categories.map((c) => {
			const all = withProgress.filter((s) => s.category === c);
			return { category: c, unlocked: all.filter((s) => s.unlocked).length, total: all.length };
		});
		return res.json({ unlocked, locked, level: user.level, summary, all: withProgress });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load skills" });
	}
});

export default router;

