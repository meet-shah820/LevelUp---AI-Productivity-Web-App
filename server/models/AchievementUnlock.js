import mongoose from "mongoose";

const AchievementUnlockSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
		achievementId: { type: String, index: true, required: true },
		unlockedAt: { type: Date, default: () => new Date(), index: true },
	},
	{ timestamps: true }
);

AchievementUnlockSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

export default mongoose.model("AchievementUnlock", AchievementUnlockSchema);

