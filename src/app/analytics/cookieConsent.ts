export const COOKIE_CONSENT_KEY = "levelup_cookie_consent";
export const COOKIE_CONSENT_UPDATED_EVENT = "levelup:cookie-consent-updated";

export type CookieConsentChoice = "accepted" | "essential";

export function readCookieConsent(): CookieConsentChoice | null {
	if (typeof window === "undefined") return null;
	const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
	if (raw === "accepted" || raw === "essential") return raw;
	return null;
}

export function hasAnalyticsConsent(): boolean {
	return readCookieConsent() === "accepted";
}

function persistConsent(choice: CookieConsentChoice) {
	localStorage.setItem(COOKIE_CONSENT_KEY, choice);
	window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: choice }));
}

export function grantAnalyticsConsent() {
	persistConsent("accepted");
}

export function revokeAnalyticsConsent() {
	persistConsent("essential");
}
