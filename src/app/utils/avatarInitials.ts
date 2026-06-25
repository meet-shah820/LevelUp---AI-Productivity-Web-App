/** Derive 2-letter avatar initials from display name, falling back to username. */
export function avatarInitialsFromProfile(
	displayName?: string | null,
	username?: string | null
): string {
	const dn = String(displayName ?? "").trim();
	const un = String(username ?? "sh").trim();
	const base = dn || un.replace(/_/g, " ");
	const parts = base.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	const clean = base.replace(/[^a-z0-9]/gi, "");
	return (clean.slice(0, 2) || "SH").toUpperCase();
}
