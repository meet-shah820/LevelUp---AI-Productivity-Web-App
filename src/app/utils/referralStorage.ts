const STORAGE_KEY = "levelup_pending_referral";

export function storePendingReferralCode(code: string) {
	const normalized = String(code || "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	if (!normalized || typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, normalized);
}

export function readPendingReferralCode(): string | null {
	if (typeof window === "undefined") return null;
	const v = localStorage.getItem(STORAGE_KEY);
	return v && v.trim() ? v.trim() : null;
}

export function clearPendingReferralCode() {
	if (typeof window === "undefined") return;
	localStorage.removeItem(STORAGE_KEY);
}

export function captureReferralFromSearchParams(params: URLSearchParams) {
	const ref = params.get("ref") || params.get("referral");
	if (ref) storePendingReferralCode(ref);
}
