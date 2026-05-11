/** Local calendar helpers (match streak/dashboard "Monday week" behavior). */

export function ymd(d) {
	const yy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

export function startOfWeekMonday(d) {
	const x = new Date(d);
	const day = x.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	x.setDate(x.getDate() + diff);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function addDays(d, delta) {
	const x = new Date(d);
	x.setDate(x.getDate() + delta);
	return x;
}

/**
 * The most recently completed Mon–Sun block (not the current partial week).
 * `reportWeekId` is the Monday YYYY-MM-DD of that block (stable id for ack).
 */
export function getPreviousWeekBounds(now = new Date()) {
	const thisMonday = startOfWeekMonday(now);
	const prevMonday = addDays(thisMonday, -7);
	const prevSunday = addDays(prevMonday, 6);
	prevSunday.setHours(23, 59, 59, 999);
	const reportWeekId = ymd(prevMonday);
	const days = [];
	const short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	for (let i = 0; i < 7; i++) {
		const dt = addDays(prevMonday, i);
		days.push({
			date: ymd(dt),
			weekdayShort: short[i],
		});
	}
	const weekEndLabel = prevSunday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	const weekStartLabel = prevMonday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	return {
		reportWeekId,
		weekStart: prevMonday,
		weekEnd: prevSunday,
		weekLabel: `${weekStartLabel} – ${weekEndLabel}`,
		days,
	};
}
