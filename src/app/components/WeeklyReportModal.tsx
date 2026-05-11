import { BarChart3, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import type { WeeklyReportShown } from "../utils/api";

type Props = {
	report: WeeklyReportShown;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function WeeklyReportModal({ report, open, onOpenChange }: Props) {
	const { weekLabel, daily, totals, bestDays, improveDays, consistency, ai } = report;
	const score = Math.max(0, Math.min(100, Math.round(Number(ai.productivityScore) || 0)));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto border-purple-500/30 bg-[#0c101c] text-white shadow-2xl shadow-purple-900/40 gap-0 p-0">
				<div className="p-6 sm:p-8 space-y-6">
					<DialogHeader className="space-y-2 text-left">
						<div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
							<BarChart3 className="w-4 h-4" aria-hidden />
							Weekly recap
						</div>
						<DialogTitle className="text-2xl sm:text-3xl font-bold text-white pr-8">
							{ai.headline || "Your week in training"}
						</DialogTitle>
						<DialogDescription className="text-white/55 text-sm sm:text-base">
							{weekLabel} — productivity score reflects quests, XP, focus time, and how steady you were across the week.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-wrap items-end gap-6 rounded-xl border border-white/10 bg-white/[0.04] p-5">
						<div>
							<p className="text-xs uppercase tracking-wide text-white/45 mb-1">Productivity score</p>
							<div className="flex items-baseline gap-1">
								<span className="text-5xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
									{score}
								</span>
								<span className="text-lg text-white/40 mb-1">/ 100</span>
							</div>
							{ai.source === "gemini" ? (
								<p className="text-[11px] text-emerald-400/90 mt-2 flex items-center gap-1">
									<Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden />
									AI-adjusted from your quest activity
								</p>
							) : (
								<p className="text-[11px] text-white/35 mt-2">Score from your activity (AI unavailable)</p>
							)}
						</div>
						<div className="flex-1 min-w-[200px] space-y-2 text-sm text-white/70">
							<p>
								<span className="text-white font-medium">{totals.questsCompleted}</span> quests completed ·{" "}
								<span className="text-white font-medium">{totals.activeDays}</span> active days ·{" "}
								<span className="text-white font-medium">{totals.focusHours.toFixed(1)}</span>h focus
							</p>
							<p className="text-white/60 leading-relaxed">{ai.summary}</p>
						</div>
					</div>

					<div>
						<h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
							Consistency
							<span className="text-xs font-normal text-white/40">(relative XP pulse by day)</span>
						</h3>
						<div className="flex items-end justify-between gap-1.5 h-28 px-1">
							{daily.map((d, i) => {
								const h = Math.max(4, Math.round((consistency[i] ?? 0) * 100));
								return (
									<div key={d.date} className="flex-1 flex flex-col items-center gap-2 min-w-0">
										<div
											className="w-full max-w-[44px] mx-auto rounded-t-md bg-gradient-to-t from-indigo-600/30 to-purple-400/90 border border-purple-500/25"
											style={{ height: `${h}%` }}
											title={`${d.weekdayShort} ${d.date}: ${d.activityXp} XP`}
										/>
										<span className="text-[10px] sm:text-xs text-white/50 truncate w-full text-center">{d.weekdayShort}</span>
									</div>
								);
							})}
						</div>
					</div>

					<div className="grid sm:grid-cols-2 gap-4">
						<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
							<h3 className="text-sm font-semibold text-emerald-200/95 mb-2 flex items-center gap-2">
								<TrendingUp className="w-4 h-4" aria-hidden />
								Best performance
							</h3>
							{bestDays.length === 0 ? (
								<p className="text-sm text-white/45">No standout days yet — even one completed quest starts the trend.</p>
							) : (
								<ul className="space-y-1.5 text-sm text-white/80">
									{bestDays.map((b) => (
										<li key={b.date}>
											<span className="font-medium text-white">{b.weekdayShort}</span>{" "}
											<span className="text-white/45">({b.date})</span> — {b.activityXp.toLocaleString()} XP
										</li>
									))}
								</ul>
							)}
						</div>
						<div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
							<h3 className="text-sm font-semibold text-amber-200/95 mb-2 flex items-center gap-2">
								<TrendingDown className="w-4 h-4" aria-hidden />
								Room to improve
							</h3>
							{improveDays.length === 0 ? (
								<p className="text-sm text-white/45">No weak spots flagged — nice consistency.</p>
							) : (
								<ul className="space-y-1.5 text-sm text-white/80">
									{improveDays.map((b) => (
										<li key={b.date}>
											<span className="font-medium text-white">{b.weekdayShort}</span>{" "}
											<span className="text-white/45">({b.date})</span>
											{b.activityXp === 0 ? " — light or no logged activity" : ` — lower relative XP (${b.activityXp})`}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					{ai.improvementIdeas?.length ? (
						<div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.07] p-4">
							<h3 className="text-sm font-semibold text-indigo-200 mb-2">Ideas for next week</h3>
							<ul className="list-disc pl-5 space-y-1.5 text-sm text-white/75">
								{ai.improvementIdeas.map((t, i) => (
									<li key={i}>{t}</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
				<DialogFooter className="border-t border-white/10 bg-black/20 px-6 py-4 sm:px-8">
					<Button
						type="button"
						className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-600 text-white"
						onClick={() => onOpenChange(false)}
					>
						Got it — go to dashboard
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
