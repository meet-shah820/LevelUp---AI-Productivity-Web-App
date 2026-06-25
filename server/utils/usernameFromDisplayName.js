import User from "../models/User.js";

/**
 * Derive a username handle from a display name (lowercase, underscores, 3–32 chars).
 */
export function usernameFromDisplayName(displayName, fallback = "shadow_hunter") {
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

/**
 * Pick a unique username derived from displayName, optionally excluding one user id.
 */
export async function pickAvailableUsernameFromDisplayName(displayName, excludeUserId = null, fallback = "shadow_hunter") {
	const base = usernameFromDisplayName(displayName, fallback);
	for (let i = 0; i < 20; i++) {
		const suffix = i === 0 ? "" : `_${Math.floor(Math.random() * 9000 + 1000)}`;
		let candidate = `${base}${suffix}`.slice(0, 32);
		if (candidate.length < 3) candidate = fallback;
		const query = { username: candidate };
		if (excludeUserId) query._id = { $ne: excludeUserId };
		// eslint-disable-next-line no-await-in-loop
		const exists = await User.findOne(query);
		if (!exists) return candidate;
	}
	return `${base}_${Date.now()}`.slice(0, 32);
}

/**
 * Update user.username from user.displayName when possible.
 */
export async function assignUsernameFromDisplayName(user, fallback = "shadow_hunter") {
	const next = await pickAvailableUsernameFromDisplayName(user.displayName, user._id, fallback);
	user.username = next;
	return next;
}
