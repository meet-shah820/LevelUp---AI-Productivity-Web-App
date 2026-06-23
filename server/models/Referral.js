import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema(
	{
		referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		/** One referrer per referee — enforced unique */
		refereeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
		codeUsed: { type: String, default: "" },
		milestones: {
			signup: { type: Boolean, default: false },
			first_program: { type: Boolean, default: false },
			first_quest: { type: Boolean, default: false },
		},
		referrerXpTotal: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

ReferralSchema.index({ referrerId: 1, createdAt: -1 });

export default mongoose.model("Referral", ReferralSchema);
