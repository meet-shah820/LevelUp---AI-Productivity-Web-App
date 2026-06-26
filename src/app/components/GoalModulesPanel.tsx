import { useState } from "react";
import { motion } from "motion/react";
import {
	Dumbbell,
	CalendarRange,
	Activity,
	Bike,
	Waves,
	CalendarDays,
	Target,
	Sun,
	ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "./ui/dialog";
import type { ReactNode } from "react";
import type { GoalProgramModule, ProgramModulesMovement } from "../utils/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "./ui/utils";

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

/** Icon hint from exercise / activity name (no extra assets). */
function pickMovementIcon(name: string): LucideIcon {
	const n = String(name || "").toLowerCase();
	if (/\b(run|jog|sprint|walk|step|track)\b/.test(n)) return Activity;
	if (/\b(bike|cycle|spin)\b/.test(n)) return Bike;
	if (/\b(swim|pool|row)\b/.test(n)) return Waves;
	if (/\b(yoga|stretch|mobility|foam)\b/.test(n)) return Activity;
	return Dumbbell;
}

type ModuleDetail =
	| { kind: "movement"; scope: "rotation" | "full"; mv: ProgramModulesMovement }
	| { kind: "movement-snap"; mv: MovementRow }
	| { kind: "schedule"; section: "monthly" | "weekly" | "daily"; title: string; body: string };

const SCHEDULE_ICONS: Record<"monthly" | "weekly" | "daily", LucideIcon> = {
	monthly: CalendarDays,
	weekly: Target,
	daily: Sun,
};

function ProgramModulesCollapsibleSection({
	title,
	subtitle,
	titleClassName,
	children,
}: {
	title: string;
	subtitle?: string;
	titleClassName?: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-white/10 bg-black/15 overflow-hidden">
			<CollapsibleTrigger
				type="button"
				className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-lg"
			>
				<div className="min-w-0 space-y-1 pr-2">
					<p className={cn("text-[11px] font-semibold uppercase tracking-wide", titleClassName)}>{title}</p>
					{subtitle ? <p className="text-xs text-gray-500 leading-relaxed">{subtitle}</p> : null}
				</div>
				<ChevronDown
					className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform mt-0.5", open && "rotate-180")}
					aria-hidden
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="border-t border-white/5 px-3 pb-3 pt-3">{children}</CollapsibleContent>
		</Collapsible>
	);
}

function MovementDetailBody({ mv }: { mv: ProgramModulesMovement }) {
	return (
		<div className="space-y-4 text-sm">
			<div className="flex flex-wrap gap-2">
				{mv.categoryLabel ? (
					<Badge variant="outline" className="border-slate-500/35 text-slate-200/90 text-[11px]">
						{mv.categoryLabel}
					</Badge>
				) : null}
				{mv.equipmentLabels && mv.equipmentLabels.length > 0
					? mv.equipmentLabels.map((eq) => (
							<Badge key={eq} variant="outline" className="border-violet-500/35 text-violet-200/90 text-[11px]">
								{eq}
							</Badge>
						))
					: mv.equipmentSummary ? (
							<Badge variant="outline" className="border-violet-500/35 text-violet-200/90 text-[11px]">
								{mv.equipmentSummary}
							</Badge>
						) : null}
			</div>
			{mv.description ? (
				<div>
					<p className="text-[11px] uppercase text-gray-500 font-medium mb-1">Overview</p>
					<p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{mv.description}</p>
				</div>
			) : null}
			{mv.form_cues ? (
				<div>
					<p className="text-[11px] uppercase text-gray-500 font-medium mb-1">Form & execution</p>
					<p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{mv.form_cues}</p>
				</div>
			) : null}
			{mv.injury_prevention ? (
				<div>
					<p className="text-[11px] uppercase text-gray-500 font-medium mb-1">Safety / injury prevention</p>
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
					{mv.licenseShort ? <span className="text-gray-600"> · {mv.licenseShort}</span> : null}
				</p>
			) : null}
		</div>
	);
}

function SnapshotMovementDetailBody({ mv }: { mv: MovementRow }) {
	return (
		<div className="space-y-4 text-sm">
			{mv.equipment ? (
				<Badge variant="outline" className="border-violet-500/35 text-violet-200/90 text-[11px] w-fit">
					{mv.equipment}
				</Badge>
			) : null}
			{mv.form_cues ? (
				<div>
					<p className="text-[11px] uppercase text-gray-500 font-medium mb-1">Form & execution</p>
					<p className="text-gray-300 leading-relaxed">{mv.form_cues}</p>
				</div>
			) : null}
			{mv.injury_prevention ? (
				<div>
					<p className="text-[11px] uppercase text-gray-500 font-medium mb-1">Safety / injury prevention</p>
					<p className="text-gray-400 leading-relaxed">{mv.injury_prevention}</p>
				</div>
			) : null}
		</div>
	);
}

type TileProps = {
	icon: LucideIcon;
	label: string;
	sub?: string;
	highlight?: boolean;
	onClick: () => void;
	index: number;
};

function ProgramTile({ icon: Icon, label, sub, highlight, onClick, index }: TileProps) {
	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, scale: 0.96 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: Math.min(index * 0.03, 0.4), type: "spring", stiffness: 380, damping: 28 }}
			onClick={onClick}
			className="group relative text-left w-full"
		>
			<Card
				className={`relative overflow-hidden transition-all min-h-[132px] flex flex-col items-center justify-center text-center p-4 ${
					highlight
						? "bg-[#1F2937] ring-2 ring-indigo-500/55 ring-offset-2 ring-offset-[#0d111c] border-indigo-500/40 shadow-lg shadow-indigo-500/10"
						: "bg-[#1F2937] border-purple-500/30 group-hover:border-purple-500/50"
				}`}
			>
				<div className="relative z-10 flex flex-col items-center gap-2 w-full">
					<Icon className={`w-8 h-8 shrink-0 ${highlight ? "text-indigo-300" : "text-gray-400 group-hover:text-gray-300"}`} aria-hidden />
					<h3 className="text-sm font-bold leading-tight text-gray-200 line-clamp-3 w-full px-0.5">{label}</h3>
					{sub ? <p className="text-[11px] text-gray-500 line-clamp-2 w-full">{sub}</p> : null}
				</div>
			</Card>
		</motion.button>
	);
}

type Props = {
	modules: GoalProgramModule[];
	highlightGoalId?: string;
};

export function GoalModulesPanel({ modules, highlightGoalId }: Props) {
	const [detail, setDetail] = useState<ModuleDetail | null>(null);
	const dialogOpen = detail !== null;

	if (!modules.length) {
		return (
			<Card className="border-purple-500/20 bg-[#0d111c]/90 p-4 text-sm text-gray-400">
				<p className="font-medium text-gray-300 mb-1">Goal modules</p>
				<p>No active goals. Add a goal to see schedule and movement details here.</p>
			</Card>
		);
	}

	let tileIndex = 0;

	return (
		<>
			<Card className="border-purple-500/25 bg-[#0d111c]/95 overflow-hidden">
				<div className="max-h-[min(75vh,720px)] overflow-y-auto p-3 sm:p-4 space-y-6">
					{modules.map((m) => {
						const snap = m.fitnessPlanSnapshot as Record<string, unknown> | null;
						const profile =
							(m.userProfile && typeof m.userProfile === "object"
								? (m.userProfile as Record<string, unknown>)
								: ((snap?.user_profile || snap?.userProfile) as Record<string, unknown> | undefined));
						const cache = m.programModulesCache;
						const useEnriched =
							Array.isArray(cache?.movements) && (cache?.movements?.length ?? 0) > 0;
						const enrichedList: ProgramModulesMovement[] = useEnriched ? (cache?.movements ?? []) : [];
						const rotationList: ProgramModulesMovement[] = Array.isArray(m.currentRotationMovements)
							? m.currentRotationMovements
							: [];
						const snapshotOnlyMovements = !useEnriched ? collectMovements(snap) : [];
						const isHi = highlightGoalId && m.goalId === highlightGoalId;
						const legacyDaily = Array.isArray(snap?.daily_quests) ? (snap?.daily_quests as unknown[]) : [];
						const legacyWeekly = Array.isArray(snap?.weekly_quests) ? (snap?.weekly_quests as unknown[]) : [];
						const legacyMonthly = Array.isArray(snap?.monthly_quests) ? (snap?.monthly_quests as unknown[]) : [];

						const roadmap = Array.isArray(snap?.roadmap) ? (snap?.roadmap as unknown[]) : [];
						const monthlyPlan = Array.isArray(snap?.monthly_plan) ? (snap?.monthly_plan as unknown[]) : [];
						const weeklyPlan = Array.isArray(snap?.weekly_plan) ? (snap?.weekly_plan as unknown[]) : [];
						const dailyPlan = Array.isArray(snap?.daily_plan) ? (snap?.daily_plan as unknown[]) : [];

						const quests = (snap?.quests as Record<string, unknown> | undefined) || undefined;
						const questsDaily = Array.isArray(quests?.daily) ? (quests?.daily as unknown[]) : [];
						const questsWeekly = Array.isArray(quests?.weekly) ? (quests?.weekly as unknown[]) : [];
						const questsMonthly = Array.isArray(quests?.monthly) ? (quests?.monthly as unknown[]) : [];

						const daily = dailyPlan.length ? dailyPlan : questsDaily.length ? questsDaily : legacyDaily;
						const weekly = weeklyPlan.length ? weeklyPlan : questsWeekly.length ? questsWeekly : legacyWeekly;
						const monthly = monthlyPlan.length ? monthlyPlan : questsMonthly.length ? questsMonthly : legacyMonthly;
						const recovery = snap?.recovery_logic as Record<string, unknown> | undefined;

						return (
							<div
								key={m.goalId}
								className={`rounded-xl border p-4 space-y-6 ${
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
										<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Goal summary</p>
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

								<div className="space-y-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule overview</p>

									{roadmap.length > 0 ? (
										<div className="space-y-2">
											<p className="text-xs text-emerald-300/90 font-medium">Roadmap phases</p>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{roadmap.map((row, i) => {
													const r = row as Record<string, unknown>;
													const phase = String(r.phase_name || r.name || `Phase ${i + 1}`).trim();
													const dur = Number(r.duration_weeks);
													const focus = String(r.focus || "").trim();
													const miles = Array.isArray(r.milestones) ? r.milestones : [];
													const body = [
														dur ? `Duration: ${dur} weeks` : "",
														focus ? `Focus:\n${focus}` : "",
														miles.length
															? `Milestones:\n${miles
																	.map((x) => `- ${String(x || "").trim()}`)
																	.filter((x) => x !== "- ")
																	.slice(0, 12)
																	.join("\n")}`
															: "",
													]
														.filter(Boolean)
														.join("\n\n");
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`r-${m.goalId}-${i}`}
															icon={Target}
															label={phase}
															sub={focus.slice(0, 72) || undefined}
															index={idx}
															onClick={() =>
																setDetail({
																	kind: "schedule",
																	section: "monthly",
																	title: `${m.title} — ${phase}`,
																	body: body || phase,
																})
															}
														/>
													);
												})}
											</div>
										</div>
									) : null}

									{monthly.length > 0 ? (
										<div className="space-y-2">
											<p className="text-xs text-orange-300/90 font-medium">Monthly milestones</p>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{monthly.map((row, i) => {
													const r = row as Record<string, unknown>;
													const mo = Number(r.month) || i + 1;
													const g = String(r.goal || r.goal_text || r.expected_outcome || "").trim();
													const focus = String(r.focus || "").trim();
													const pt = String(r.progress_targets || "").trim();
													const cr = String(r.consistency_requirement || "").trim();
													const title = `Month ${mo}`;
													const body = [
														focus && `Focus:\n${focus}`,
														g && `Outcome: ${g}`,
														pt && `Targets: ${pt}`,
														cr && `Consistency: ${cr}`,
													]
														.filter(Boolean)
														.join("\n\n");
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`m-${m.goalId}-${i}`}
															icon={SCHEDULE_ICONS.monthly}
															label={title}
															sub={g.slice(0, 72) || undefined}
															index={idx}
															onClick={() =>
																setDetail({
																	kind: "schedule",
																	section: "monthly",
																	title: `${m.title} — ${title}`,
																	body: body || `Month ${mo} milestone`,
																})
															}
														/>
													);
												})}
											</div>
										</div>
									) : null}

									{weekly.length > 0 ? (
										<div className="space-y-2">
											<p className="text-xs text-purple-300/90 font-medium">Weekly checkpoints</p>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{weekly.map((row, i) => {
													const r = row as Record<string, unknown>;
													const wk = Number(r.week) || i + 1;
													const focus = String(r.focus || "").trim();
													const obj = String(r.objective || "").trim();
													const wl = String(r.workload || "").trim();
													const notes = String(r.notes || "").trim();
													const sc = String(r.success_criteria || "").trim();
													const ad = String(r.expected_adaptation || "").trim();
													const title = `Week ${wk}`;
													const body = [
														focus && `Focus:\n${focus}`,
														wl && `Workload:\n${wl}`,
														notes && `Notes:\n${notes}`,
														obj && `Objective:\n${obj}`,
														sc && `Success criteria:\n${sc}`,
														ad && `Expected adaptation:\n${ad}`,
													]
														.filter(Boolean)
														.join("\n\n");
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`w-${m.goalId}-${i}`}
															icon={SCHEDULE_ICONS.weekly}
															label={title}
															sub={obj.slice(0, 72) || undefined}
															index={idx}
															onClick={() =>
																setDetail({
																	kind: "schedule",
																	section: "weekly",
																	title: `${m.title} — ${title}`,
																	body: body || title,
																})
															}
														/>
													);
												})}
											</div>
										</div>
									) : null}

									{daily.length > 0 ? (
										<div className="space-y-2">
											<p className="text-xs text-blue-300/90 font-medium">Daily session themes</p>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{daily.map((row, i) => {
													const r = row as Record<string, unknown>;
													const day = Number(r.day) || i + 1;
													const tit = String(r.title || "").trim();
													const focus = String(r.focus || "").trim();
													const objective = String(r.objective || "").trim();
													const workload = String(r.workload || "").trim();
													const notes = String(r.notes || "").trim();
													const desc = String(r.description || "").trim();
													const wo = r.workout;
													const woStr = Array.isArray(wo)
														? (wo as Record<string, unknown>[])
																.map((x) => String(x?.name || "").trim())
																.filter(Boolean)
																.join(", ")
														: "";
													const title = `Day ${day}`;
													const body = [
														tit && `Session: ${tit}`,
														focus && `Focus:\n${focus}`,
														objective && `Objective:\n${objective}`,
														workload && `Workload:\n${workload}`,
														notes && `Notes:\n${notes}`,
														desc && `Description:\n${desc}`,
														woStr && `Exercises: ${woStr}`,
													]
														.filter(Boolean)
														.join("\n\n");
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`d-${m.goalId}-${i}`}
															icon={SCHEDULE_ICONS.daily}
															label={title}
															sub={(tit || focus).slice(0, 72) || "Training session"}
															index={idx}
															onClick={() =>
																setDetail({
																	kind: "schedule",
																	section: "daily",
																	title: `${m.title} — ${title}${tit ? `: ${tit}` : ""}`,
																	body: body || title,
																})
															}
														/>
													);
												})}
											</div>
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
											Detailed schedule blocks appear here for goals created with the current generator. Older goals may only
											show summary lines until you add a new goal.
										</p>
									) : null}
								</div>

								<div className="border-t border-white/10 pt-4 space-y-5">
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
											These exercises were matched from your <strong className="font-medium text-amber-50">local reference library</strong>{" "}
											using your goal text. When the AI goal plan includes daily workout rows, this section merges those names with
											library + open reference data and saves everything on this goal.
										</p>
									) : null}

									<ProgramModulesCollapsibleSection
										title="Current rotation (today + rolling week & month)"
										subtitle="Tap a tile for equipment, form cues, and safety detail for active quests."
										titleClassName="text-teal-400/90"
									>
										{useEnriched && rotationList.length > 0 ? (
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{rotationList.map((mv) => {
													const Icon = pickMovementIcon(mv.name);
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`rot-${m.goalId}-${mv.name}`}
															icon={Icon}
															label={mv.name}
															sub={mv.equipmentSummary || mv.equipmentLabels?.[0]}
															highlight
															index={idx}
															onClick={() => setDetail({ kind: "movement", scope: "rotation", mv })}
														/>
													);
												})}
											</div>
										) : useEnriched && enrichedList.length > 0 ? (
											<p className="text-sm text-gray-500 italic leading-relaxed">
												No movements matched the current quest window yet. Expand full goal below when available.
											</p>
										) : !useEnriched && snapshotOnlyMovements.length > 0 ? (
											<p className="text-sm text-gray-500 italic leading-relaxed">
												Enriched tiles appear after the server saves merged movements. Snapshot exercises are in the full goal
												section below.
											</p>
										) : (
											<p className="text-sm text-gray-500 italic leading-relaxed">No rotation tiles for this goal yet.</p>
										)}
									</ProgramModulesCollapsibleSection>

									<ProgramModulesCollapsibleSection
										title="Full goal"
										subtitle="Every exercise and activity planned for this goal."
										titleClassName="text-violet-300/90"
									>
										{useEnriched && enrichedList.length > 0 ? (
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{enrichedList.map((mv) => {
													const Icon = pickMovementIcon(mv.name);
													const inRot = rotationList.some((r) => r.name === mv.name);
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`full-${m.goalId}-${mv.name}`}
															icon={Icon}
															label={mv.name}
															sub={mv.categoryLabel || mv.equipmentSummary || undefined}
															highlight={inRot}
															index={idx}
															onClick={() => setDetail({ kind: "movement", scope: "full", mv })}
														/>
													);
												})}
											</div>
										) : snapshotOnlyMovements.length > 0 ? (
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{snapshotOnlyMovements.map((mv) => {
													const Icon = pickMovementIcon(mv.name);
													const idx = tileIndex++;
													return (
														<ProgramTile
															key={`snap-${m.goalId}-${mv.name}`}
															icon={Icon}
															label={mv.name}
															sub={mv.equipment || undefined}
															index={idx}
															onClick={() => setDetail({ kind: "movement-snap", mv })}
														/>
													);
												})}
											</div>
										) : (
											<p className="text-sm text-gray-500 leading-relaxed">
												No exercise detail saved yet. Open Goal modules again after the server merges library data, or run{" "}
												<code className="text-gray-400 bg-white/5 px-1 rounded">npm run ingest:fitness</code> to load reference data,
												then reload.
											</p>
										)}
									</ProgramModulesCollapsibleSection>
								</div>
							</div>
						);
					})}
				</div>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={(o) => !o && setDetail(null)}>
				<DialogContent className="bg-[#111827] border-purple-500/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
					{detail?.kind === "schedule" ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-start gap-3 text-left pr-6">
									<div className="w-12 h-12 rounded-xl bg-[#1F2937] border border-purple-500/30 flex items-center justify-center shrink-0">
										{(() => {
											const I = SCHEDULE_ICONS[detail.section];
											return <I className="w-6 h-6 text-indigo-300" aria-hidden />;
										})()}
									</div>
									<span className="leading-snug">{detail.title}</span>
								</DialogTitle>
								<DialogDescription className="text-gray-300 whitespace-pre-wrap text-left pt-2">
									{detail.body}
								</DialogDescription>
							</DialogHeader>
						</>
					) : null}

					{detail?.kind === "movement" ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-start gap-3 text-left pr-6">
									<div
										className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
											detail.scope === "rotation"
												? "bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/25"
												: "bg-[#1F2937] border border-purple-500/30"
										}`}
									>
										{(() => {
											const I = pickMovementIcon(detail.mv.name);
											return <I className="w-6 h-6 text-white" aria-hidden />;
										})()}
									</div>
									<div className="min-w-0">
										<span className="block text-xl font-bold leading-tight">{detail.mv.name}</span>
										<span className="text-sm text-gray-400 font-normal">
											{detail.scope === "rotation" ? "Current rotation" : "Full goal"}
										</span>
									</div>
								</DialogTitle>
							</DialogHeader>
							<MovementDetailBody mv={detail.mv} />
						</>
					) : null}

					{detail?.kind === "movement-snap" ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-start gap-3 text-left pr-6">
									<div className="w-12 h-12 rounded-xl bg-[#1F2937] border border-purple-500/30 flex items-center justify-center shrink-0">
										{(() => {
											const I = pickMovementIcon(detail.mv.name);
											return <I className="w-6 h-6 text-gray-300" aria-hidden />;
										})()}
									</div>
									<span className="text-xl font-bold leading-tight">{detail.mv.name}</span>
								</DialogTitle>
								<DialogDescription className="sr-only">Exercise details from your generated goal</DialogDescription>
							</DialogHeader>
							<SnapshotMovementDetailBody mv={detail.mv} />
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
