import User from "../models/User.js";

export const HUNTER_RANK_ORDER = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 };

export const LEADERBOARD_RANKS = ["E", "D", "C", "B", "A", "S"];

/** Effective XP multiplier for the viewer while underdog window is active (ranking only). */
export const LEADERBOARD_UNDERDOG_XP_MULT = 1.15;

export function normalizeHunterRank(r) {
	const x = String(r ?? "E").trim().toUpperCase();
	return LEADERBOARD_RANKS.includes(x) ? x : "E";
}

function statSum(u) {
	const s = u.stats || {};
	return (s.strength || 0) + (s.intelligence || 0) + (s.agility || 0) + (s.vitality || 0);
}

function effectiveXpForSort(u, viewerId, underdogActive) {
	const base = u.xp || 0;
	if (!underdogActive || !viewerId) return base;
	if (String(u._id) === String(viewerId)) return base * LEADERBOARD_UNDERDOG_XP_MULT;
	return base;
}

function compareUsers(a, b, viewerId, underdogActive) {
	const xa = effectiveXpForSort(a, viewerId, underdogActive);
	const xb = effectiveXpForSort(b, viewerId, underdogActive);
	if (xb !== xa) return xb - xa;
	const ra = HUNTER_RANK_ORDER[a.rank] ?? 0;
	const rb = HUNTER_RANK_ORDER[b.rank] ?? 0;
	if (rb !== ra) return rb - ra;
	if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
	const sb = statSum(b);
	const sa = statSum(a);
	if (sb !== sa) return sb - sa;
	return String(a.username || "").localeCompare(String(b.username || ""));
}

function publicDisplayName(u) {
	const d = String(u.displayName || "").trim();
	return d || u.username || "Player";
}

/**
 * Sorted leaderboard within one Hunter rank bracket: XP (primary), rank, level, stat sum, username.
 * @param {{ limit?: number; viewerId?: import("mongoose").Types.ObjectId | string | null; rankBracket?: string | null }} opts
 *   rankBracket: E..S — when null/omitted, uses the viewer's current rank (falls back to E if no viewer).
 */
export async function buildLeaderboardSnapshot(opts = {}) {
	const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
	const viewerId = opts.viewerId != null ? String(opts.viewerId) : null;

	let viewerRankNorm = "E";
	let underdogActive = false;
	let underdogUntilRaw = null;
	if (viewerId) {
		const v = await User.findById(viewerId).select("rank leaderboardUnderdogUntil").lean();
		viewerRankNorm = normalizeHunterRank(v?.rank);
		const until = v?.leaderboardUnderdogUntil;
		underdogUntilRaw = until;
		if (until instanceof Date && !Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
			underdogActive = true;
		}
	}

	const rankBracket =
		opts.rankBracket != null && String(opts.rankBracket).trim() !== ""
			? normalizeHunterRank(opts.rankBracket)
			: viewerRankNorm;

	const users = await User.find({ rank: rankBracket })
		.select("username displayName level xp rank stats leaderboardUnderdogUntil")
		.lean();

	users.sort((a, b) => compareUsers(a, b, viewerId, underdogActive));
	const totalUsers = users.length;
	const top = users.slice(0, limit);

	const entries = top.map((u, i) => ({
		position: i + 1,
		userId: String(u._id),
		username: u.username,
		displayName: publicDisplayName(u),
		level: u.level ?? 1,
		xp: u.xp ?? 0,
		rank: u.rank && HUNTER_RANK_ORDER[u.rank] != null ? u.rank : rankBracket,
		statSum: statSum(u),
	}));

	let yourRow = null;
	let viewerLeaderboardUnderdog = null;
	if (viewerId) {
		const idx = users.findIndex((u) => String(u._id) === viewerId);
		if (idx >= 0) {
			const u = users[idx];
			yourRow = {
				position: idx + 1,
				userId: String(u._id),
				username: u.username,
				displayName: publicDisplayName(u),
				level: u.level ?? 1,
				xp: u.xp ?? 0,
				rank: u.rank && HUNTER_RANK_ORDER[u.rank] != null ? u.rank : rankBracket,
				statSum: statSum(u),
			};
		}
		const until =
			underdogUntilRaw instanceof Date && !Number.isNaN(underdogUntilRaw.getTime())
				? underdogUntilRaw
				: null;
		viewerLeaderboardUnderdog = {
			active: underdogActive,
			endsAt: underdogActive && until ? until.toISOString() : null,
			multiplier: LEADERBOARD_UNDERDOG_XP_MULT,
		};
	}

	return {
		entries,
		totalUsers,
		yourRank: yourRow,
		rankBracket,
		viewerHunterRank: viewerId ? viewerRankNorm : null,
		viewerInBracket: Boolean(viewerId && viewerRankNorm === rankBracket),
		viewerLeaderboardUnderdog,
		sort: "xp",
	};
}
