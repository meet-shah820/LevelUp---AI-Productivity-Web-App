import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import type { TutorialStepDef } from "./tutorialSteps";

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
	stepCount: number;
	spotlightRect: DOMRect | null;
	goNext: () => void;
	skipTour: () => void;
};

const PROGRAM_DIALOG_SELECTOR = '[data-tutorial="program-create-dialog"]';
const PAGE_MAIN_SELECTOR = '[data-tutorial="page-main"]';
const OPEN_MODAL_SELECTOR = '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]';
const EDGE = 12;
const GAP = 12;
const OVERLAP_PAD = 10;
/** Matches Layout top bar `h-20` so the tutorial strip sits below it. */
const APP_HEADER_HEIGHT = 80;

/** Keep text column readable beside the dialog without covering it. */
function minTutorialStripPx(vw: number) {
	return Math.min(336, Math.max(240, Math.round(vw * 0.22)));
}
const MIN_BAND_HEIGHT = 112;
const MIN_BELOW_ZONE = 148;

type SlotPlacement = {
	mode: "slot";
	justify: "justify-end" | "justify-start" | "justify-center";
	wrapperStyle: CSSProperties;
};

type EdgePlacement = {
	mode: "edge";
	edge: "top" | "bottom";
	maxHeightPx: number;
};

type TutorialPlacement = SlotPlacement | EdgePlacement;

function inflateRect(rect: DOMRect, pad: number): DOMRect {
	return new DOMRect(rect.left - pad, rect.top - pad, rect.width + pad * 2, rect.height + pad * 2);
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function overlapArea(a: DOMRect, b: DOMRect): number {
	const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
	const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
	return x * y;
}

function totalOverlap(panel: DOMRect, avoid: DOMRect[]): number {
	return avoid.reduce((sum, r) => sum + overlapArea(panel, r), 0);
}

function safeInsets() {
	return { top: EDGE, bottom: EDGE };
}

function panelWidth(vw: number) {
	return Math.min(512, vw - EDGE * 2);
}

function edgePanelRect(edge: "top" | "bottom", vw: number, vh: number, panelW: number, panelH: number, insets: { top: number; bottom: number }) {
	const x = Math.max(EDGE, (vw - panelW) / 2);
	if (edge === "bottom") {
		const y = vh - insets.bottom - EDGE - panelH;
		return new DOMRect(x, y, panelW, panelH);
	}
	const y = insets.top + APP_HEADER_HEIGHT + EDGE;
	return new DOMRect(x, y, panelW, panelH);
}

function maxHeightForEdge(edge: "top" | "bottom", vh: number, insets: { top: number; bottom: number }) {
	const chrome = insets.top + insets.bottom + EDGE * 2 + GAP;
	if (edge === "top") return Math.max(120, Math.min(vh * 0.42, vh - chrome - APP_HEADER_HEIGHT - 120));
	return Math.max(120, Math.min(vh * 0.55, vh - chrome - 96));
}

function collectAvoidRects(spotlightRect: DOMRect | null, includeSpotlight: boolean): DOMRect[] {
	const avoid: DOMRect[] = [];
	avoid.push(new DOMRect(0, 0, window.innerWidth, APP_HEADER_HEIGHT));
	if (includeSpotlight && spotlightRect && spotlightRect.width > 2 && spotlightRect.height > 2) {
		avoid.push(inflateRect(spotlightRect, OVERLAP_PAD));
	}
	document.querySelectorAll(OPEN_MODAL_SELECTOR).forEach((el) => {
		if (!(el instanceof HTMLElement)) return;
		const r = el.getBoundingClientRect();
		if (r.width > 8 && r.height > 8) avoid.push(inflateRect(r, GAP));
	});
	return avoid;
}

function computeDesktopSlot(main: DOMRect, dlg: DOMRect): SlotPlacement | null {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const mainInsetL = Math.max(EDGE, main.left + EDGE);
	const mainInsetR = Math.min(vw - EDGE, main.right - EDGE);
	const topBand = Math.max(EDGE, main.top + EDGE * 0.5);
	const bottomBand = Math.min(vh - EDGE, main.bottom - EDGE);

	if (mainInsetR - mainInsetL < 96 || bottomBand - topBand < MIN_BAND_HEIGHT) return null;

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
			mode: "slot",
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
			mode: "slot",
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
			mode: "slot",
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
	return null;
}

function isProgramDialogVisible(): boolean {
	const dlgEl = document.querySelector(PROGRAM_DIALOG_SELECTOR);
	if (!(dlgEl instanceof HTMLElement)) return false;
	const r = dlgEl.getBoundingClientRect();
	return r.width > 8 && r.height > 8;
}

function computePlacement(
	step: TutorialStepDef,
	spotlightRect: DOMRect | null,
	panelW: number,
	panelH: number
): TutorialPlacement {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const insets = safeInsets();

	const dlgEl = document.querySelector(PROGRAM_DIALOG_SELECTOR);
	const mainEl = document.querySelector(PAGE_MAIN_SELECTOR);
	const dlgVisible = isProgramDialogVisible();

	const programDialogOpen = step.kind === "goal_created" && dlgVisible;

	if (programDialogOpen && mainEl instanceof HTMLElement && dlgEl instanceof HTMLElement && vw >= 768) {
		const slot = computeDesktopSlot(mainEl.getBoundingClientRect(), dlgEl.getBoundingClientRect());
		if (slot) return slot;
	}

	const includeSpotlight = !programDialogOpen;
	const avoid = collectAvoidRects(spotlightRect, includeSpotlight);

	const bottomMax = maxHeightForEdge("bottom", vh, insets);
	const topMax = maxHeightForEdge("top", vh, insets);
	const effectiveH = Math.min(panelH, bottomMax);

	const bottomRect = edgePanelRect("bottom", vw, vh, panelW, effectiveH, insets);
	const topRect = edgePanelRect("top", vw, vh, panelW, Math.min(panelH, topMax), insets);

	const bottomOverlap = totalOverlap(bottomRect, avoid);
	const topOverlap = totalOverlap(topRect, avoid);

	const preferTop = programDialogOpen || (spotlightRect && spotlightRect.top > vh * 0.45);

	if (bottomOverlap === 0 && !preferTop) {
		return { mode: "edge", edge: "bottom", maxHeightPx: bottomMax };
	}
	if (topOverlap === 0) {
		return { mode: "edge", edge: "top", maxHeightPx: topMax };
	}
	if (bottomOverlap === 0) {
		return { mode: "edge", edge: "bottom", maxHeightPx: bottomMax };
	}

	if (preferTop || topOverlap <= bottomOverlap) {
		return { mode: "edge", edge: "top", maxHeightPx: topMax };
	}
	return { mode: "edge", edge: "bottom", maxHeightPx: bottomMax };
}

export function TutorialOverlay({ active, step, stepIndex, stepCount, spotlightRect, goNext, skipTour }: TutorialOverlayProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const panelRef = useRef<HTMLDivElement>(null);
	const [placement, setPlacement] = useState<TutorialPlacement>({ mode: "edge", edge: "bottom", maxHeightPx: 320 });
	const [programDialogOpen, setProgramDialogOpen] = useState(false);

	useLayoutEffect(() => {
		if (!active) return;

		const read = () => {
			const panelEl = panelRef.current;
			const vw = window.innerWidth;
			const panelW = panelEl?.offsetWidth || panelWidth(vw);
			const panelH = panelEl?.offsetHeight || 220;
			setProgramDialogOpen(active && step.kind === "goal_created" && isProgramDialogVisible());
			setPlacement(computePlacement(step, spotlightRect, panelW, panelH));
		};

		read();
		const id = window.setInterval(read, 200);
		window.addEventListener("resize", read);
		window.addEventListener("scroll", read, true);

		const panelEl = panelRef.current;
		let ro: ResizeObserver | undefined;
		if (panelEl && typeof ResizeObserver !== "undefined") {
			ro = new ResizeObserver(read);
			ro.observe(panelEl);
		}

		return () => {
			window.clearInterval(id);
			window.removeEventListener("resize", read);
			window.removeEventListener("scroll", read, true);
			ro?.disconnect();
		};
	}, [active, step, spotlightRect, stepIndex]);

	const dockHintOnProgramDialog = programDialogOpen;

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
		"pointer-events-auto w-full min-w-0 rounded-2xl border border-purple-500/35 bg-[#0f1424]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto overflow-x-hidden max-w-[min(32rem,calc(100vw-1.25rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))]";

	const bottomWrapClass =
		"fixed bottom-0 left-0 right-0 z-[60] px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:pt-3 pointer-events-none flex justify-center min-h-0";
	const topWrapClass =
		"fixed top-20 left-0 right-0 z-[60] px-3 sm:px-4 pt-2 sm:pt-3 pb-2 sm:pb-3 pointer-events-none flex justify-center min-h-0";

	let wrapOuterClass = bottomWrapClass;
	let wrapOuterStyle: CSSProperties | undefined;

	if (placement.mode === "slot") {
		wrapOuterClass = `pointer-events-none flex min-h-0 overflow-x-hidden ${placement.justify}`;
		wrapOuterStyle = placement.wrapperStyle;
	} else if (placement.edge === "top") {
		wrapOuterClass = topWrapClass;
	}

	const panelStyle: CSSProperties | undefined =
		placement.mode === "edge" ? { maxHeight: `${placement.maxHeightPx}px` } : { maxHeight: "100%" };

	const wrapPanelClass =
		placement.mode === "slot" ? `${panelClassName} shrink-0 max-w-full` : panelClassName;

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
				<div ref={panelRef} className={wrapPanelClass} style={panelStyle}>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300/90 mb-1">
								Step {stepIndex + 1} / {stepCount}
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
