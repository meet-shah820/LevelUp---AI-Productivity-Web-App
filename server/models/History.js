import mongoose from "mongoose";

const HistorySchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
		type: {
			type: String,
			enum: [
				"quest_complete",
				"focus_session",
				"level_up",
				"achievement_unlocked",
				"timeframe_bonus",
				"penalty_missed_day",
				"penalty_timeframe_miss",
			],
			required: true,
		},
		xpChange: { type: Number, default: 0 },
		questId: { type: mongoose.Schema.Types.ObjectId, ref: "Quest" },
		meta: { type: Object, default: {} },
		occurredAt: { type: Date, default: () => new Date(), index: true },
	},
	{ timestamps: true }
);

export default mongoose.model("History", HistorySchema);

