/** Local-date helpers for quest timeframe windows (server timezone). */

export function startOfDay(d) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function endOfDay(d) {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

/** Monday 00:00:00 local */
export function startOfWeekMonday(d) {
	const x = new Date(d);
	const day = x.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	x.setDate(x.getDate() + diff);
	x.setHours(0, 0, 0, 0);
	return x;
}

/** Sunday 23:59:59.999 local */
export function endOfWeekSunday(d) {
	const mon = startOfWeekMonday(d);
	const sun = new Date(mon);
	sun.setDate(mon.getDate() + 6);
	sun.setHours(23, 59, 59, 999);
	return sun;
}

export function startOfMonth(d) {
	const x = new Date(d.getFullYear(), d.getMonth(), 1);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function endOfMonth(d) {
	const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
	x.setHours(23, 59, 59, 999);
	return x;
}

/**
 * Rolling weekly window anchored to the quest's own start day.
 * - Start: the local start-of-day of the anchor date
 * - End: next week's same weekday at 23:59:59.999 (i.e., 7 days minus 1 ms from start)
 */
export function rollingWeeklyStart(d) {
	return startOfDay(d);
}

export function rollingWeeklyEnd(d) {
	const start = startOfDay(d);
	const end = new Date(start);
	end.setDate(end.getDate() + 7);
	end.setMilliseconds(end.getMilliseconds() - 1);
	return end;
}

/**
 * Rolling monthly window anchored to the quest's own start day.
 * - Start: the local start-of-day of the anchor date
 * - End: same day-of-month in the next month at 23:59:59.999.
 *   If the next month has fewer days (e.g., start on 31st), use the last day of next month.
 */
export function rollingMonthlyStart(d) {
	return startOfDay(d);
}

export function rollingMonthlyEnd(d) {
	const start = startOfDay(d);
	const y = start.getFullYear();
	const m = start.getMonth();
	const day = start.getDate();
	// Construct the nominal same-day next month. JS Date will overflow days; adjust to last day of next month.
	const tentative = new Date(y, m + 1, day);
	// If month overflowed (i.e., day not present), back up to last day of next month.
	if (tentative.getMonth() !== ((m + 1) % 12)) {
		// Last day of next month
		const lastNextMonth = new Date(y, m + 2, 0);
		lastNextMonth.setHours(23, 59, 59, 999);
		return lastNextMonth;
	}
	tentative.setHours(23, 59, 59, 999);
	return tentative;
}

export function periodKeyDaily(d) {
	return `daily-${startOfDay(d).toISOString().slice(0, 10)}`;
}

export function periodKeyWeekly(d) {
	return `weekly-${startOfWeekMonday(d).toISOString().slice(0, 10)}`;
}

export function periodKeyMonthly(d) {
	const x = startOfMonth(d);
	return `monthly-${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

/** Stable identifiers for rolling windows anchored to quest start date. */
export function periodKeyWeeklyRolling(d) {
	return `weekly-rolling-${startOfDay(d).toISOString().slice(0, 10)}`;
}

export function periodKeyMonthlyRolling(d) {
	const x = startOfDay(d);
	return `monthly-rolling-${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
		x.getDate()
	).padStart(2, "0")}`;
}

/**
 * Compute the expiry timestamp for a quest type given its start date.
 * Returns a Date at 23:59:59.999 of the end of the rolling window.
 */
export function computeQuestExpiry(type, date) {
	const d = date ? new Date(date) : new Date();
	if (type === "daily") return endOfDay(d);
	if (type === "weekly") return rollingWeeklyEnd(d);
	if (type === "monthly") return rollingMonthlyEnd(d);
	return endOfDay(d);
}
