import express from "express";

const router = express.Router();

/** Public client config (no secrets beyond the PostHog project key, which is intended for browsers). */
router.get("/", (_req, res) => {
	const posthogKey = String(process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY || "").trim();
	const posthogHost = String(
		process.env.VITE_POSTHOG_HOST || process.env.POSTHOG_HOST || "https://us.i.posthog.com"
	)
		.trim()
		.replace(/\/$/, "");

	res.setHeader("Cache-Control", "public, max-age=300");
	res.json({
		posthogKey: posthogKey || null,
		posthogHost: posthogHost || "https://us.i.posthog.com",
	});
});

export default router;
