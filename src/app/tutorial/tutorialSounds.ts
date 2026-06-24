import { dispatchSound, playSound } from "../audio/sounds";
import type { TutorialStepDef } from "./tutorialSteps";

/** Contextual cue when a tutorial step becomes active. */
export function playTutorialStepEnter(step: TutorialStepDef, stepIndex: number): void {
	if (stepIndex === 0) return;

	switch (step.id) {
		case "goals_create":
		case "training_intro":
			dispatchSound("tutorial_focus", { delayMs: 220, volumeMul: 0.9 });
			break;
		case "onboarding_quest":
		case "quests_intro":
			dispatchSound("tutorial_step", { delayMs: 200, volumeMul: 0.85 });
			break;
		case "quests_complete":
		case "quests_complete_intro":
			dispatchSound("tutorial_challenge", { delayMs: 250, volumeMul: 0.92 });
			break;
		case "xp_bar_intro":
			dispatchSound("xp_gain", { delayMs: 200, volumeMul: 0.85 });
			break;
		case "achievements":
			dispatchSound("achievement", { delayMs: 220, volumeMul: 0.65 });
			break;
		case "streak":
			dispatchSound("notification", { delayMs: 200, volumeMul: 0.7 });
			break;
		case "leaderboard":
			dispatchSound("tutorial_challenge", { delayMs: 200, volumeMul: 0.75 });
			break;
		case "settings":
			dispatchSound("tutorial_step", { delayMs: 200, volumeMul: 0.8 });
			break;
		default:
			dispatchSound("tutorial_step", { delayMs: 180, volumeMul: 0.75 });
	}
}

/** Short forward pulse when the user taps Next / Finish. */
export function playTutorialAdvance(): void {
	playSound("tutorial_step", 0.65);
}

/** Auto-advance after completing a required tutorial action. */
export function playTutorialMilestone(): void {
	dispatchSound("tutorial_milestone", { delayMs: 350, volumeMul: 0.9 });
}

export function playTutorialComplete(): void {
	playSound("tutorial_complete");
}

export function playTutorialSkip(): void {
	playSound("tutorial_skip", 0.85);
}
