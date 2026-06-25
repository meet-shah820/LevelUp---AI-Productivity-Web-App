import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Flame, Snowflake } from "lucide-react";
import { getStreakCalendar, type StreakCalendarDay, type StreakFreezeStatus } from "../utils/api";
import { motion } from "motion/react";

function formatMonthYear(d: Date): string {
	return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function ymd(d: Date): string {
	const yy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

function addDays(d: Date, delta: number): Date {
	const n = new Date(d);
	n.setDate(n.getDate() + delta);
	return n;
}

export default function Streak() {
	const [cursorMonth, setCursorMonth] = useState<Date>(startOfMonth(new Date()));
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [days, setDays] = useState<StreakCalendarDay[]>([]);
	const [currentStreak, setCurrentStreak] = useState<{ length: number; start: string | null; end: string | null }>({
		length: 0,
		start: null,
		end: null,
	});
	const [longestStreak, setLongestStreak] = useState<{ length: number; start: string | null; end: string | null }>({
		length: 0,
		start: null,
		end: null,
	});
	const [streakFreeze, setStreakFreeze] = useState<StreakFreezeStatus | null>(null);

	useEffect(() => {
		let mounted = true;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const from = ymd(startOfMonth(cursorMonth));
				const to = ymd(endOfMonth(cursorMonth));
				const res = await getStreakCalendar(from, to);
				if (!mounted) return;
				setDays(res.days || []);
				setCurrentStreak(res.currentStreak || { length: 0, start: null, end: null });
				setLongestStreak(res.longestStreak || { length: 0, start: null, end: null });
				setStreakFreeze(res.streakFreeze ?? null);
			} catch {
				if (mounted) setError("Failed to load streak calendar");
			} finally {
				if (mounted) setLoading(false);
			}
		}
		void load();
		return () => {
			mounted = false;
		};
	}, [cursorMonth]);

	function intensityClass(count: number): string {
		// Shades within the app's indigo/emerald palette, scaled by completions
		if (count >= 5) return "bg-emerald-500/50 border-emerald-400/60";
		if (count === 4) return "bg-emerald-500/40 border-emerald-400/50";
		if (count === 3) return "bg-emerald-500/30 border-emerald-400/40";
		if (count === 2) return "bg-emerald-500/25 border-emerald-400/30";
		if (count === 1) return "bg-emerald-500/20 border-emerald-400/20";
		return "bg-white/5 border-purple-500/10";
	}

	const grid = useMemo(() => {
		const first = startOfMonth(cursorMonth);
		const last = endOfMonth(cursorMonth);
		const firstWeekday = (first.getDay() + 6) % 7; // make Monday=0
		const totalDays = last.getDate();
		const rows: { key: string; date: Date | null; info?: StreakCalendarDay }[] = [];

		for (let i = 0; i < firstWeekday; i++) {
			rows.push({ key: `lead-${i}`, date: null });
		}
		for (let day = 1; day <= totalDays; day++) {
			const date = new Date(first.getFullYear(), first.getMonth(), day);
			const key = ymd(date);
			const info = days.find((d) => d.date === key);
			rows.push({ key, date, info });
		}
		// pad to complete weeks
		while (rows.length % 7 !== 0) {
			const idx = rows.length;
			rows.push({ key: `trail-${idx}`, date: null });
		}
		return rows;
	}, [cursorMonth, days]);

	function isInCurrentStreak(dateISO: string): boolean {
		if (!currentStreak.start || !currentStreak.end) return false;
		return dateISO >= currentStreak.start && dateISO <= currentStreak.end;
	}

	function dayCountsForStreak(info?: StreakCalendarDay): boolean {
		return !!info?.countsForStreak || !!info?.hasCompletion || !!info?.streakFrozen;
	}

	function isInLongestStreak(dateISO: string): boolean {
		if (!longestStreak.start || !longestStreak.end) return false;
		return dateISO >= longestStreak.start && dateISO <= longestStreak.end;
	}

	return (
		<div className="p-6 space-y-6">
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="relative overflow-hidden rounded-2xl"
			>
				<div className="absolute -top-20 -right-24 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
				<div className="absolute -bottom-16 -left-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
				<div className="relative z-10 flex items-center justify-between bg-gradient-to-r from-[#0f1526] via-[#10172a] to-[#0f1526] border border-purple-500/20 rounded-2xl p-5">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
							<Calendar className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-xl font-semibold text-white">Streak Calendar</h1>
							<p className="text-xs text-gray-400">Training days completed — keep the chain for bonus momentum</p>
						</div>
					</div>
					<div className="hidden sm:flex items-center gap-4 text-xs">
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
							<span className="text-gray-300">Completed</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-cyan-500/50" />
							<span className="text-gray-300">Freeze</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-indigo-500/60" />
							<span className="text-gray-300">Streak</span>
						</div>
					</div>
				</div>
			</motion.div>

			<Card className="p-4 bg-[#0f1526] border border-purple-500/20 relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
				<div className="relative z-10 flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={() => setCursorMonth(addDays(startOfMonth(cursorMonth), -1))}>
							<ChevronLeft className="w-4 h-4" />
						</Button>
						<div className="text-white font-medium">{formatMonthYear(cursorMonth)}</div>
						<Button variant="ghost" size="icon" onClick={() => setCursorMonth(addDays(endOfMonth(cursorMonth), 1))}>
							<ChevronRight className="w-4 h-4" />
						</Button>
						<Button
							variant="secondary"
							onClick={() => setCursorMonth(startOfMonth(new Date()))}
							className="ml-2"
						>
							Today
						</Button>
					</div>
					<div className="flex items-center gap-4 text-sm">
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
							<span className="text-gray-300">Completed</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-cyan-500/50" />
							<span className="text-gray-300">Freeze</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-indigo-500/60" />
							<span className="text-gray-300">Streak</span>
						</div>
					</div>
				</div>

				{error ? <p className="relative z-10 text-sm text-red-400">{error}</p> : null}
				{loading ? <p className="relative z-10 text-sm text-gray-400">Loading…</p> : null}

				<div className="relative z-10 grid grid-cols-7 gap-2 mt-2">
					{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
						<div key={d} className="text-xs text-gray-400 text-center py-1">
							{d}
						</div>
					))}
					{grid.map((cell, idx) => {
						if (!cell.date) {
							return <div key={cell.key} className="h-12 rounded-md border border-purple-500/10 bg-transparent" />;
						}
						const iso = ymd(cell.date);
						const info = cell.info;
						const completed = !!info?.hasCompletion;
						const frozen = !!info?.streakFrozen && !completed;
						const countsForStreak = dayCountsForStreak(info);
						const inCurrent = countsForStreak && isInCurrentStreak(iso);
						const inLongest = countsForStreak && isInLongestStreak(iso);
						const isToday = iso === ymd(new Date());
						const base = "h-12 rounded-md flex items-center justify-center text-sm transition-all relative";
						const heat = completed
							? intensityClass(info?.completedCount || 1)
							: frozen
								? "bg-cyan-500/25 border-cyan-400/40"
								: "bg-white/5 border-purple-500/10";
						const streakOverlay = inCurrent
							? "ring-2 ring-indigo-400/70"
							: inLongest
								? "ring-2 ring-indigo-400/40"
								: "";
						const ringToday = isToday ? "outline outline-1 outline-amber-400/60" : "";
						return (
							<motion.div
								key={cell.key}
								initial={{ opacity: 0, scale: 0.96 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.2, delay: Math.min(0.02 * (idx % 14), 0.2) }}
								className={`${base} border ${heat} ${streakOverlay} ${ringToday} hover:scale-[1.02] hover:border-purple-400/30`}
								title={
									completed
										? `${iso}: ${info?.completedCount || 1} completion${(info?.completedCount || 1) > 1 ? "s" : ""}`
										: frozen
											? `${iso}: streak freeze applied`
											: iso
								}
							>
								{frozen ? (
									<Snowflake className="w-3.5 h-3.5 text-cyan-200 absolute top-1 right-1 opacity-80" aria-hidden />
								) : null}
								<span className={completed || frozen ? "text-white" : "text-gray-400"}>{cell.date.getDate()}</span>
							</motion.div>
						);
					})}
				</div>
			</Card>

			<Card className="p-4 bg-[#0f1526] border border-purple-500/20 relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
				<div className="relative z-10 flex items-center gap-3 mb-3">
					<Flame className="w-4 h-4 text-orange-400" />
					<div className="text-white font-semibold">Streaks</div>
				</div>
				<div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
					<div className="p-3 rounded-lg bg-white/5 border border-purple-500/10">
						<div className="text-gray-400">Current streak</div>
						<div className="flex items-center gap-2">
							<div className="text-white text-lg font-semibold">{currentStreak.length} days</div>
							{currentStreak.length > 0 && (
								<span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
									active
								</span>
							)}
						</div>
						<div className="text-xs text-gray-500">{currentStreak.start && currentStreak.end ? `${currentStreak.start} → ${currentStreak.end}` : "—"}</div>
					</div>
					<div className="p-3 rounded-lg bg-white/5 border border-purple-500/10">
						<div className="text-gray-400">Longest streak</div>
						<div className="text-white text-lg font-semibold">{longestStreak.length} days</div>
						<div className="text-xs text-gray-500">
							{longestStreak.start && longestStreak.end ? `${longestStreak.start} → ${longestStreak.end}` : "—"}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-white/5 border border-purple-500/10">
						<div className="text-gray-400">Streak freezes</div>
						<div className="flex items-center gap-2">
							<Snowflake className="w-4 h-4 text-cyan-300" aria-hidden />
							<div className="text-white text-lg font-semibold tabular-nums">
								{streakFreeze?.available ?? 0}
							</div>
						</div>
						<div className="text-xs text-gray-500">
							{streakFreeze?.earnProfileLabel
								? `Earn via ${streakFreeze.earnProfileLabel.toLowerCase()}`
								: "Earn from quests & achievements"}
							{(streakFreeze?.upcomingQuestRewards?.length ?? 0) > 0
								? ` · next: ${streakFreeze?.upcomingQuestRewards?.[0]?.title}`
								: ""}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-white/5 border border-purple-500/10">
						<div className="text-gray-400">This month</div>
						<div className="text-white text-lg font-semibold">
							{days.filter((d) => d.hasCompletion).length} days completed
						</div>
					</div>
				</div>
				<div className="relative z-10 mt-4 text-[11px] text-gray-500">
					Tip: Complete at least one quest or focus session per day. Miss a day or two? Freezes auto-apply when you return. Earn them from flagged quests (daily, weekly, or monthly) or achievements — which path you get depends on your hunter profile.
				</div>
			</Card>
		</div>
	);
}

