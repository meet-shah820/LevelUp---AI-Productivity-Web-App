import express from "express";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";

const router = express.Router();

const SKILLS = [
	{ id: "morning_warrior", name: "Morning Warrior", unlockLevel: 2, maxLevel: 5, category: "Fitness", description: "Master the art of consistent training" },
	{ id: "iron_body", name: "Iron Body", unlockLevel: 4, maxLevel: 5, category: "Fitness", description: "Build incredible physical strength" },
	{ id: "peak_performance", name: "Peak Performance", unlockLevel: 8, maxLevel: 5, category: "Fitness", description: "Reach your physical peak" },
	{ id: "cardio_commander", name: "Cardio Commander", unlockLevel: 6, maxLevel: 5, category: "Fitness", description: "Elevate your stamina and heart health" },
	{ id: "flexibility_sage", name: "Flexibility Sage", unlockLevel: 10, maxLevel: 5, category: "Fitness", description: "Develop elite mobility and resilience" },
	{ id: "endurance_titan", name: "Endurance Titan", unlockLevel: 14, maxLevel: 5, category: "Fitness", description: "Sustain peak output for long durations" },
	{ id: "metabolic_overdrive", name: "Metabolic Overdrive", unlockLevel: 18, maxLevel: 5, category: "Fitness", description: "Optimize energy systems for sustained effort" },
	{ id: "precision_mobility", name: "Precision Mobility", unlockLevel: 22, maxLevel: 5, category: "Fitness", description: "Control ranges with strength and grace" },
	{ id: "power_engineer", name: "Power Engineer", unlockLevel: 26, maxLevel: 5, category: "Fitness", description: "Explosive output with fast recovery" },
	{ id: "hybrid_athlete", name: "Hybrid Athlete", unlockLevel: 30, maxLevel: 5, category: "Fitness", description: "Blend strength and endurance" },
	{ id: "recovery_maestro", name: "Recovery Maestro", unlockLevel: 35, maxLevel: 5, category: "Fitness", description: "Shorten downtime, extend peak phases" },
	{ id: "grandmaster_conditioning", name: "Grandmaster Conditioning", unlockLevel: 40, maxLevel: 5, category: "Fitness", description: "Elite conditioning across domains" },
];

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

