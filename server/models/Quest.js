import mongoose from "mongoose";

const QuestSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		goalId: { type: mongoose.Schema.Types.ObjectId, ref: "Goal", required: true, index: true },
		title: { type: String, required: true },
		xpReward: { type: Number, required: true },
		statType: { type: String, enum: ["str", "int", "agi", "vit"], required: true },
		isCompleted: { type: Boolean, default: false },
		type: { type: String, enum: ["daily", "weekly", "monthly"], default: "daily" },
		/** Effort / time to complete — independent of timeframe (Gemini-assigned). */
		difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
		date: { type: Date, default: () => new Date() },
		/** When this quest automatically expires (end of its rolling window). */
		expiresAt: { type: Date, default: null, index: true },
		/** Server-side expiration flag; expired quests are no longer eligible for completion. */
		isExpired: { type: Boolean, default: false, index: true },
		expiredAt: { type: Date, default: null },
		/** Cached System briefing (Gemini or fallback); generated on first details view. */
		briefing: {
			summary: { type: String, default: "" },
			/** Plain language: what finishing this quest improves (goal + stat). */
			whatYouImprove: { type: String, default: "" },
			/** One line: when to mark complete. */
			doneWhen: { type: String, default: "" },
			requirements: { type: String, default: "" },
			howTo: { type: String, default: "" },
			steps: { type: [String], default: [] },
			tips: { type: String, default: "" },
			source: { type: String, enum: ["gemini", "fallback"], default: "fallback" },
		},
		briefingGeneratedAt: { type: Date, default: null },
		/** Bump in code when briefing format/prompt changes so old cache is regenerated. */
		briefingSchemaVersion: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

export default mongoose.model("Quest", QuestSchema);

