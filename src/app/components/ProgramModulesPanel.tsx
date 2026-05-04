import { Dumbbell, CalendarRange } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import type { GoalProgramModule, ProgramModulesMovement } from "../utils/api";

function shortDate(iso: string | null | undefined) {
	if (!iso) return "—";
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return "—";
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	} catch {
		return "—";
	}
}

type MovementRow = {
	name: string;
	equipment: string;
	form_cues: string;
	injury_prevention: string;
};

function collectMovements(snapshot: Record<string, unknown> | null): MovementRow[] {
	if (!snapshot || typeof snapshot !== "object") return [];
	const map = new Map<string, MovementRow>();
	const addFromWorkout = (raw: unknown) => {
		if (!raw || typeof raw !== "object") return;
		const w = raw as Record<string, unknown>;
		const name = String(w.name || "").trim();
		if (!name) return;
		const key = name.toLowerCase();
		if (map.has(key)) return;
		map.set(key, {
			name,
			equipment: String(w.equipment || "").trim(),
			form_cues: String(w.form_cues || "").trim(),
			injury_prevention: String(w.injury_prevention || "").trim(),
		});
	};
	const daily = snapshot.daily_quests;
	if (Array.isArray(daily)) {
		for (const day of daily) {
			const dq = day as Record<string, unknown>;
			const wo = dq.workout;
			if (Array.isArray(wo)) wo.forEach(addFromWorkout);
		}
	}
	const recovery = snapshot.recovery_logic as Record<string, unknown> | undefined;
	const struct = recovery?.recovery_quest_structure as Record<string, unknown> | undefined;
	const rw = struct?.workout;
	if (Array.isArray(rw)) rw.forEach(addFromWorkout);
	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

type Props = {
	modules: GoalProgramModule[];
	highlightGoalId?: string;
};

/**
 * Program reference: goal-scoped schedule copy + equipment / movement library from stored AI program.
 * Does not list app quest instances.
 */
export function ProgramModulesPanel({ modules, highlightGoalId }: Props) {
	if (!modules.length) {
		return (
			<Card className="border-purple-500/20 bg-[#0d111c]/90 p-4 text-sm text-gray-400">
				<p className="font-medium text-gray-300 mb-1">Program modules</p>
				<p>No active training programs. Add a program to see schedule and movement details here.</p>
			</Card>
		);
	}

	return (
		<Card className="border-purple-500/25 bg-[#0d111c]/95 overflow-hidden">
			<div className="max-h-[min(70vh,640px)] overflow-y-auto p-3 sm:p-4 space-y-4">
				{modules.map((m) => {
					const snap = m.fitnessPlanSnapshot as Record<string, unknown> | null;
					const profile = (snap?.user_profile || snap?.userProfile) as Record<string, unknown> | undefined;
					const cache = m.programModulesCache;
					const useEnriched =
						Array.isArray(cache?.movements) && (cache?.movements?.length ?? 0) > 0;
					const enrichedList: ProgramModulesMovement[] = useEnriched ? (cache?.movements ?? []) : [];
					const snapshotOnlyMovements = !useEnriched ? collectMovements(snap) : [];
					const isHi = highlightGoalId && m.goalId === highlightGoalId;
					const daily = Array.isArray(snap?.daily_quests) ? (snap?.daily_quests as unknown[]) : [];
					const weekly = Array.isArray(snap?.weekly_quests) ? (snap?.weekly_quests as unknown[]) : [];
					const monthly = Array.isArray(snap?.monthly_quests) ? (snap?.monthly_quests as unknown[]) : [];
					const recovery = snap?.recovery_logic as Record<string, unknown> | undefined;
					return (
						<div
							key={m.goalId}
							className={`rounded-xl border p-4 space-y-4 ${
								isHi
									? "border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/30"
									: "border-white/10 bg-[#111827]/50"
							}`}
						>
							<div>
								<h2 className="text-base font-semibold text-white pr-2">{m.title}</h2>
								<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
									<CalendarRange className="w-3.5 h-3.5 shrink-0" aria-hidden />
									<span className="tabular-nums">
										{shortDate(m.createdAt)} → {m.deadline ? shortDate(m.deadline) : "Open end"}
									</span>
								</div>
								{m.description ? (
									<p className="mt-2 text-sm text-gray-400 leading-relaxed">{m.description}</p>
								) : null}
							</div>

							{(profile?.goal || profile?.level || profile?.days_per_week != null) && (
								<div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-1 text-sm">
									<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Program summary</p>
									{profile?.goal ? <p className="text-gray-200">{String(profile.goal)}</p> : null}
									<div className="flex flex-wrap gap-2 pt-1">
										{profile?.level ? (
											<Badge variant="outline" className="border-white/15 text-gray-300">
												Level: {String(profile.level)}
											</Badge>
										) : null}
										{profile?.days_per_week != null && String(profile.days_per_week).trim() !== "" ? (
											<Badge variant="outline" className="border-white/15 text-gray-300">
												{String(profile.days_per_week)} sessions / week
											</Badge>
										) : null}
									</div>
								</div>
							)}

							<div className="space-y-3">
								<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule overview</p>
								{monthly.length > 0 ? (
									<div className="space-y-2">
										<p className="text-xs text-orange-300/90 font-medium">Monthly milestones</p>
										<ul className="space-y-2 text-sm text-gray-300">
											{monthly.map((row, i) => {
												const r = row as Record<string, unknown>;
												const mo = Number(r.month) || i + 1;
												const g = String(r.goal || r.goal_text || "").trim();
												const pt = String(r.progress_targets || "").trim();
												const line = [g && `Month ${mo}: ${g}`, pt && `Targets: ${pt}`].filter(Boolean).join(" — ");
												return (
													<li key={`m-${m.goalId}-${i}`} className="border-l-2 border-orange-500/40 pl-3 py-0.5">
														{line || `Month ${mo}`}
													</li>
												);
											})}
										</ul>
									</div>
								) : null}
								{weekly.length > 0 ? (
									<div className="space-y-2">
										<p className="text-xs text-purple-300/90 font-medium">Weekly checkpoints</p>
										<ul className="space-y-2 text-sm text-gray-300">
											{weekly.map((row, i) => {
												const r = row as Record<string, unknown>;
												const wk = Number(r.week) || i + 1;
												const obj = String(r.objective || "").trim();
												return (
													<li key={`w-${m.goalId}-${i}`} className="border-l-2 border-purple-500/40 pl-3 py-0.5">
														{obj ? `Week ${wk}: ${obj}` : `Week ${wk}`}
													</li>
												);
											})}
										</ul>
									</div>
								) : null}
								{daily.length > 0 ? (
									<div className="space-y-2">
										<p className="text-xs text-blue-300/90 font-medium">Daily session themes</p>
										<ul className="space-y-1.5 text-sm text-gray-300">
											{daily.slice(0, 14).map((row, i) => {
												const r = row as Record<string, unknown>;
												const day = Number(r.day) || i + 1;
												const tit = String(r.title || "").trim();
												return (
													<li key={`d-${m.goalId}-${i}`} className="flex gap-2">
														<span className="text-gray-500 shrink-0 tabular-nums">Day {day}</span>
														<span className="min-w-0">{tit || "Training session"}</span>
													</li>
												);
											})}
											{daily.length > 14 ? (
												<li className="text-xs text-gray-500 italic pt-1">
													+ {daily.length - 14} more sessions in your generated plan template.
												</li>
											) : null}
										</ul>
									</div>
								) : null}
								{recovery?.trigger_condition ? (
									<p className="text-xs text-teal-300/85 leading-relaxed border border-teal-500/20 rounded-md p-2 bg-teal-500/5">
										<span className="font-medium text-teal-200/95">Recovery protocol: </span>
										{String(recovery.trigger_condition)}
									</p>
								) : null}
								{!monthly.length && !weekly.length && !daily.length ? (
									<p className="text-sm text-gray-500 italic">
										Detailed schedule blocks appear here for programs created with the current generator. Older goals may only show summary lines until you add a new program.
									</p>
								) : null}
							</div>

							<div className="border-t border-white/10 pt-4 space-y-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
										<Dumbbell className="w-4 h-4 text-violet-300" aria-hidden />
										Movements, equipment & safety
									</div>
									{cache?.updatedAt ? (
										<span className="text-[10px] text-gray-600 tabular-nums">
											Stored {new Date(cache.updatedAt).toLocaleString()}
										</span>
									) : null}
								</div>
								{cache?.source === "goal_library_fallback" ? (
									<p className="text-xs text-amber-100/85 bg-amber-500/10 border border-amber-500/25 rounded-md p-2 leading-relaxed">
										These exercises were matched from your <strong className="font-medium text-amber-50">local reference library</strong> using your goal text.
										When the AI program includes daily workout rows, this section merges those names with library + open reference data and saves everything on this goal.
									</p>
								) : null}
								{useEnriched ? (
									<ul className="space-y-4">
										{enrichedList.map((mv) => (
											<li
												key={`${m.goalId}-${mv.name}`}
												className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2 text-sm"
											>
												<div className="flex flex-wrap items-baseline gap-2">
													<span className="font-medium text-white">{mv.name}</span>
													{mv.categoryLabel ? (
														<Badge variant="outline" className="border-slate-500/35 text-slate-200/90 text-[11px]">
															{mv.categoryLabel}
														</Badge>
													) : null}
												</div>
												{mv.equipmentLabels && mv.equipmentLabels.length > 0 ? (
													<div className="flex flex-wrap gap-1.5">
														{mv.equipmentLabels.map((eq) => (
															<Badge
																key={`${mv.name}-${eq}`}
																variant="outline"
																className="border-violet-500/35 text-violet-200/90 text-[11px]"
															>
																{eq}
															</Badge>
														))}
													</div>
												) : mv.equipmentSummary ? (
													<Badge variant="outline" className="border-violet-500/35 text-violet-200/90 text-[11px] w-fit">
														{mv.equipmentSummary}
													</Badge>
												) : null}
												{mv.description ? (
													<div>
														<p className="text-[11px] uppercase text-gray-500 font-medium">Overview</p>
														<p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{mv.description}</p>
													</div>
												) : null}
												{mv.form_cues ? (
													<div>
														<p className="text-[11px] uppercase text-gray-500 font-medium">Form & execution</p>
														<p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{mv.form_cues}</p>
													</div>
												) : null}
												{mv.injury_prevention ? (
													<div>
														<p className="text-[11px] uppercase text-gray-500 font-medium">Safety / injury prevention</p>
														<p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{mv.injury_prevention}</p>
													</div>
												) : null}
												{mv.referenceUrl ? (
													<p className="text-[11px] pt-1">
														<a
															href={mv.referenceUrl}
															target="_blank"
															rel="noopener noreferrer"
															className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
														>
															Reference{mv.referenceSource ? ` (${mv.referenceSource})` : ""}
														</a>
														{mv.licenseShort ? (
															<span className="text-gray-600"> · {mv.licenseShort}</span>
														) : null}
													</p>
												) : null}
											</li>
										))}
									</ul>
								) : snapshotOnlyMovements.length > 0 ? (
									<ul className="space-y-4">
										{snapshotOnlyMovements.map((mv) => (
											<li
												key={`${m.goalId}-${mv.name}`}
												className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2 text-sm"
											>
												<div className="flex flex-wrap items-baseline gap-2">
													<span className="font-medium text-white">{mv.name}</span>
													{mv.equipment ? (
														<Badge variant="outline" className="border-violet-500/35 text-violet-200/90 text-[11px]">
															{mv.equipment}
														</Badge>
													) : null}
												</div>
												{mv.form_cues ? (
													<div>
														<p className="text-[11px] uppercase text-gray-500 font-medium">Form & execution</p>
														<p className="text-gray-300 leading-relaxed">{mv.form_cues}</p>
													</div>
												) : null}
												{mv.injury_prevention ? (
													<div>
														<p className="text-[11px] uppercase text-gray-500 font-medium">Safety / injury prevention</p>
														<p className="text-gray-400 leading-relaxed">{mv.injury_prevention}</p>
													</div>
												) : null}
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-gray-500 leading-relaxed">
										No exercise detail saved yet. Open Program modules again after the server merges library data, or run{" "}
										<code className="text-gray-400 bg-white/5 px-1 rounded">npm run ingest:fitness</code> to load open exercise
										reference data into your database, then reload this page.
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</Card>
	);
}
