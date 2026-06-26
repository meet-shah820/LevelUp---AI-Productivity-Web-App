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
import { trackTutorialCompleted, trackTutorialSkipped } from "../analytics/posthog";
import { ONBOARDING_GOAL_CREATED, ONBOARDING_QUEST_COMPLETED } from "./tutorialEvents";
import { readOnboarding, writeOnboarding, type OnboardingPersisted } from "./tutorialStorage";
import { getTutorialSteps, TUTORIAL_STEPS, type TutorialMode, type TutorialStepDef } from "./tutorialSteps";
import { TutorialOverlay } from "./TutorialOverlay";
import { dispatchSound } from "../audio/sounds";
import {
	playTutorialAdvance,
	playTutorialComplete,
	playTutorialMilestone,
	playTutorialSkip,
	playTutorialStepEnter,
} from "./tutorialSounds";

type TutorialContextValue = {
	/** Tour is visible (modal + optional spotlight). */
	active: boolean;
	mode: TutorialMode;
	step: TutorialStepDef;
	stepIndex: number;
	stepCount: number;
	spotlightRect: DOMRect | null;
	goNext: () => void;
	skipTour: () => void;
	/** Restart the full tour (Goals step is intro-only, not create-a-goal). */
	startTutorial: () => void;
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
	const [mode, setMode] = useState<TutorialMode>("onboarding");
	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
	const [hasGoals, setHasGoals] = useState(false);
	const advancingRef = useRef(false);
	const wasActiveRef = useRef(false);
	const prevStepIndexRef = useRef(-1);

	const steps = useMemo(() => getTutorialSteps(mode, hasGoals), [mode, hasGoals]);
	const stepCount = steps.length;
	const step = steps[Math.min(stepIndex, stepCount - 1)];

	const finishCompleted = useCallback(() => {
		playTutorialComplete();
		if (mode === "onboarding") {
			persistPatch({ completed: true, skipped: false, started: true, stepIndex: stepCount });
			trackTutorialCompleted();
		}
		setActive(false);
	}, [mode, stepCount]);

	const skipTour = useCallback(() => {
		playTutorialSkip();
		if (mode === "onboarding") {
			persistPatch({ skipped: true, completed: false, started: true, stepIndex });
			trackTutorialSkipped(stepIndex);
		}
		setActive(false);
	}, [mode, stepIndex]);

	const advanceToIndex = useCallback(
		(nextIndex: number) => {
			if (advancingRef.current) return;
			advancingRef.current = true;
			const clamped = Math.max(0, Math.min(nextIndex, stepCount - 1));
			const nextStep = steps[clamped];
			if (nextStep?.path && nextStep.path !== location.pathname) {
				navigate(nextStep.path);
			}
			setStepIndex(clamped);
			if (mode === "onboarding") {
				persistPatch({ started: true, stepIndex: clamped, completed: false, skipped: false });
			}
			window.setTimeout(() => {
				advancingRef.current = false;
			}, 80);
		},
		[location.pathname, mode, navigate, stepCount, steps]
	);

	const goNext = useCallback(() => {
		const cur = steps[stepIndex];
		if (!cur || cur.kind !== "next") return;
		if (stepIndex >= stepCount - 1) {
			finishCompleted();
			return;
		}
		playTutorialAdvance();
		advanceToIndex(stepIndex + 1);
	}, [advanceToIndex, finishCompleted, stepCount, stepIndex, steps]);

	const startTutorial = useCallback(() => {
		void (async () => {
			let goals = false;
			try {
				const g = await getGoals();
				goals = Array.isArray((g as { goals?: unknown }).goals) ? (g as { goals: unknown[] }).goals.length >= 1 : false;
			} catch {
				/* ignore */
			}
			setHasGoals(goals);
			setMode("replay");
			setStepIndex(0);
			setActive(true);
			const first = getTutorialSteps("replay", goals)[0];
			if (first?.path && first.path !== location.pathname) {
				navigate(first.path);
			}
		})();
	}, [location.pathname, navigate]);

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
				if (!cancelled) setHasGoals(goalCount >= 1);

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
					if (!cancelled) {
						setMode("onboarding");
						setStepIndex(nextStored.stepIndex);
						setActive(true);
					}
				} else if (!nextStored.started && (goalCount > 0 || qc > 0)) {
					persistPatch({ started: true, completed: true, skipped: false, stepIndex: 0 });
					if (!cancelled) setActive(false);
				}
			} catch {
				if (!cancelled && stored?.started && !stored.completed && !stored.skipped) {
					setMode("onboarding");
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
		if (!active || mode !== "onboarding") return;
		const cur = steps[stepIndex];
		if (!cur || cur.kind !== "quest_completed") return;
		let cancelled = false;
		(async () => {
			try {
				const p = await getProfile();
				if (cancelled) return;
				const qc = Number((p as { quickStats?: { questsCompleted?: number } })?.quickStats?.questsCompleted ?? 0);
				if (qc >= 1 && cur.id === "quests_complete") advanceToIndex(stepIndex + 1);
			} catch {
				/* ignore */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [active, mode, stepIndex, advanceToIndex, steps]);

	useEffect(() => {
		const onGoal = () => {
			if (!active) return;
			if (steps[stepIndex]?.id !== "goals_create") return;
			setHasGoals(true);
			if (mode !== "onboarding") return;
			playTutorialMilestone();
			advanceToIndex(stepIndex + 1);
		};
		const onQuest = () => {
			if (!active || mode !== "onboarding") return;
			if (steps[stepIndex]?.id !== "quests_complete") return;
			playTutorialMilestone();
			advanceToIndex(stepIndex + 1);
		};
		window.addEventListener(ONBOARDING_GOAL_CREATED, onGoal);
		window.addEventListener(ONBOARDING_QUEST_COMPLETED, onQuest);
		return () => {
			window.removeEventListener(ONBOARDING_GOAL_CREATED, onGoal);
			window.removeEventListener(ONBOARDING_QUEST_COMPLETED, onQuest);
		};
	}, [active, mode, stepIndex, advanceToIndex, steps]);

	useEffect(() => {
		if (active && !wasActiveRef.current) {
			dispatchSound("arena_enter", { delayMs: 180 });
		}
		wasActiveRef.current = active;
	}, [active]);

	useEffect(() => {
		if (!active) {
			prevStepIndexRef.current = -1;
			return;
		}
		if (prevStepIndexRef.current === -1) {
			prevStepIndexRef.current = stepIndex;
			if (stepIndex > 0) playTutorialStepEnter(step, stepIndex);
			return;
		}
		if (stepIndex !== prevStepIndexRef.current) {
			playTutorialStepEnter(step, stepIndex);
			prevStepIndexRef.current = stepIndex;
		}
	}, [active, step, stepIndex]);

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
			mode,
			step,
			stepIndex,
			stepCount,
			spotlightRect,
			goNext,
			skipTour,
			startTutorial,
		}),
		[active, mode, step, stepIndex, stepCount, spotlightRect, goNext, skipTour, startTutorial]
	);

	return (
		<TutorialContext.Provider value={value}>
			{children}
			{active ? (
				<TutorialOverlay
					active={active}
					step={step}
					stepIndex={stepIndex}
					stepCount={stepCount}
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
