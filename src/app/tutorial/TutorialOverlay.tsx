import { useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import type { TutorialStepDef } from "./tutorialSteps";
import { TUTORIAL_STEPS } from "./tutorialSteps";

/** Keep a viewport rect (e.g. page main) usable for flex positioning on any screen size. */
function clampRectToViewport(rect: DOMRect, margin = 12) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const top = Math.max(margin, rect.top);
	const left = Math.max(margin, rect.left);
	const right = Math.min(vw - margin, rect.right);
	const bottom = Math.min(vh - margin, rect.bottom);
	return {
		top,
		left,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	};
}

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

export function TutorialOverlay({ active, step, stepIndex, spotlightRect, goNext, skipTour }: TutorialOverlayProps) {
	const location = useLocation();
	const navigate = useNavigate();
	/** Page main rect while program dialog is open (dock hint to Training area, not on the modal). */
	const [dockPageMainRect, setDockPageMainRect] = useState<DOMRect | null>(null);
	const [wideForDock, setWideForDock] = useState(
		() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
	);

	const dockHintOnProgramDialog = Boolean(
		active && step.kind === "goal_created" && dockPageMainRect && dockPageMainRect.width > 2 && dockPageMainRect.height > 2
	);

	useLayoutEffect(() => {
		const mq = window.matchMedia("(min-width: 768px)");
		const apply = () => setWideForDock(mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);

	const dockWideLayoutStyle = useMemo(() => {
		if (!dockPageMainRect) return undefined;
		return clampRectToViewport(dockPageMainRect);
	}, [dockPageMainRect]);

	useLayoutEffect(() => {
		if (!active || step.kind !== "goal_created") {
			setDockPageMainRect(null);
			return;
		}
		const read = () => {
			const dlg = document.querySelector(PROGRAM_DIALOG_SELECTOR);
			const mainEl = document.querySelector(PAGE_MAIN_SELECTOR);
			const dialogOpen =
				dlg instanceof HTMLElement && dlg.getBoundingClientRect().width > 2 && dlg.getBoundingClientRect().height > 2;
			if (!dialogOpen || !(mainEl instanceof HTMLElement)) {
				setDockPageMainRect(null);
				return;
			}
			const r = mainEl.getBoundingClientRect();
			if (r.width < 2 || r.height < 2) setDockPageMainRect(null);
			else setDockPageMainRect(r);
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

	const wrongPage = step.path && location.pathname !== step.path;

	const showNext = step.kind === "next";
	const nextDisabled = wrongPage;

	const hint = useMemo(() => {
		if (!wrongPage) return null;
		return `You are on a different page. Open **${step.path}** from the sidebar, or use the button below.`;
	}, [wrongPage, step.path]);

	const showSpotlight = active && spotlightRect && !dockHintOnProgramDialog;
	const showFullDim = active && !showSpotlight && !dockHintOnProgramDialog;

	const dockUseWideCorner = dockHintOnProgramDialog && wideForDock && dockWideLayoutStyle && dockWideLayoutStyle.width > 120;

	const panelClassName =
		"pointer-events-auto w-full min-w-0 rounded-2xl border border-purple-500/35 bg-[#0f1424]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[min(70dvh,32rem)] overflow-y-auto overflow-x-hidden max-w-[min(32rem,calc(100vw-1.25rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))]";

	return (
		<>
			{showSpotlight ? (
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

			<div
				className={
					dockUseWideCorner
						? // md+: keep card inside visible page-main, top-end; rect is clamped to the viewport.
							"fixed z-[60] pointer-events-none flex items-start justify-end p-2 sm:p-3 md:p-4"
						: dockHintOnProgramDialog
							? // Dialog open on narrow screens: bottom sheet so the panel stays reachable.
								"fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center pt-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-4"
							: "fixed bottom-0 left-0 right-0 z-[60] px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:pt-3 pointer-events-none flex justify-center"
				}
				style={dockUseWideCorner && dockWideLayoutStyle ? dockWideLayoutStyle : undefined}
			>
				<div className={dockUseWideCorner ? `${panelClassName} shrink-0` : panelClassName}>
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
