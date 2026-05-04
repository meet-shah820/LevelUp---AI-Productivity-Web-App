import { Check, Circle, CalendarRange } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import type { GoalProgramSchedule } from "../utils/api";

function shortDate(iso: string) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return "—";
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	} catch {
		return "—";
	}
}

function periodLabel(g: GoalProgramSchedule) {
	const start = g.createdAt ? shortDate(g.createdAt) : "Start";
	const end = g.deadline ? shortDate(g.deadline) : "Open end";
	return `${start} → ${end}`;
}

function timeframeStyles(tf: "daily" | "weekly" | "monthly") {
	if (tf === "daily") return "border-blue-500/35 text-blue-200/90 bg-blue-500/10";
	if (tf === "weekly") return "border-purple-500/35 text-purple-200/90 bg-purple-500/10";
	return "border-orange-500/35 text-orange-200/90 bg-orange-500/10";
}

type Props = {
	schedules: GoalProgramSchedule[];
	/** When set, that program’s card is visually emphasized */
	highlightGoalId?: string;
};

/**
 * Read-only program timeline: one block per goal, only schedule rows (no XP/engagement).
 */
export function GoalProgramSchedulePanel({ schedules, highlightGoalId }: Props) {
	if (!schedules.length) {
		return (
			<Card className="border-purple-500/20 bg-[#0d111c]/90 p-4 text-sm text-gray-400">
				<p className="font-medium text-gray-300 mb-1">Program schedules</p>
				<p>No active training programs. Add a program to see its full quest timeline here.</p>
			</Card>
		);
	}

	return (
		<Card className="border-purple-500/25 bg-[#0d111c]/95 overflow-hidden flex flex-col max-h-[min(420px,52vh)] xl:max-h-[min(480px,60vh)]">
			<div className="shrink-0 border-b border-purple-500/20 px-4 py-3 flex items-center gap-2 bg-[#111827]/80">
				<CalendarRange className="w-4 h-4 text-purple-300 shrink-0" aria-hidden />
				<div>
					<p className="text-sm font-semibold text-white">Program schedules</p>
					<p className="text-xs text-gray-500">
						Stored quests for each program (start → deadline). Tabs below use the current day / week / month windows.
					</p>
				</div>
			</div>
			<div className="overflow-y-auto overflow-x-hidden p-3 space-y-4 flex-1 min-h-0">
				{schedules.map((g) => {
					const isHi = highlightGoalId && g.goalId === highlightGoalId;
					return (
						<div
							key={g.goalId}
							className={`rounded-xl border p-3 space-y-2 ${
								isHi
									? "border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/30"
									: "border-white/10 bg-[#111827]/40"
							}`}
						>
							<div className="space-y-1">
								<h2 className="text-sm font-semibold text-white leading-snug pr-1">{g.title}</h2>
								<p className="text-xs text-gray-500 tabular-nums">{periodLabel(g)}</p>
							</div>
							{g.entries.length === 0 ? (
								<p className="text-xs text-gray-500 italic">No quests stored for this program yet.</p>
							) : (
								<ul className="space-y-1.5 border-t border-white/5 pt-2">
									{g.entries.map((e) => (
										<li
											key={e.id}
											className="flex items-start gap-2 text-xs text-gray-200 rounded-md py-1 px-1.5 hover:bg-white/5"
										>
											<span className="mt-0.5 shrink-0 text-gray-500" aria-hidden>
												{e.isCompleted ? (
													<Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
												) : (
													<Circle className="w-3.5 h-3.5 text-gray-600" />
												)}
											</span>
											<div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
												<span className="text-gray-500 tabular-nums shrink-0">{shortDate(e.date)}</span>
												<Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 capitalize ${timeframeStyles(e.timeframe)}`}>
													{e.timeframe}
												</Badge>
												<span className={`min-w-0 break-words ${e.isCompleted ? "text-gray-500 line-through" : "text-gray-100"}`}>
													{e.title}
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					);
				})}
			</div>
		</Card>
	);
}
