export type SoundPreferences = {
	enabled: boolean;
	volume: number;
	uiSounds: boolean;
};

export const SOUND_PREFS_KEY = "levelup_sound_prefs";
export const SOUND_PREFS_UPDATED_EVENT = "levelup:sound-prefs-updated";

const DEFAULT_PREFS: SoundPreferences = {
	enabled: true,
	volume: 72,
	uiSounds: true,
};

function clampVolume(v: number): number {
	if (!Number.isFinite(v)) return DEFAULT_PREFS.volume;
	return Math.min(100, Math.max(0, Math.round(v)));
}

export function readSoundPreferences(): SoundPreferences {
	try {
		const raw = localStorage.getItem(SOUND_PREFS_KEY);
		if (!raw) return { ...DEFAULT_PREFS };
		const parsed = JSON.parse(raw) as Partial<SoundPreferences>;
		return {
			enabled: parsed.enabled !== false,
			volume: clampVolume(parsed.volume ?? DEFAULT_PREFS.volume),
			uiSounds: parsed.uiSounds !== false,
		};
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function writeSoundPreferences(next: SoundPreferences): void {
	const normalized: SoundPreferences = {
		enabled: next.enabled,
		volume: clampVolume(next.volume),
		uiSounds: next.uiSounds,
	};
	try {
		localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(normalized));
	} catch {
		/* ignore */
	}
	window.dispatchEvent(new CustomEvent(SOUND_PREFS_UPDATED_EVENT));
}

export function getMasterVolumeScalar(): number {
	const { enabled, volume } = readSoundPreferences();
	if (!enabled) return 0;
	return volume / 100;
}
