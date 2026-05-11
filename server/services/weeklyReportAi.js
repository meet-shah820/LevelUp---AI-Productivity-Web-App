import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
let genAI;
if (apiKey) {
	genAI = new GoogleGenerativeAI(apiKey);
}

function clampScore(n) {
	const x = Number(n);
	if (!Number.isFinite(x)) return null;
	return Math.max(0, Math.min(100, Math.round(x)));
}

/** Rule-based score when Gemini is unavailable or fails. */
export function heuristicProductivityScore(totals, consistency01) {
	const activeDays = Number(totals?.activeDays ?? 0);
	const quests = Number(totals?.questsCompleted ?? 0);
	const focus = Number(totals?.focusHours ?? 0);
	const consistency = Number(consistency01 ?? 0);
	const dayPart = (activeDays / 7) * 38;
	const questPart = Math.min(1, quests / 18) * 34;
	const focusPart = Math.min(1, focus / 8) * 18;
	const consPart = consistency * 10;
	return clampScore(dayPart + questPart + focusPart + consPart) ?? 0;
}

/**
 * @param {object} payload — compact stats for the model (days, totals, best/improve dates)
 * @returns {Promise<{ productivityScore: number, headline: string, summary: string, improvementIdeas: string[], source: string } | null>}
 */
export async function generateWeeklyReportAi(payload) {
	const fallback = () => {
		const score = heuristicProductivityScore(payload.totals, payload.consistency01);
		const active = payload.totals?.activeDays ?? 0;
		return {
			productivityScore: score,
			headline: active >= 5 ? "Solid week of training" : active >= 2 ? "Room to build rhythm" : "Fresh start ahead",
			summary:
				active === 0
					? "No logged quest activity last week. When you are ready, pick a goal and chip at one daily quest at a time."
					: `You were active on ${active} of 7 days with ${payload.totals?.questsCompleted ?? 0} quests completed. Keep stacking small wins.`,
			improvementIdeas: [
				"Protect one fixed block on your weakest days for a single must-do quest.",
				"Complete the smallest daily quest first to build momentum.",
			],
			source: "heuristic",
		};
	};

	if (!genAI) return fallback();

	const model = genAI.getGenerativeModel({
		model: "gemini-1.5-flash",
		generationConfig: { temperature: 0.35, maxOutputTokens: 640 },
	});

	const prompt = `You analyze one user's prior calendar week in a fitness training RPG app (daily/weekly quests, XP, optional focus sessions).

Input JSON (authoritative):
${JSON.stringify(payload)}

Task:
1) Assign productivityScore 0-100 for THAT week only (volume + consistency; 0 = no training activity).
2) headline: max 9 words, punchy, no quotes.
3) summary: exactly 2 short sentences, plain English, encouraging but honest.
4) improvementIdeas: 2 to 4 short strings; actionable for gym/conditioning habits (not generic life advice).

Reply ONLY valid JSON (no markdown): {"productivityScore":number,"headline":"string","summary":"string","improvementIdeas":["string",...]}`;

	try {
		const result = await model.generateContent(prompt);
		const text = result.response.text();
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start === -1 || end === -1) return { ...fallback(), source: "parse_fail" };
		const parsed = JSON.parse(text.slice(start, end + 1));
		const productivityScore = clampScore(parsed.productivityScore) ?? heuristicProductivityScore(payload.totals, payload.consistency01);
		const headline = String(parsed.headline || "").trim().slice(0, 120) || fallback().headline;
		const summary = String(parsed.summary || "").trim().slice(0, 520) || fallback().summary;
		const rawIdeas = Array.isArray(parsed.improvementIdeas) ? parsed.improvementIdeas : [];
		const improvementIdeas = rawIdeas
			.map((x) => String(x || "").trim())
			.filter(Boolean)
			.slice(0, 4);
		if (improvementIdeas.length < 2) {
			const fb = fallback();
			return {
				productivityScore,
				headline,
				summary,
				improvementIdeas: [...improvementIdeas, ...fb.improvementIdeas].slice(0, 4),
				source: "gemini",
			};
		}
		return { productivityScore, headline, summary, improvementIdeas, source: "gemini" };
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn("[weeklyReportAi]", e?.message || e);
		return { ...fallback(), source: "error" };
	}
}
