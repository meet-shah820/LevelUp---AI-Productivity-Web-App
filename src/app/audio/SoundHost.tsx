import { useEffect, useRef } from "react";
import { getDashboard } from "../utils/api";
import { CELEBRATION_EVENT, type CelebrationItem } from "../utils/celebration";
import { ONBOARDING_GOAL_CREATED } from "../tutorial/tutorialEvents";
import { RANK_UPDATED_EVENT } from "../utils/api";
import {
	dispatchSound,
	playSound,
	rankIndex,
	SOUND_EVENT,
	type SoundEventDetail,
} from "./sounds";
import { unlockAudioContext } from "./soundEngine";
import { SOUND_PREFS_UPDATED_EVENT } from "./soundPreferences";

const BOOT_SESSION_KEY = "levelup_system_boot_played";

export function SoundHost() {
	const playerRef = useRef({ level: 1, rank: "E", initialized: false });

	useEffect(() => {
		const unlock = () => unlockAudioContext();
		window.addEventListener("pointerdown", unlock, { once: true });
		window.addEventListener("keydown", unlock, { once: true });
		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
		};
	}, []);

	useEffect(() => {
		try {
			if (!sessionStorage.getItem(BOOT_SESSION_KEY)) {
				sessionStorage.setItem(BOOT_SESSION_KEY, "1");
				window.setTimeout(() => dispatchSound("system_boot", { delayMs: 400 }), 600);
			}
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		const onSound = (e: Event) => {
			const detail = (e as CustomEvent<SoundEventDetail>).detail;
			if (!detail?.id) return;
			playSound(detail.id, detail.volumeMul ?? 1);
		};
		window.addEventListener(SOUND_EVENT, onSound);
		return () => window.removeEventListener(SOUND_EVENT, onSound);
	}, []);

	useEffect(() => {
		const onCelebration = (e: Event) => {
			const items = (e as CustomEvent<{ items: CelebrationItem[] }>).detail?.items?.filter(Boolean) || [];
			for (const item of items) {
				if (item.kind === "all_quests") {
					dispatchSound("all_quests", { delayMs: 80 });
				} else if (item.kind === "achievement") {
					dispatchSound("achievement", { delayMs: 80 });
				}
			}
		};
		window.addEventListener(CELEBRATION_EVENT, onCelebration);
		return () => window.removeEventListener(CELEBRATION_EVENT, onCelebration);
	}, []);

	useEffect(() => {
		const onGoalCreated = () => {
			playSound("mission_accept");
		};
		window.addEventListener(ONBOARDING_GOAL_CREATED, onGoalCreated);
		return () => window.removeEventListener(ONBOARDING_GOAL_CREATED, onGoalCreated);
	}, []);

	useEffect(() => {
		const onRankUpdated = async () => {
			try {
				const dash = await getDashboard();
				const u = dash?.user;
				if (!u) return;

				const nextLevel = Number(u.level) || 1;
				const nextRank = String(u.rank || "E").toUpperCase();
				const snap = playerRef.current;

				if (!snap.initialized) {
					snap.level = nextLevel;
					snap.rank = nextRank;
					snap.initialized = true;
					return;
				}

				const rankIncreased = rankIndex(nextRank) > rankIndex(snap.rank);
				const levelIncreased = nextLevel > snap.level;

				if (levelIncreased) {
					dispatchSound("level_up", { delayMs: 150 });
				}
				if (rankIncreased) {
					dispatchSound("rank_up", { delayMs: levelIncreased ? 750 : 200 });
				}

				snap.level = nextLevel;
				snap.rank = nextRank;
			} catch {
				/* ignore */
			}
		};

		window.addEventListener(RANK_UPDATED_EVENT, onRankUpdated);
		return () => window.removeEventListener(RANK_UPDATED_EVENT, onRankUpdated);
	}, []);

	useEffect(() => {
		const noop = () => {};
		window.addEventListener(SOUND_PREFS_UPDATED_EVENT, noop);
		return () => window.removeEventListener(SOUND_PREFS_UPDATED_EVENT, noop);
	}, []);

	return null;
}
