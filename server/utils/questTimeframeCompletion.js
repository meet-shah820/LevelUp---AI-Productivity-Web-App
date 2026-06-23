import Quest from "../models/Quest.js";
import {
	startOfDay,
	endOfDay,
	rollingWeeklyStart,
	rollingWeeklyEnd,
	rollingMonthlyStart,
	rollingMonthlyEnd,
} from "./timeframePeriod.js";

async function questsInCurrentPeriod(userId, timeframe) {
	const now = new Date();
	if (timeframe === "daily") {
		return Quest.find({
			userId,
			type: "daily",
			date: { $gte: startOfDay(now), $lte: endOfDay(now) },
		}).lean();
	}
	if (timeframe === "weekly") {
		const allWeekly = await Quest.find({ userId, type: "weekly" }).lean();
		return allWeekly.filter((q) => {
			const start = rollingWeeklyStart(q.date || now);
			const end = rollingWeeklyEnd(q.date || now);
			return now >= start && now <= end;
		});
	}
	const allMonthly = await Quest.find({ userId, type: "monthly" }).lean();
	return allMonthly.filter((q) => {
		const start = rollingMonthlyStart(q.date || now);
		const end = rollingMonthlyEnd(q.date || now);
		return now >= start && now <= end;
	});
}

function groupIsFullyComplete(quests, excludeQuestId) {
	if (!quests.length) return false;
	return quests.every((q) => {
		if (excludeQuestId && String(q._id) === String(excludeQuestId)) return false;
		return Boolean(q.isCompleted);
	});
}

/** True when daily, weekly, and monthly quest sets each have quests and are all completed. */
export async function isAllQuestTimeframesComplete(userId, { excludeQuestId } = {}) {
	const [daily, weekly, monthly] = await Promise.all([
		questsInCurrentPeriod(userId, "daily"),
		questsInCurrentPeriod(userId, "weekly"),
		questsInCurrentPeriod(userId, "monthly"),
	]);
	return (
		groupIsFullyComplete(daily, excludeQuestId) &&
		groupIsFullyComplete(weekly, excludeQuestId) &&
		groupIsFullyComplete(monthly, excludeQuestId)
	);
}

export async function didJustCompleteAllQuestTimeframes(userId, completedQuestId) {
	const allCompleteNow = await isAllQuestTimeframesComplete(userId);
	if (!allCompleteNow) return false;
	const allCompleteBefore = await isAllQuestTimeframesComplete(userId, { excludeQuestId: completedQuestId });
	return !allCompleteBefore;
}
