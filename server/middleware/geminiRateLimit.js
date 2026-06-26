/**
 * In-memory rate limit for Gemini-backed goal / quest generation.
 * Keys by authenticated user id when available, otherwise client IP.
 */

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX = 6;

const buckets = new Map();

function readIntEnv(name, fallback) {
	const n = Number(process.env[name]);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clientIp(req) {
	const fwd = req.headers["x-forwarded-for"];
	if (typeof fwd === "string" && fwd.trim()) {
		return fwd.split(",")[0].trim();
	}
	return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimitKey(req) {
	const uid = req.user?._id ? String(req.user._id) : "";
	if (uid) return `user:${uid}`;
	return `ip:${clientIp(req)}`;
}

export function geminiGenerationRateLimit(req, res, next) {
	const windowMs = readIntEnv("GEMINI_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
	const max = readIntEnv("GEMINI_RATE_LIMIT_MAX", DEFAULT_MAX);
	const key = rateLimitKey(req);
	const now = Date.now();

	let bucket = buckets.get(key);
	if (!bucket || now >= bucket.resetAt) {
		bucket = { count: 0, resetAt: now + windowMs };
		buckets.set(key, bucket);
	}

	bucket.count += 1;

	res.setHeader("X-RateLimit-Limit", String(max));
	res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
	res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

	if (bucket.count > max) {
		const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
		res.setHeader("Retry-After", String(retryAfterSeconds));
		return res.status(429).json({
			error: "rate_limited",
			code: "gemini_rate_limited",
			message: "Too many AI plan generations. Please wait before creating or refreshing goals again.",
			retryAfterSeconds,
		});
	}

	return next();
}
