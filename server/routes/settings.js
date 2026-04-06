import express from "express";
import User from "../models/User.js";
import { getOrCreateDemoUser } from "../utils/demoUser.js";

const router = express.Router();

async function getUser() {
	const user = await getOrCreateDemoUser();
	return user;
}

router.get("/", async (_req, res) => {
	try {
		const user = await getUser();
		return res.json({
			notifications: user.preferences?.notifications || {},
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load settings" });
	}
});

router.put("/", async (req, res) => {
	try {
		const user = await getUser();
		const { notifications } = req.body || {};
		if (notifications && typeof notifications === "object") {
			user.preferences = user.preferences || {};
			user.preferences.notifications = {
				...user.preferences.notifications,
				...notifications,
			};
			await user.save();
		}
		return res.json({ ok: true, notifications: user.preferences.notifications });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to save settings" });
	}
});

export default router;

