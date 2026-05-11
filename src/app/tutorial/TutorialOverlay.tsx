import { useMemo } from "react";
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
	spotlightRect: DOMRect | null;
	goNext: () => void;
	skipTour: () => void;
};

export function TutorialOverlay({ active, step, stepIndex, spotlightRect, goNext, skipTour }: TutorialOverlayProps) {
	const location = useLocation();
	const navigate = useNavigate();

	const wrongPage = step.path && location.pathname !== step.path;

	const showNext = step.kind === "next";
	const nextDisabled = wrongPage;

	const hint = useMemo(() => {
		if (!wrongPage) return null;
		return `You are on a different page. Open **${step.path}** from the sidebar, or use the button below.`;
	}, [wrongPage, step.path]);

	return (
		<>
			{spotlightRect && active ? (
				<div
					className="pointer-events-none fixed z-[190] rounded-xl border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-[top,left,width,height] duration-200 ease-out"
					style={{
						top: spotlightRect.top - 6,
						left: spotlightRect.left - 6,
						width: spotlightRect.width + 12,
						height: spotlightRect.height + 12,
					}}
					aria-hidden
				/>
			) : active ? (
				<div className="pointer-events-none fixed inset-0 z-[185] bg-black/50" aria-hidden />
			) : null}

			<div className="fixed bottom-0 left-0 right-0 z-[200] p-4 sm:p-6 pointer-events-none flex justify-center">
				<div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-purple-500/35 bg-[#0f1424]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-5 sm:p-6 space-y-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300/90 mb-1">
								Step {stepIndex + 1} / 10
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
