import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * If a valid JWT is provided, attach the authenticated user document to req.user.
 * This does NOT block requests; use requireAuth() if you need to enforce login.
 *
 * Express 4 does not await async middleware — user lookup must finish before next().
 */
export function attachUser(req, _res, next) {
	const raw = req.headers?.authorization || req.headers?.Authorization;
	const header = Array.isArray(raw) ? raw[0] : raw;
	if (!header || typeof header !== "string") {
		next();
		return;
	}
	const m = header.match(/^Bearer\s+(.+)$/i);
	if (!m) {
		next();
		return;
	}
	const token = m[1].trim();
	if (!token) {
		next();
		return;
	}

	let uid;
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		uid = payload?.uid;
	} catch {
		next();
		return;
	}
	if (!uid) {
		next();
		return;
	}

	User.findById(uid)
		.exec()
		.then((user) => {
			if (user) req.user = user;
			next();
		})
		.catch(() => next());
}

export function requireAuth(req, res, next) {
	if (req.user) return next();
	return res.status(401).json({ error: "Unauthorized", code: "auth_required" });
}
