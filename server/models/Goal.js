import mongoose from "mongoose";

const GoalSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		title: { type: String, required: true },
		category: { type: String, default: "general" },
		/** Optional notes the user adds in the app (not required for AI). */
		description: { type: String, default: "" },
		/** Optional calendar deadline — used to size the quest plan. */
		deadline: { type: Date, default: null },
		status: { type: String, enum: ["active", "archived"], default: "active" },
		/** Easiest → hardest: common … mythic */
		rarity: {
			type: String,
			enum: ["common", "rare", "epic", "legendary", "mythic"],
			default: "common",
		},
		/** @deprecated use rarity */
		difficulty: { type: String, enum: ["Easy", "Medium", "Hard", "Epic"], required: false },
	},
	{ timestamps: true }
);

export default mongoose.model("Goal", GoalSchema);

