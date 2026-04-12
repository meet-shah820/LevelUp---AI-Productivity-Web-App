/** After login / OAuth callback, redirect here instead of home when set. */
export const AUTH_RETURN_PATH_KEY = "levelup_auth_next";

function safeInternalReturnPath(raw: string | null): string | null {
	if (!raw || typeof raw !== "string") return null;
	const t = raw.trim();
	if (!t.startsWith("/") || t.startsWith("//")) return null;
	if (t.includes("://")) return null;
	return t;
}

/** Persist `?next=` from the auth page (e.g. return to Pricing after sign-in). */
export function rememberAuthReturnPathFromSearch(searchParams: URLSearchParams): void {
	const path = safeInternalReturnPath(searchParams.get("next"));
	if (!path) return;
	try {
		sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
	} catch {
		/* ignore */
	}
}

export function setAuthReturnPath(path: string): void {
	const safe = safeInternalReturnPath(path);
	if (!safe) return;
	try {
		sessionStorage.setItem(AUTH_RETURN_PATH_KEY, safe);
	} catch {
		/* ignore */
	}
}

/** Returns stored path once, then clears it. */
export function consumeAuthReturnPath(): string | null {
	try {
		const v = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
		sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
		return v ? safeInternalReturnPath(v) : null;
	} catch {
		return null;
	}
}
