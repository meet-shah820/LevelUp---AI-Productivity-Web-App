import express from "express";

const router = express.Router();

function resolveAppPublicOrigin() {
	const fromEnv = String(
		process.env.APP_PUBLIC_ORIGIN || process.env.VITE_PUBLIC_APP_ORIGIN || process.env.OAUTH_SUCCESS_REDIRECT || ""
	).trim();
	if (!fromEnv) return null;
	try {
		return new URL(fromEnv).origin;
	} catch {
		return null;
	}
}

/** Public client config (no secrets beyond the PostHog project key, which is intended for browsers). */
router.get("/", (_req, res) => {
	const posthogKey = String(process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY || "").trim();
	const posthogHost = String(
		process.env.VITE_POSTHOG_HOST || process.env.POSTHOG_HOST || "https://us.i.posthog.com"
	)
		.trim()
		.replace(/\/$/, "");
	const appPublicOrigin = resolveAppPublicOrigin();

	res.setHeader("Cache-Control", "public, max-age=300");
	res.json({
		posthogKey: posthogKey || null,
		posthogHost: posthogHost || "https://us.i.posthog.com",
		appPublicOrigin,
	});
});

export default router;
