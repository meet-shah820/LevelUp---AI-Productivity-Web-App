import express from "express";
import { getUserForReq } from "../utils/demoUser.js";
import {
	REFERRAL_MILESTONES,
	applyReferralOnSignup,
	ensureReferralCode,
	getReferralStatsForUser,
	normalizeReferralCode,
} from "../services/referralEngine.js";

const router = express.Router();

function getAppOrigin(req) {
	const fromEnv = String(process.env.APP_PUBLIC_ORIGIN || process.env.OAUTH_SUCCESS_REDIRECT || "").trim();
	if (fromEnv) {
		try {
			return new URL(fromEnv).origin;
		} catch {
			/* fall through */
		}
	}
	const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString().split(",")[0].trim();
	const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:5173").toString().split(",")[0].trim();
	return `${proto}://${host}`;
}

router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const code = await ensureReferralCode(user);
		const origin = getAppOrigin(req);
		const link = `${origin}/auth?ref=${encodeURIComponent(code)}`;
		const stats = await getReferralStatsForUser(user._id);

		return res.json({
			code,
			link,
			stats,
			milestones: Object.entries(REFERRAL_MILESTONES).map(([key, v]) => ({
				key,
				label: v.label,
				referrerXp: v.referrerXp,
				refereeXp: v.refereeXp,
			})),
			referredBy: user.referredBy ? String(user.referredBy) : null,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load referral data" });
	}
});

/** POST /api/referrals/claim — attach referral code after OAuth or for existing accounts without a referrer */
router.post("/claim", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		if (user.referredBy) {
			return res.status(409).json({ error: "You already used a referral code" });
		}
		const code = normalizeReferralCode(req.body?.code);
		if (!code) return res.status(400).json({ error: "Referral code required" });

		const result = await applyReferralOnSignup(user, code);
		if (!result.ok) {
			const messages = {
				invalid_code: "Invalid referral code",
				already_referred: "You already used a referral code",
				code_not_found: "Referral code not found",
				self_referral: "You cannot use your own referral code",
			};
			return res.status(400).json({ error: messages[result.reason] || "Could not apply referral code" });
		}

		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to apply referral code" });
	}
});

export default router;
