import { classifyGoalAsFitnessTraining } from "./gemini.js";

const DEFAULT_SUGGESTIONS = [
	"Add 40 lb to my squat in 12 weeks with 3× weekly barbell sessions",
	"Train for a 10K race with structured runs and strength maintenance",
	"Lose 15 lb while keeping muscle — lifting + protein targets",
	"Build visible muscle: 4 gym days per week, progressive overload",
	"Improve mobility and core strength for Brazilian jiu-jitsu",
];

const USER_MESSAGE_OFF =
	"This app only builds training programs for fitness and exercise goals — strength, cardio, conditioning, athletic prep, and related nutrition tied to training. Your goal sounds like a different topic.";

/**
 * Fast path before Gemini.
 * @returns {"fitness"|"off_topic"|"unclear"}
 */
function heuristicFitnessGate(combinedText) {
	const t = combinedText.toLowerCase();

	const fitnessStrong =
		/\b(workouts?|exercise|exercises|gym|squats?|deadlifts?|bench|ohp|overhead press|cardio|run(ning)?|jogs?|couch to 5k|5k|10k|half marathon|marathon|muscle|strength|strong(er)?|hypertrophy|powerlifting|bodybuilding|lose (?:fat|weight)|weight loss|fat loss|get fit|get in shape|body recomp|lean (?:out|bulk)|bulk|cut\b|shred|athlete|athletic|training|train for|reps|sets|hiit|crossfit|yoga|mobility|stretch|pilates|plank|push-?ups?|pull-?ups?|rowing|row(er)?|bike|cycle|swim|fitness|fit4less|leg day|1rm|one rep max|bodyweight|calisthenics|warm-?up|cool-?down|injury prevention|physio|sports? performance|conditioning|metcon|step goal|daily steps)\b/.test(
			t
		) ||
		/\b(walk|steps)\b.*\b(8000|10000|10\s*000|12\s*000)\b/.test(t) ||
		/\bmeal prep\b.*\b(protein|carb|gym|cut|bulk|training)\b/.test(t);

	if (fitnessStrong) return "fitness";

	const offStrong =
		/\b(invest(ment|ing)?|stocks?|portfolio|crypto|bitcoin|ethereum|forex|dividend|401k|roth ira|tax lien|real estate flip)\b/i.test(t) ||
		/\b(python|javascript|typescript|react\.?js|kubernetes|leetcode|system design interview|software engineer|coding bootcamp)\b/i.test(t) ||
		/\b(phd|dissertation|thesis|gmat|lsat|mcat|gpa)\b/i.test(t) ||
		/\b(wedding plan|plan a wedding|instagram growth|tiktok followers|youtube subscribers)\b/i.test(t) ||
		/\b(learn piano|chess elo|chess tournament|duolingo|learn spanish|fluent in)\b/i.test(t) ||
		/\b(promotion|salary negotiation|resume for (?:non|non-)?(?:tech|management))\b/i.test(t) ||
		/\b(read \d+ books|read a book a week|finish war and peace)\b/i.test(t);

	if (offStrong) return "off_topic";

	return "unclear";
}

/**
 * Block goal creation when the topic is clearly not fitness/training for this app.
 * @param {string} title
 * @param {string} description
 * @returns {Promise<{ ok: true } | { ok: false, message: string, suggestions: string[] }>}
 */
export async function assessGoalFitnessRelevance(title, description) {
	const titleS = String(title || "").trim();
	const descS = String(description || "").trim();
	const combined = `${titleS}\n${descS}`;

	if (combined.replace(/\s+/g, "").length < 3) {
		return { ok: true };
	}

	const h = heuristicFitnessGate(combined);
	if (h === "fitness") {
		return { ok: true };
	}
	if (h === "off_topic") {
		return {
			ok: false,
			message: USER_MESSAGE_OFF,
			suggestions: DEFAULT_SUGGESTIONS,
		};
	}

	const ai = await classifyGoalAsFitnessTraining(titleS, descS);
	if (ai.fitnessRelated) {
		return { ok: true };
	}

	const detail = ai.reason ? `${USER_MESSAGE_OFF} ${ai.reason}` : USER_MESSAGE_OFF;
	return {
		ok: false,
		message: detail.trim(),
		suggestions: DEFAULT_SUGGESTIONS,
	};
}
