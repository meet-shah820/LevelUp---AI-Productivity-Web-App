import { useLayoutEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import type { TutorialStepDef } from "./tutorialSteps";
import { TUTORIAL_STEPS } from "./tutorialSteps";


function renderBodyMarkdownish(text: string) {
	const parts = text.split(/\*\*(.+?)\*\*/g);
	return parts.map((chunk, i) =>
		i % 2 === 1 ? (
			<strong key={i} className="text-white font-semibold">
				{chunk}
			</strong>
		) : (
			<span key={i}>{chunk}</span>
		)
	);
}

export type TutorialOverlayProps = {
	active: boolean;
	step: TutorialStepDef;
	stepIndex: number;
	spotlightRect: DOMRect | null;
	goNext: () => void;
	skipTour: () => void;
};

const PROGRAM_DIALOG_SELECTOR = '[data-tutorial="program-create-dialog"]';
const PAGE_MAIN_SELECTOR = '[data-tutorial="page-main"]';
const EDGE = 12;
const GAP = 12;
/** Keep text column readable beside the dialog without covering it. */
function minTutorialStripPx(vw: number) {
	return Math.min(336, Math.max(240, Math.round(vw * 0.22)));
}
const MIN_BAND_HEIGHT = 112;
const MIN_BELOW_ZONE = 148;

type ProgramDialogDock = { kind: "none" } | { kind: "sheet" } | { kind: "slot"; wrapperStyle: CSSProperties; justify: "justify-end" | "justify-start" | "justify-center" };

function computeProgramDialogDock(main: DOMRect, dlg: DOMRect): ProgramDialogDock {
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	if (vw < 768) return { kind: "sheet" };

	const mainInsetL = Math.max(EDGE, main.left + EDGE);
	const mainInsetR = Math.min(vw - EDGE, main.right - EDGE);
	const topBand = Math.max(EDGE, main.top + EDGE * 0.5);
	const bottomBand = Math.min(vh - EDGE, main.bottom - EDGE);

	if (mainInsetR - mainInsetL < 96 || bottomBand - topBand < MIN_BAND_HEIGHT) {
		return { kind: "sheet" };
	}

	const minStrip = minTutorialStripPx(vw);

	const leftAvail = dlg.left - GAP - mainInsetL;
	const rightAvail = mainInsetR - (dlg.right + GAP);
	const belowAvail = bottomBand - (dlg.bottom + GAP);

	let side: "left" | "right" | null = null;
	if (leftAvail >= minStrip && rightAvail >= minStrip) side = "left";
	else if (leftAvail >= minStrip) side = "left";
	else if (rightAvail >= minStrip) side = "right";
	if (side === "left") {
		return {
			kind: "slot",
			justify: "justify-end",
			wrapperStyle: {
				position: "fixed",
				zIndex: 60,
				pointerEvents: "none",
				top: topBand,
				bottom: vh - bottomBand,
				left: mainInsetL,
				width: Math.max(160, dlg.left - GAP - mainInsetL),
				display: "flex",
				flexDirection: "row",
				alignItems: "flex-start",
			},
		};
	}
	if (side === "right") {
		return {
			kind: "slot",
			justify: "justify-start",
			wrapperStyle: {
				position: "fixed",
				zIndex: 60,
				pointerEvents: "none",
				top: topBand,
				bottom: vh - bottomBand,
				left: dlg.right + GAP,
				width: Math.max(160, mainInsetR - (dlg.right + GAP)),
				display: "flex",
				flexDirection: "row",
				alignItems: "flex-start",
			},
		};
	}

	if (belowAvail >= MIN_BELOW_ZONE) {
		return {
			kind: "slot",
			justify: "justify-center",
			wrapperStyle: {
				position: "fixed",
				zIndex: 60,
				pointerEvents: "none",
				top: dlg.bottom + GAP,
				bottom: vh - bottomBand,
				left: mainInsetL,
				width: mainInsetR - mainInsetL,
				display: "flex",
				flexDirection: "row",
				alignItems: "flex-start",
			},
		};
	}

	return { kind: "sheet" };
}

export function TutorialOverlay({ active, step, stepIndex, spotlightRect, goNext, skipTour }: TutorialOverlayProps) {
	const location = useLocation();
	const navigate = useNavigate();

	const [programDock, setProgramDock] = useState<ProgramDialogDock>({ kind: "none" });

	useLayoutEffect(() => {
		if (!active || step.kind !== "goal_created") {
			setProgramDock({ kind: "none" });
			return;
		}
		const read = () => {
			const dlgEl = document.querySelector(PROGRAM_DIALOG_SELECTOR);
			const mainEl = document.querySelector(PAGE_MAIN_SELECTOR);
			if (!(dlgEl instanceof HTMLElement && mainEl instanceof HTMLElement)) {
				setProgramDock({ kind: "none" });
				return;
			}
			const dlgR = dlgEl.getBoundingClientRect();
			const mainR = mainEl.getBoundingClientRect();
			const dialogVisible = dlgR.width > 8 && dlgR.height > 8;
			const mainOk = mainR.width > 2 && mainR.height > 2;
			if (!dialogVisible || !mainOk) {
				setProgramDock({ kind: "none" });
				return;
			}
			setProgramDock(computeProgramDialogDock(mainR, dlgR));
		};
		read();
		const id = window.setInterval(read, 200);
		window.addEventListener("resize", read);
		window.addEventListener("scroll", read, true);
		return () => {
			window.clearInterval(id);
			window.removeEventListener("resize", read);
			window.removeEventListener("scroll", read, true);
		};
	}, [active, step.kind]);

	const dockHintOnProgramDialog = Boolean(
		active && step.kind === "goal_created" && programDock.kind !== "none"
	);

	const wrongPage = step.path && location.pathname !== step.path;

	const showNext = step.kind === "next";
	const nextDisabled = wrongPage;

	const hint = useMemo(() => {
		if (!wrongPage) return null;
		return `You are on a different page. Open **${step.path}** from the sidebar, or use the button below.`;
	}, [wrongPage, step.path]);

	const showSpotlight = active && spotlightRect && !dockHintOnProgramDialog;
	const showFullDim = active && !showSpotlight && !dockHintOnProgramDialog;

	const panelClassName =
		"pointer-events-auto w-full min-w-0 rounded-2xl border border-purple-500/35 bg-[#0f1424]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[min(70dvh,32rem)] overflow-y-auto overflow-x-hidden max-w-[min(32rem,calc(100vw-1.25rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))]";

	const defaultFooterWrapClass =
		"fixed bottom-0 left-0 right-0 z-[60] px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:pt-3 pointer-events-none flex justify-center min-h-0";
	const sheetWrapClass =
		"fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center pt-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-4 min-h-0 overflow-x-hidden";

	let wrapOuterClass = defaultFooterWrapClass;
	let wrapOuterStyle: CSSProperties | undefined;
	if (dockHintOnProgramDialog) {
		if (programDock.kind === "sheet") {
			wrapOuterClass = sheetWrapClass;
		} else if (programDock.kind === "slot") {
			wrapOuterClass = `pointer-events-none flex min-h-0 overflow-x-hidden ${programDock.justify}`;
			wrapOuterStyle = programDock.wrapperStyle;
		}
	}

	const wrapPanelClass =
		dockHintOnProgramDialog && programDock.kind === "slot" ? `${panelClassName} shrink-0 max-w-full max-h-full` : panelClassName;

	return (
		<>
			{showSpotlight && spotlightRect ? (
				<div
					className="pointer-events-none fixed z-[55] rounded-xl border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-[top,left,width,height] duration-200 ease-out"
					style={{
						top: spotlightRect.top - 6,
						left: spotlightRect.left - 6,
						width: spotlightRect.width + 12,
						height: spotlightRect.height + 12,
					}}
					aria-hidden
				/>
			) : showFullDim ? (
				<div className="pointer-events-none fixed inset-0 z-[40] bg-black/50" aria-hidden />
			) : null}

			<div className={wrapOuterClass} style={wrapOuterStyle}>
				<div className={wrapPanelClass}>
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300/90 mb-1">
								Step {stepIndex + 1} / {TUTORIAL_STEPS.length}
							</p>
							<h2 className="text-lg sm:text-xl font-bold text-white leading-snug">{step.title}</h2>
						</div>
						<button
							type="button"
							onClick={skipTour}
							className="text-xs text-white/45 hover:text-white/80 shrink-0 pt-1"
						>
							Skip tour
						</button>
					</div>
					<p className="text-sm text-white/70 leading-relaxed">{renderBodyMarkdownish(step.body)}</p>
					{hint ? (
						<p className="text-xs text-amber-200/90 leading-relaxed">{renderBodyMarkdownish(hint)}</p>
					) : null}
					<div className="flex flex-col sm:flex-row gap-2 sm:justify-end sm:items-center">
						{wrongPage ? (
							<Button
								type="button"
								variant="outline"
								className="border-purple-500/40 text-white hover:bg-white/10 w-full sm:w-auto"
								onClick={() => navigate(step.path)}
							>
								Go to {step.path === "/" ? "Dashboard" : step.path}
							</Button>
						) : null}
						{showNext ? (
							<Button
								type="button"
								disabled={nextDisabled}
								className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white disabled:opacity-40"
								onClick={() => goNext()}
							>
								{step.nextLabel || "Next"}
							</Button>
						) : (
							<p className="text-xs text-white/45 sm:text-right flex-1">
								{step.kind === "goal_created"
									? "Waiting for you to create a program…"
									: "Waiting for a quest completion…"}
							</p>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
