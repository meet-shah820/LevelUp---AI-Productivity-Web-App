import type { CelebrationAchievement } from "../utils/celebration";
import { playSoundEffect, unlockAudioContext, type SoundId } from "./soundEngine";
import { readSoundPreferences } from "./soundPreferences";

export const SOUND_EVENT = "levelup:play-sound";

export type SoundEventDetail = {
	id: SoundId;
	volumeMul?: number;
	delayMs?: number;
};

export function playSound(id: SoundId, volumeMul = 1): void {
	unlockAudioContext();
	playSoundEffect(id, volumeMul);
}

export function dispatchSound(id: SoundId, opts?: { volumeMul?: number; delayMs?: number }): void {
	if (typeof window === "undefined") return;
	const detail: SoundEventDetail = { id, ...opts };
	if (opts?.delayMs && opts.delayMs > 0) {
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent<SoundEventDetail>(SOUND_EVENT, { detail }));
		}, opts.delayMs);
		return;
	}
	window.dispatchEvent(new CustomEvent<SoundEventDetail>(SOUND_EVENT, { detail }));
}

export function playUiClick(): void {
	if (!readSoundPreferences().uiSounds) return;
	playSound("ui_click", 0.85);
}

export function playUiConfirm(): void {
	if (!readSoundPreferences().uiSounds) return;
	playSound("ui_confirm");
}

export type QuestCompleteSoundPayload = {
	leveledUp?: boolean;
	newlyUnlockedAchievements?: CelebrationAchievement[];
	allQuestsComplete?: boolean;
	xpAwarded?: number;
};

/** Instant quest feedback — level/rank/achievement sounds are handled by SoundHost. */
export function dispatchQuestCompleteSounds(payload: QuestCompleteSoundPayload): void {
	playSound("quest_complete");
	if (payload.xpAwarded && payload.xpAwarded > 0) {
		dispatchSound("xp_gain", { delayMs: 120, volumeMul: 0.9 });
	}
}

export const RANK_ORDER = ["E", "D", "C", "B", "A", "S"] as const;

export function rankIndex(rank: string | undefined | null): number {
	const i = RANK_ORDER.indexOf(String(rank || "E").toUpperCase() as (typeof RANK_ORDER)[number]);
	return i >= 0 ? i : 0;
}
