import mongoose from "mongoose";

const StatsSchema = new mongoose.Schema(
	{
		strength: { type: Number, default: 0 },
		intelligence: { type: Number, default: 0 },
		agility: { type: Number, default: 0 },
		vitality: { type: Number, default: 0 },
	},
	{ _id: false }
);

const UserSchema = new mongoose.Schema(
	{
		username: { type: String, required: true, unique: true },
		password: { type: String },
		/** Anonymous app trial; password null; not the same as OAuth (googleId set there). */
		isGuest: { type: Boolean, default: false },
		/** Google OAuth subject ("sub") — only set for Google-linked accounts (omit for password users). */
		googleId: { type: String },
		/** Shown in UI; falls back to formatted username if empty */
		displayName: { type: String, default: "" },
		email: { type: String, default: "" },
		bio: { type: String, default: "" },
		/** data:image/...;base64,... — optional, max size enforced in routes */
		avatarDataUrl: { type: String, default: "" },
		preferences: {
			notifications: {
				questReminders: { type: Boolean, default: true },
				levelUp: { type: Boolean, default: true },
				achievementUnlocked: { type: Boolean, default: true },
				streakReminders: { type: Boolean, default: true },
				weeklySummary: { type: Boolean, default: false },
			},
		},
		level: { type: Number, default: 1 },
		xp: { type: Number, default: 0 },
		/** Hunter rank E (lowest) → S (apex); only increases over time */
		rank: { type: String, enum: ["E", "D", "C", "B", "A", "S"], default: "E" },
		stats: { type: StatsSchema, default: () => ({}) },
		streak: { type: Number, default: 0 },
		/** Updated whenever the app resolves the current user (see `getUserForReq`). */
		lastAppOpenAt: { type: Date, default: null },
		/** Monday YYYY-MM-DD of the last weekly recap the user dismissed (`GET /api/weekly-report` when showModal was false). */
		weeklyReportAckWeekId: { type: String, default: "" },
		/** After 7+ days away, the next N quest completions grant 2× base XP (timeframe set bonus unchanged). */
		comebackBonusQuestsRemaining: { type: Number, default: 0 },
		/** After 7+ days away: leaderboard rank uses boosted effective XP until this instant (local server clock). */
		leaderboardUnderdogUntil: { type: Date, default: null },
		/**
		 * Post-recovery easy ramp: 4 = softest penalties / easiest tier, counts down toward 0 on each quest completion.
		 */
		easyModeTier: { type: Number, default: 0 },
		billing: {
			/** free | starter | pro | elite — synced from Stripe webhooks when subscribed */
			tier: { type: String, enum: ["free", "starter", "pro", "elite"], default: "free" },
			stripeCustomerId: { type: String, default: "" },
			stripeSubscriptionId: { type: String, default: "" },
			/** Stripe subscription.status */
			subscriptionStatus: { type: String, default: "" },
			currentPeriodEnd: { type: Date, default: null },
			/** True when subscription is set to cancel at period end (still active until then) */
			cancelAtPeriodEnd: { type: Boolean, default: false },
		},
		/** Unique invite code for the referral program */
		referralCode: { type: String, default: "" },
		/** User who referred this account */
		referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
		/** Total XP earned from referring others */
		referralXpEarned: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

/** Unique only when `googleId` is a real string; many users omit the field (password sign-up). */
UserSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } });
UserSchema.index({ referralCode: 1 }, { unique: true, partialFilterExpression: { referralCode: { $type: "string", $gt: "" } } });

export default mongoose.model("User", UserSchema);

