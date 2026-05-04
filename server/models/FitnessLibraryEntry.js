import mongoose from "mongoose";

/**
 * Normalized exercise / template rows ingested from open fitness APIs (e.g. wger).
 * Used to ground AI quest generation — not a substitute for medical advice.
 */
const FitnessLibraryEntrySchema = new mongoose.Schema(
	{
		source: { type: String, required: true, index: true },
		externalId: { type: String, required: true },
		kind: { type: String, enum: ["exercise", "template"], default: "exercise" },
		name: { type: String, required: true },
		description: { type: String, default: "" },
		categoryLabel: { type: String, default: "" },
		equipmentLabels: { type: [String], default: [] },
		muscleLabels: { type: [String], default: [] },
		/** Flattened text for full-text search + debugging */
		searchBlob: { type: String, default: "" },
		licenseShort: { type: String, default: "" },
		sourceUrl: { type: String, default: "" },
		ingestedAt: { type: Date, default: () => new Date() },
	},
	{ timestamps: true }
);

FitnessLibraryEntrySchema.index({ source: 1, externalId: 1 }, { unique: true });
FitnessLibraryEntrySchema.index({ searchBlob: "text" });

export default mongoose.model("FitnessLibraryEntry", FitnessLibraryEntrySchema);
