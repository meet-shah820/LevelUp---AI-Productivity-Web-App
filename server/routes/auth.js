import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

router.post("/signup", async (req, res) => {
	try {
		const { username, password } = req.body || {};
		if (!username || !password) return res.status(400).json({ error: "username and password required" });
		const existing = await User.findOne({ username });
		if (existing) return res.status(409).json({ error: "username taken" });
		const hashed = await bcrypt.hash(password, 10);
		const user = await User.create({ username, password: hashed });
		const token = jwt.sign({ uid: user._id, username }, JWT_SECRET, { expiresIn: "7d" });
		return res.json({ token });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to signup" });
	}
});

router.post("/login", async (req, res) => {
	try {
		const { username, password } = req.body || {};
		if (!username || !password) return res.status(400).json({ error: "username and password required" });
		const user = await User.findOne({ username });
		if (!user || !user.password) return res.status(401).json({ error: "invalid credentials" });
		const ok = await bcrypt.compare(password, user.password);
		if (!ok) return res.status(401).json({ error: "invalid credentials" });
		const token = jwt.sign({ uid: user._id, username }, JWT_SECRET, { expiresIn: "7d" });
		return res.json({ token });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to login" });
	}
});

router.post("/change-password", async (req, res) => {
	try {
		const { username, currentPassword, newPassword } = req.body || {};
		if (!username || !currentPassword || !newPassword) {
			return res.status(400).json({ error: "username, currentPassword, newPassword required" });
		}
		const user = await User.findOne({ username });
		if (!user || !user.password) return res.status(401).json({ error: "invalid credentials" });
		const ok = await bcrypt.compare(currentPassword, user.password);
		if (!ok) return res.status(401).json({ error: "invalid credentials" });
		user.password = await bcrypt.hash(newPassword, 10);
		await user.save();
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to change password" });
	}
});

export default router;

