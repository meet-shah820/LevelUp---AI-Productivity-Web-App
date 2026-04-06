import User from "../models/User.js";

const DEFAULT_USERNAME = "shadow_hunter";

/**
 * Single canonical user for the demo app (oldest account).
 * Do not look up by hardcoded username — it breaks after rename.
 */
export async function getOrCreateDemoUser() {
	let user = await User.findOne().sort({ createdAt: 1 }).exec();
	if (!user) {
		user = await User.create({ username: DEFAULT_USERNAME });
	}
	return user;
}
