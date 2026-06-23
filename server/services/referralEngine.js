import User from "../models/User.js";
import Referral from "../models/Referral.js";
import History from "../models/History.js";
import { calculateLevelFromXp } from "../utils/level.js";

export const REFERRAL_MILESTONES = {
	signup: { referrerXp: 50, refereeXp: 75, label: "Friend creates an account" },
	first_program: { referrerXp: 100, refereeXp: 25, label: "Friend adds their first training program" },
	first_quest: { referrerXp: 75, refereeXp: 0, label: "Friend completes their first quest" },
};

function randomSuffix() {
	return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function normalizeReferralCode(raw) {
	return String(raw ?? "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.slice(0, 16);
}

export async function ensureReferralCode(user) {
	if (user.referralCode) return user.referralCode;
	const base = String(user.username || "LVL")
		.replace(/[^a-z0-9]/gi, "")
		.slice(0, 6)
		.toUpperCase() || "LVL";
	for (let i = 0; i < 24; i++) {
		const candidate = `${base}${randomSuffix()}`.slice(0, 12);
		// eslint-disable-next-line no-await-in-loop
		const taken = await User.findOne({ referralCode: candidate, _id: { $ne: user._id } }).lean();
		if (!taken) {
			user.referralCode = candidate;
			await user.save();
			return candidate;
		}
	}
	const fallback = `LVL${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
	user.referralCode = fallback;
	await user.save();
	return fallback;
}

async function grantXp(userId, xp, historyType, meta) {
	if (!xp || xp <= 0) return;
	const user = await User.findById(userId);
	if (!user) return;
	user.xp = (user.xp || 0) + xp;
	user.level = calculateLevelFromXp(user.xp);
	await user.save();
	await History.create({
		userId,
		type: historyType,
		xpChange: xp,
		meta,
	});
}

/**
 * Link a new user to a referrer and grant signup milestone rewards.
 * @returns {{ ok: boolean, reason?: string }}
 */
export async function applyReferralOnSignup(referee, rawCode) {
	const code = normalizeReferralCode(rawCode);
	if (!code) return { ok: false, reason: "invalid_code" };
	if (referee.referredBy) return { ok: false, reason: "already_referred" };

	const referrer = await User.findOne({ referralCode: code });
	if (!referrer) return { ok: false, reason: "code_not_found" };
	if (String(referrer._id) === String(referee._id)) return { ok: false, reason: "self_referral" };

	referee.referredBy = referrer._id;
	await referee.save();

	const referral = await Referral.create({
		referrerId: referrer._id,
		refereeId: referee._id,
		codeUsed: code,
		milestones: { signup: true, first_program: false, first_quest: false },
		referrerXpTotal: 0,
	});

	const cfg = REFERRAL_MILESTONES.signup;
	let referrerXpGranted = 0;
	if (cfg.referrerXp > 0) {
		await grantXp(referrer._id, cfg.referrerXp, "referral_bonus", {
			milestone: "signup",
			refereeId: referee._id,
			refereeUsername: referee.username,
		});
		referrerXpGranted += cfg.referrerXp;
		referrer.referralXpEarned = (referrer.referralXpEarned || 0) + cfg.referrerXp;
		await referrer.save();
	}
	if (cfg.refereeXp > 0) {
		await grantXp(referee._id, cfg.refereeXp, "referral_bonus", {
			milestone: "signup",
			referrerId: referrer._id,
			referrerUsername: referrer.username,
		});
	}

	referral.referrerXpTotal = referrerXpGranted;
	await referral.save();

	return { ok: true };
}

/**
 * Grant milestone rewards when a referred user hits engagement goals.
 */
export async function processReferralMilestone(refereeId, milestone) {
	if (!REFERRAL_MILESTONES[milestone]) return { ok: false, reason: "unknown_milestone" };

	const referral = await Referral.findOne({ refereeId });
	if (!referral) return { ok: false, reason: "not_referred" };
	if (referral.milestones?.[milestone]) return { ok: false, reason: "already_rewarded" };

	const cfg = REFERRAL_MILESTONES[milestone];
	const referrer = await User.findById(referral.referrerId);
	const referee = await User.findById(refereeId);
	if (!referrer || !referee) return { ok: false, reason: "user_missing" };

	let referrerXpGranted = 0;
	if (cfg.referrerXp > 0) {
		await grantXp(referrer._id, cfg.referrerXp, "referral_bonus", {
			milestone,
			refereeId: referee._id,
			refereeUsername: referee.username,
		});
		referrerXpGranted += cfg.referrerXp;
		referrer.referralXpEarned = (referrer.referralXpEarned || 0) + cfg.referrerXp;
		await referrer.save();
	}
	if (cfg.refereeXp > 0) {
		await grantXp(referee._id, cfg.refereeXp, "referral_bonus", {
			milestone,
			referrerId: referrer._id,
			referrerUsername: referrer.username,
		});
	}

	referral.milestones = { ...referral.milestones, [milestone]: true };
	referral.referrerXpTotal = (referral.referrerXpTotal || 0) + referrerXpGranted;
	await referral.save();

	return { ok: true };
}

export async function getReferralStatsForUser(userId) {
	const referrals = await Referral.find({ referrerId: userId }).sort({ createdAt: -1 }).limit(20).lean();
	const refereeIds = referrals.map((r) => r.refereeId);
	const referees = refereeIds.length
		? await User.find({ _id: { $in: refereeIds } })
				.select("username displayName")
				.lean()
		: [];
	const refereeMap = new Map(referees.map((u) => [String(u._id), u]));

	const totalInvited = referrals.length;
	const activated = referrals.filter((r) => r.milestones?.first_program || r.milestones?.first_quest).length;
	const user = await User.findById(userId).select("referralXpEarned").lean();

	const recent = referrals.slice(0, 8).map((r) => {
		const ref = refereeMap.get(String(r.refereeId));
		const milestone =
			r.milestones?.first_quest ? "first_quest" : r.milestones?.first_program ? "first_program" : "signup";
		return {
			username: ref?.username || "hunter",
			displayName: ref?.displayName || "",
			milestone,
			xpAwarded: r.referrerXpTotal || 0,
			at: r.updatedAt || r.createdAt,
		};
	});

	return {
		totalInvited,
		activated,
		xpEarned: user?.referralXpEarned || 0,
		recent,
	};
}
