export type OnboardingPersisted = {
	started: boolean;
	completed: boolean;
	skipped: boolean;
	stepIndex: number;
};

const STORAGE_PREFIX = "levelup_onboarding_v2_";

function keyForUser(): string | null {
	try {
		const u = localStorage.getItem("last_username");
		return u && u.trim() ? `${STORAGE_PREFIX}${u.trim()}` : null;
	} catch {
		return null;
	}
}

export function readOnboarding(): OnboardingPersisted | null {
	const k = keyForUser();
	if (!k) return null;
	try {
		const raw = localStorage.getItem(k);
		if (!raw) return null;
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
	} catch {
		/* ignore */
	}
}
