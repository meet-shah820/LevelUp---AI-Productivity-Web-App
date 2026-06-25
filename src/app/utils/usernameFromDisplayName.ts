/** Client-side preview — keep in sync with server/utils/usernameFromDisplayName.js */
export function usernameFromDisplayName(displayName: string, fallback = "shadow_hunter"): string {
	const base = String(displayName || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 32);
	if (base.length >= 3) return base;
	return fallback;
}
