import { TUTORIAL_STEPS } from "./tutorialSteps";

export type OnboardingPersisted = {
	started: boolean;
	completed: boolean;
	skipped: boolean;
	stepIndex: number;
};

const STORAGE_PREFIX = "levelup_onboarding_v3_";
const LEGACY_PREFIX = "levelup_onboarding_v2_";

function migrateV2StepIndex(oldIdx: number): number {
	const max = TUTORIAL_STEPS.length - 1;
	if (oldIdx <= 0) return Math.min(0, max);
	if (oldIdx === 1) return Math.min(2, max);
	return Math.min(oldIdx + 2, max);
}

function keyForUser(): string | null {
	try {
		const u = localStorage.getItem("last_username");
		return u && u.trim() ? `${STORAGE_PREFIX}${u.trim()}` : null;
	} catch {
		return null;
	}
}

function legacyKeyForUser(): string | null {
	try {
		const u = localStorage.getItem("last_username");
		return u && u.trim() ? `${LEGACY_PREFIX}${u.trim()}` : null;
	} catch {
		return null;
	}
}

export function readOnboarding(): OnboardingPersisted | null {
	const k = keyForUser();
	if (!k) return null;
	try {
		let raw = localStorage.getItem(k);
		if (!raw) {
			const lk = legacyKeyForUser();
			if (!lk) return null;
			const legacyRaw = localStorage.getItem(lk);
			if (!legacyRaw) return null;
			const lj = JSON.parse(legacyRaw) as Partial<OnboardingPersisted>;
			const migrated: OnboardingPersisted = {
				started: !!lj.started,
				completed: !!lj.completed,
				skipped: !!lj.skipped,
				stepIndex: migrateV2StepIndex(typeof lj.stepIndex === "number" && lj.stepIndex >= 0 ? lj.stepIndex : 0),
			};
			try {
				localStorage.setItem(k, JSON.stringify(migrated));
				localStorage.removeItem(lk);
			} catch {
				/* ignore */
			}
			return migrated;
		}
		const j = JSON.parse(raw) as Partial<OnboardingPersisted>;
		return {
			started: !!j.started,
			completed: !!j.completed,
			skipped: !!j.skipped,
			stepIndex: typeof j.stepIndex === "number" && j.stepIndex >= 0 ? j.stepIndex : 0,
		};
	} catch {
		return null;
	}
}

export function writeOnboarding(p: OnboardingPersisted): void {
	const k = keyForUser();
	if (!k) return;
	try {
		localStorage.setItem(k, JSON.stringify(p));
		const lk = legacyKeyForUser();
		if (lk) localStorage.removeItem(lk);
	} catch {
		/* ignore */
	}
}
