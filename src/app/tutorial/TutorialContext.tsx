import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getGoals, getProfile } from "../utils/api";
import { ONBOARDING_GOAL_CREATED, ONBOARDING_QUEST_COMPLETED } from "./tutorialEvents";
import { readOnboarding, writeOnboarding, type OnboardingPersisted } from "./tutorialStorage";
import { TUTORIAL_STEPS, type TutorialStepDef } from "./tutorialSteps";
import { TutorialOverlay } from "./TutorialOverlay";

type TutorialContextValue = {
	/** Tour is visible (modal + optional spotlight). */
	active: boolean;
	step: TutorialStepDef;
	stepIndex: number;
	spotlightRect: DOMRect | null;
	goNext: () => void;
	skipTour: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

function persistPatch(patch: Partial<OnboardingPersisted>) {
	const prev = readOnboarding() || {
		started: false,
		completed: false,
		skipped: false,
		stepIndex: 0,
	};
	writeOnboarding({ ...prev, ...patch });
}

export function TutorialProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [active, setActive] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
	const advancingRef = useRef(false);

	const step = TUTORIAL_STEPS[Math.min(stepIndex, TUTORIAL_STEPS.length - 1)];

	const finishCompleted = useCallback(() => {
		persistPatch({ completed: true, skipped: false, started: true, stepIndex: TUTORIAL_STEPS.length });
		setActive(false);
	}, []);

	const skipTour = useCallback(() => {
		persistPatch({ skipped: true, completed: false, started: true, stepIndex });
		setActive(false);
	}, [stepIndex]);

	const advanceToIndex = useCallback(
		(nextIndex: number) => {
			if (advancingRef.current) return;
			advancingRef.current = true;
			const clamped = Math.max(0, Math.min(nextIndex, TUTORIAL_STEPS.length - 1));
			const nextStep = TUTORIAL_STEPS[clamped];
			if (nextStep?.path && nextStep.path !== location.pathname) {
				navigate(nextStep.path);
			}
			setStepIndex(clamped);
			persistPatch({ started: true, stepIndex: clamped, completed: false, skipped: false });
			window.setTimeout(() => {
				advancingRef.current = false;
			}, 80);
		},
		[location.pathname, navigate]
	);

	const goNext = useCallback(() => {
		const cur = TUTORIAL_STEPS[stepIndex];
		if (!cur || cur.kind !== "next") return;
		if (stepIndex >= TUTORIAL_STEPS.length - 1) {
			finishCompleted();
			return;
		}
		advanceToIndex(stepIndex + 1);
	}, [advanceToIndex, finishCompleted, stepIndex]);

	/** Bootstrap from storage + server (new users with no goals / quests). */
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const stored = readOnboarding();
			if (stored?.completed || stored?.skipped) {
				if (!cancelled) setActive(false);
				return;
			}
			try {
				const [g, p] = await Promise.all([getGoals(), getProfile()]);
				if (cancelled) return;
				const goalCount = Array.isArray((g as { goals?: unknown }).goals) ? (g as { goals: unknown[] }).goals.length : 0;
				const qc = Number((p as { quickStats?: { questsCompleted?: number } })?.quickStats?.questsCompleted ?? 0);

				let nextStored: OnboardingPersisted = stored || {
					started: false,
					completed: false,
					skipped: false,
					stepIndex: 0,
				};

				if (!nextStored.started && goalCount === 0 && qc === 0) {
					nextStored = { ...nextStored, started: true, stepIndex: 0 };
					writeOnboarding(nextStored);
				}

				if (nextStored.started && !nextStored.completed && !nextStored.skipped) {
					let idx = nextStored.stepIndex;
					if (idx <= 2 && goalCount >= 1) idx = Math.max(idx, 4);
					if (idx <= 5 && qc >= 1) idx = Math.max(idx, 6);
					idx = Math.min(idx, TUTORIAL_STEPS.length - 1);
					if (idx !== nextStored.stepIndex) {
						nextStored = { ...nextStored, stepIndex: idx };
						writeOnboarding(nextStored);
					}
					setStepIndex(nextStored.stepIndex);
					setActive(true);
				} else if (!nextStored.started && (goalCount > 0 || qc > 0)) {
					persistPatch({ started: true, completed: true, skipped: false, stepIndex: 0 });
					setActive(false);
				}
			} catch {
				if (!cancelled && stored?.started && !stored.completed && !stored.skipped) {
					setStepIndex(stored.stepIndex);
					setActive(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!active) return;
		const cur = TUTORIAL_STEPS[stepIndex];
		if (!cur || cur.kind !== "quest_completed") return;
		let cancelled = false;
		(async () => {
			try {
				const p = await getProfile();
				if (cancelled) return;
				const qc = Number((p as { quickStats?: { questsCompleted?: number } })?.quickStats?.questsCompleted ?? 0);
				if (qc >= 1 && stepIndex === 5) advanceToIndex(6);
			} catch {
				/* ignore */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [active, stepIndex, advanceToIndex]);

	useEffect(() => {
		const onGoal = () => {
			if (!active) return;
			if (TUTORIAL_STEPS[stepIndex]?.id !== "goals_create") return;
			advanceToIndex(3);
		};
		const onQuest = () => {
			if (!active) return;
			if (TUTORIAL_STEPS[stepIndex]?.id !== "quests_complete") return;
			advanceToIndex(6);
		};
		window.addEventListener(ONBOARDING_GOAL_CREATED, onGoal);
		window.addEventListener(ONBOARDING_QUEST_COMPLETED, onQuest);
		return () => {
			window.removeEventListener(ONBOARDING_GOAL_CREATED, onGoal);
			window.removeEventListener(ONBOARDING_QUEST_COMPLETED, onQuest);
		};
	}, [active, stepIndex, advanceToIndex]);

	useLayoutEffect(() => {
		if (!active) {
			setSpotlightRect(null);
			return;
		}
		const sel = step.spotlightSelector;
		if (!sel) {
			setSpotlightRect(null);
			return;
		}
		const update = () => {
			const el = document.querySelector(sel);
			if (el instanceof HTMLElement) setSpotlightRect(el.getBoundingClientRect());
			else setSpotlightRect(null);
		};
		const el0 = document.querySelector(sel);
		if (el0 instanceof HTMLElement) el0.scrollIntoView({ block: "center", behavior: "smooth" });
		update();
		const t = window.setInterval(update, 400);
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);
		return () => {
			window.clearInterval(t);
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [active, step.spotlightSelector, stepIndex, location.pathname]);

	const value = useMemo<TutorialContextValue>(
		() => ({
			active,
			step,
			stepIndex,
			spotlightRect,
			goNext,
			skipTour,
		}),
		[active, step, stepIndex, spotlightRect, goNext, skipTour]
	);

	return (
		<TutorialContext.Provider value={value}>
			{children}
			{active ? (
				<TutorialOverlay
					active={active}
					step={step}
					stepIndex={stepIndex}
					spotlightRect={spotlightRect}
					goNext={goNext}
					skipTour={skipTour}
				/>
			) : null}
		</TutorialContext.Provider>
	);
}

export function useTutorial() {
	const v = useContext(TutorialContext);
	if (!v) throw new Error("useTutorial must be used within TutorialProvider");
	return v;
}

export function useTutorialOptional() {
	return useContext(TutorialContext);
}
