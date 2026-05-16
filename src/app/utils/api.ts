const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

import { readSiteAdminBypassActive, SITE_ADMIN_PREVIEW_SECRET } from "./siteAdminBypass";

function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

function getAuthHeaders(): Record<string, string> {
	if (typeof window === "undefined") return {};
	const token = localStorage.getItem("auth_token");
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

async function apiFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers || {});
	// Attach auth if available (makes data user-specific)
	const auth = getAuthHeaders();
	for (const [k, v] of Object.entries(auth)) headers.set(k, v);
	if (typeof window !== "undefined" && readSiteAdminBypassActive()) {
		const fromEnv =
			typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_LEVELUP_ADMIN_PREVIEW_TOKEN
				? String((import.meta as any).env.VITE_LEVELUP_ADMIN_PREVIEW_TOKEN).trim()
				: "";
		const secret = (fromEnv || SITE_ADMIN_PREVIEW_SECRET).trim();
		if (secret) headers.set("X-LevelUp-Admin-Preview", secret);
	}
	return fetch(apiUrl(path), { ...init, headers });
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
	const text = await res.text();
	if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
	try {
		const j = JSON.parse(text) as { error?: string };
		if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
	} catch {
		/* not JSON */
	}
	const t = text.trim().replace(/\s+/g, " ");
	if (t.length > 0 && t.length < 1000) return t;
	return `${fallback} (HTTP ${res.status})`;
}

export async function getDashboard() {
	const res = await apiFetch("/api/dashboard");
	if (!res.ok) throw new Error("Failed to load dashboard");
	return res.json();
}

export class GoalTopicMismatchError extends Error {
	readonly code = "goal_topic_mismatch" as const;
	constructor(
		message: string,
		public readonly suggestions: string[]
	) {
		super(message);
		this.name = "GoalTopicMismatchError";
	}
}

export class TierRequiredError extends Error {
	readonly code = "tier_required" as const;
	constructor(
		message: string,
		public readonly needsTier?: string
	) {
		super(message);
		this.name = "TierRequiredError";
	}
}

export async function createGoal(payload: {
	title: string;
	category?: string;
	rarity?: string;
	/** ISO date string (YYYY-MM-DD) from date input */
	deadline?: string;
	description?: string;
	userProfile?: {
		level?: "beginner" | "intermediate" | "advanced";
		availableDaysPerWeek?: number;
		sessionDurationMinutes?: number;
		equipment?: string;
		constraints?: string;
	};
}) {
	const res = await apiFetch("/api/goals", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await res.json().catch(() => ({}))) as {
		error?: string;
		message?: string;
		suggestions?: string[];
		needsTier?: string;
	};
	if (!res.ok) {
		if (res.status === 422 && body.error === "goal_topic_mismatch") {
			throw new GoalTopicMismatchError(
				typeof body.message === "string" && body.message.trim()
					? body.message
					: "This goal isn’t a fitness or training topic this app supports.",
				Array.isArray(body.suggestions) ? body.suggestions : []
			);
		}
		if (res.status === 403 && body.error === "tier_required") {
			throw new TierRequiredError(
				typeof body.message === "string" && body.message.trim()
					? body.message.trim()
					: "Upgrade your plan for this action.",
				typeof body.needsTier === "string" ? body.needsTier : undefined
			);
		}
		throw new Error(typeof body.error === "string" ? body.error : "Failed to create goal");
	}
	return body;
}

export async function getGoals() {
	const res = await apiFetch("/api/goals");
	if (!res.ok) throw new Error("Failed to load goals");
	return res.json();
}

/** Stored fitness program snapshot from goal creation (AI). */
export type FitnessPlanSnapshot = Record<string, unknown> | null;

export type ProgramModulesMovement = {
	name: string;
	equipmentSummary?: string;
	equipmentLabels?: string[];
	description?: string;
	form_cues?: string;
	injury_prevention?: string;
	referenceSource?: string | null;
	referenceUrl?: string | null;
	licenseShort?: string | null;
	categoryLabel?: string;
	fromGoalContextFallback?: boolean;
};

export type ProgramModulesCachePayload = {
	version?: number;
	updatedAt?: string;
	/** snapshot = from AI workout names; goal_library_fallback = goal text + library search */
	source?: string;
	movements: ProgramModulesMovement[];
};

export type GoalProgramModule = {
	goalId: string;
	title: string;
	description: string;
	deadline: string | null;
	createdAt: string | null;
	fitnessPlanSnapshot: FitnessPlanSnapshot;
	userProfile?: {
		level?: "beginner" | "intermediate" | "advanced";
		availableDaysPerWeek?: number;
		sessionDurationMinutes?: number;
		equipment?: string;
		constraints?: string;
	} | null;
	/** Persisted merged reference + AI content for Program modules */
	programModulesCache: ProgramModulesCachePayload | null;
	/** Movements tied to today's dailies + current rolling week/month quests */
	currentRotationMovements?: ProgramModulesMovement[];
};

export async function getGoalProgramModules(): Promise<{ modules: GoalProgramModule[] }> {
	const res = await apiFetch("/api/goals/program-modules");
	if (!res.ok) throw new Error("Failed to load program modules");
	return res.json();
}

export async function deleteGoal(goalId: string) {
	const res = await apiFetch(`/api/goals/${encodeURIComponent(goalId)}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Failed to delete goal");
	return res.json();
}

export async function updateGoal(
	goalId: string,
	payload: {
		title?: string;
		description?: string;
		deadline?: string;
		rarity?: string;
		userProfile?: {
			level?: "beginner" | "intermediate" | "advanced";
			availableDaysPerWeek?: number;
			sessionDurationMinutes?: number;
			equipment?: string;
			constraints?: string;
		};
	}
) {
	const res = await apiFetch(`/api/goals/${encodeURIComponent(goalId)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const body = (await res.json().catch(() => ({}))) as {
		error?: string;
		message?: string;
		suggestions?: string[];
		ok?: boolean;
		realigned?: boolean;
		needsTier?: string;
	};
	if (!res.ok) {
		if (res.status === 422 && body.error === "goal_topic_mismatch") {
			throw new GoalTopicMismatchError(
				typeof body.message === "string" && body.message.trim()
					? body.message
					: "This goal isn’t a fitness or training topic this app supports.",
				Array.isArray(body.suggestions) ? body.suggestions : []
			);
		}
		if (res.status === 403 && body.error === "tier_required") {
			throw new TierRequiredError(
				typeof body.message === "string" && body.message.trim()
					? body.message.trim()
					: "Upgrade your plan for AI program updates.",
				typeof body.needsTier === "string" ? body.needsTier : undefined
			);
		}
		throw new Error(typeof body.error === "string" ? body.error : "Failed to update goal");
	}
	return body;
}

/** Regenerate AI quest templates from current DB context + goal text (replaces incomplete future quests). */
export async function refreshGoalQuests(goalId: string) {
	const res = await apiFetch(`/api/goals/${encodeURIComponent(goalId)}/refresh-quests`, {
		method: "POST",
	});
	const body = (await res.json().catch(() => ({}))) as {
		error?: string;
		message?: string;
		suggestions?: string[];
	};
	if (!res.ok) {
		if (res.status === 422 && body.error === "goal_topic_mismatch") {
			throw new GoalTopicMismatchError(
				typeof body.message === "string" && body.message.trim()
					? body.message
					: "This goal isn’t a fitness or training topic this app supports.",
				Array.isArray(body.suggestions) ? body.suggestions : []
			);
		}
		throw new Error(typeof body.error === "string" ? body.error : "Failed to refresh quests");
	}
	return body;
}

export async function revertQuest(questId: string) {
	const res = await apiFetch(`/api/quests/${questId}/revert`, { method: "PATCH" });
	if (!res.ok) throw new Error("Failed to revert quest");
	return res.json();
}

export async function completeQuest(
	questId: string,
	payload?: { timerActiveSeconds?: number }
) {
	const res = await apiFetch(`/api/quests/${encodeURIComponent(questId)}/complete`, {
		method: "PATCH",
		headers: payload ? { "Content-Type": "application/json" } : undefined,
		body: payload ? JSON.stringify(payload) : undefined,
	});
	if (!res.ok) throw new Error("Failed to complete quest");
	return res.json();
}

export async function getAchievements() {
	const res = await apiFetch("/api/achievements");
	if (!res.ok) throw new Error("Failed to load achievements");
	return res.json();
}

export async function getAnalytics() {
	const res = await apiFetch("/api/analytics");
	if (!res.ok) throw new Error("Failed to load analytics");
	return res.json();
}

export const PROFILE_UPDATED_EVENT = "app:profile-updated";

/** Fired after server-side rank may have changed (quests, focus, goals, achievements). */
export const RANK_UPDATED_EVENT = "app:rank-updated";

export const BILLING_UPDATED_EVENT = "app:billing-updated";

export class BillingApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.name = "BillingApiError";
		this.status = status;
		this.code = code;
	}
}

export async function getProfile() {
	const res = await apiFetch("/api/profile");
	if (!res.ok) throw new Error("Failed to load profile");
	return res.json();
}

export type PatchProfilePayload = {
	username?: string;
	displayName?: string;
	email?: string;
	bio?: string;
	/** data:image/jpeg;base64,... */
	avatarDataUrl?: string;
	clearAvatar?: boolean;
};

export async function patchProfile(payload: PatchProfilePayload) {
	const body = Object.fromEntries(
		Object.entries(payload).filter(([, v]) => v !== undefined),
	) as Record<string, unknown>;
	const res = await apiFetch("/api/profile", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((out as { error?: string }).error || "Failed to update profile");
	return out;
}

export async function getSettings() {
	const res = await apiFetch("/api/settings");
	if (!res.ok) throw new Error("Failed to load settings");
	return res.json();
}

export async function saveSettings(payload: { notifications: any }) {
	const res = await apiFetch("/api/settings", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to save settings");
	return res.json();
}

export async function changePassword(payload: { username: string; currentPassword: string; newPassword: string }) {
	const res = await apiFetch("/api/auth/change-password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to change password");
	return res.json();
}

export async function resetAll() {
	const res = await apiFetch("/api/admin/reset", { method: "POST" });
	if (!res.ok) throw new Error("Failed to reset");
	return res.json();
}

function friendlyDeleteAccountError(status: number, text: string): string {
	const t = text.trim();
	if (t.includes("<!DOCTYPE") || t.includes("<html") || t.includes("<pre>Cannot")) {
		return `The server could not delete your account (HTTP ${status}). Restart the API server so it has the latest routes, or check VITE_API_BASE points at your Express API.`;
	}
	if (t) {
		try {
			const j = JSON.parse(t) as { error?: string };
			if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
		} catch {
			return t.slice(0, 280);
		}
	}
	return `Failed to delete account (HTTP ${status})`;
}

export async function deleteAccount(): Promise<{ ok: boolean }> {
	const attempts: { path: string; method: string }[] = [
		{ path: "/api/auth/account", method: "DELETE" },
		{ path: "/api/delete-account", method: "POST" },
		{ path: "/api/auth/delete-account", method: "POST" },
		{ path: "/api/auth/account/delete", method: "POST" },
	];

	let lastStatus = 0;
	let lastText = "";

	for (const { path, method } of attempts) {
		const res = await apiFetch(path, { method });
		lastStatus = res.status;
		lastText = await res.text();
		if (res.ok) {
			try {
				return lastText.trim() ? (JSON.parse(lastText) as { ok: boolean }) : { ok: true };
			} catch {
				return { ok: true };
			}
		}
		if (lastStatus !== 404 && lastStatus !== 405) {
			throw new Error(friendlyDeleteAccountError(lastStatus, lastText));
		}
	}

	throw new Error(friendlyDeleteAccountError(lastStatus, lastText));
}

export async function getQuests(timeframe: "daily" | "weekly" | "monthly", difficulty?: "easy" | "medium" | "hard") {
	const params = new URLSearchParams({ timeframe });
	if (difficulty) params.set("difficulty", difficulty);
	const res = await apiFetch(`/api/quests?${params.toString()}`);
	if (!res.ok) throw new Error("Failed to load quests");
	return res.json();
}

export type QuestExerciseItem = {
	key: string;
	label: string;
	meta: string | null;
	completed: boolean;
	completedAt: string | null;
};

export type QuestDetailsPayload = {
	quest: {
		id: string;
		title: string;
		xpReward: number;
		statType: string;
		type: string;
		isCompleted: boolean;
		goalId?: string;
		/** easy | medium | hard */
		difficulty?: string;
	};
	/** Workout rows from program snapshot or briefing steps; persisted checkbox state per key. */
	exercises?: QuestExerciseItem[];
	isPenaltyActive?: boolean;
	originalTitle?: string;
	goal: { id: string; title: string; category: string } | null;
	details: {
		summary: string;
		/** Plain language: goal, stat, and why this quest matters when finished. */
		whatYouImprove: string;
		/** One checkable line: when to tap Complete. */
		doneWhen: string;
		steps: string[];
		tips?: string;
		source?: string;
		/** Legacy v2 fields — optional if old cached payloads appear. */
		requirements?: string;
		howTo?: string;
	};
};

export async function getQuestDetails(questId: string): Promise<QuestDetailsPayload> {
	const res = await apiFetch(`/api/quests/${encodeURIComponent(questId)}/details`);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to load quest details");
	return body as QuestDetailsPayload;
}

export async function patchQuestExerciseCheck(
	questId: string,
	key: string,
	completed: boolean
): Promise<{ exercises: QuestExerciseItem[] }> {
	const res = await apiFetch(`/api/quests/${encodeURIComponent(questId)}/exercise-check`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key, completed }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to update checklist");
	return body as { exercises: QuestExerciseItem[] };
}

export async function getRecentHistory() {
	const res = await apiFetch("/api/history/recent");
	if (!res.ok) throw new Error("Failed to load history");
	return res.json();
}

export type BillingTierId = "free" | "starter" | "pro" | "elite";

export type BillingStatus = {
	tier: BillingTierId;
	subscriptionStatus: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	hasStripeCustomer: boolean;
	checkoutAvailable: boolean;
};

export async function getBillingStatus(): Promise<BillingStatus> {
	const res = await apiFetch("/api/billing/status");
	if (!res.ok) throw new Error("Failed to load billing status");
	return res.json();
}

export type BillingPlanTier = {
	id: BillingTierId;
	name: string;
	tagline: string;
	monthlyPriceCents: number;
	/** ISO 4217 from Stripe Price (e.g. usd, cad) */
	currency: string;
	/** stripe = from live Price retrieve; fallback = Stripe off or error */
	pricingSource?: "stripe" | "fallback";
	features: string[];
	highlight?: boolean;
	stripeConfigured: boolean;
	hasPriceId: boolean;
	/** False when STRIPE_SECRET_KEY cannot retrieve this tier's Price object */
	stripePriceReachable?: boolean;
};

export type BillingPlansResponse = {
	tiers: BillingPlanTier[];
	checkoutAvailable: boolean;
	/** Shown when Price IDs are set but secret key cannot load them (account / mode mismatch) */
	plansNotice?: string | null;
};

export async function getBillingPlans(): Promise<BillingPlansResponse> {
	const res = await apiFetch("/api/billing/plans");
	if (!res.ok) throw new Error("Failed to load plans");
	return res.json();
}

export async function createBillingCheckoutSession(tier: Exclude<BillingTierId, "free">): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/checkout-session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tier }),
	});
	const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
	if (!res.ok) {
		throw new BillingApiError(body.error || "Failed to start checkout", res.status, body.code);
	}
	return body as { url: string };
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/portal-session", { method: "POST" });
	const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
	if (!res.ok) {
		throw new BillingApiError(body.error || "Failed to open billing portal", res.status, body.code);
	}
	return body as { url: string };
}

export async function cancelBillingSubscription(when: "period_end" | "immediately"): Promise<{ ok: boolean; when: string }> {
	const res = await apiFetch("/api/billing/cancel-subscription", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ when }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to cancel subscription");
	return body as { ok: boolean; when: string };
}

export async function resumeBillingSubscription(): Promise<{ ok: boolean }> {
	const res = await apiFetch("/api/billing/resume-subscription", { method: "POST" });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to resume subscription");
	return body as { ok: boolean };
}

export type BillingPaymentRow = {
	id: string;
	source: string;
	created: string;
	amount: number;
	currency: string;
	status: string;
	description: string;
	receiptUrl: string | null;
	hostedInvoiceUrl: string | null;
};

export async function getBillingPaymentHistory(): Promise<{ payments: BillingPaymentRow[] }> {
	const res = await apiFetch("/api/billing/payment-history");
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to load payment history");
	return body as { payments: BillingPaymentRow[] };
}

export type StreakCalendarDay = {
	date: string;
	completedCount: number;
	hasCompletion: boolean;
};

export type StreakCalendarResponse = {
	range: { from: string; to: string };
	days: StreakCalendarDay[];
	currentStreak: { length: number; start: string | null; end: string | null };
	longestStreak: { length: number; start: string | null; end: string | null };
};

export async function getStreakCalendar(fromISO?: string, toISO?: string): Promise<StreakCalendarResponse> {
	const params = new URLSearchParams();
	if (fromISO) params.set("from", fromISO);
	if (toISO) params.set("to", toISO);
	const qs = params.toString();
	const res = await apiFetch(`/api/streak/calendar${qs ? `?${qs}` : ""}`);
	if (!res.ok) throw new Error("Failed to load streak calendar");
	return res.json();
}

export type WeeklyReportDay = {
	date: string;
	weekdayShort: string;
	activityXp: number;
	focusHours: number;
	approxQuestEvents: number;
};

export type WeeklyReportAi = {
	productivityScore: number;
	headline: string;
	summary: string;
	improvementIdeas: string[];
	source?: string;
};

export type WeeklyReportDismissed = {
	showModal: false;
	reportWeekId: string;
};

export type WeeklyReportShown = {
	showModal: true;
	reportWeekId: string;
	weekLabel: string;
	daily: WeeklyReportDay[];
	totals: { questsCompleted: number; focusHours: number; activeDays: number };
	bestDays: { date: string; weekdayShort: string; activityXp: number }[];
	improveDays: { date: string; weekdayShort: string; activityXp: number }[];
	consistency: number[];
	ai: WeeklyReportAi;
};

export type WeeklyReportResponse = WeeklyReportDismissed | WeeklyReportShown;

export async function getWeeklyReport(): Promise<WeeklyReportResponse> {
	const res = await apiFetch("/api/weekly-report");
	if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load weekly report"));
	return res.json() as Promise<WeeklyReportResponse>;
}

export async function ackWeeklyReport(reportWeekId: string): Promise<void> {
	const res = await apiFetch("/api/weekly-report/ack", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ reportWeekId }),
	});
	if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to save weekly report"));
}

export type LeaderboardEntry = {
	position: number;
	userId: string;
	username: string;
	displayName: string;
	level: number;
	xp: number;
	rank: string;
	statSum: number;
};

export type LeaderboardUnderdogInfo = {
	active: boolean;
	endsAt: string | null;
	multiplier: number;
};

export type LeaderboardResponse = {
	entries: LeaderboardEntry[];
	totalUsers: number;
	yourRank: LeaderboardEntry | null;
	/** Hunter rank bracket for this board (E–S). */
	rankBracket: string;
	/** Signed-in viewer's actual Hunter rank. */
	viewerHunterRank: string | null;
	/** True when the viewer is in the same bracket as `rankBracket` (they can appear in `yourRank`). */
	viewerInBracket: boolean;
	viewerLeaderboardUnderdog?: LeaderboardUnderdogInfo | null;
	sort: string;
};

const LEADERBOARD_RANK_QUERY = new Set(["E", "D", "C", "B", "A", "S"]);

export const LEADERBOARD_REQUIRES_GOOGLE_CODE = "leaderboard_requires_google";

/** Thrown when the signed-in user has no Google-linked account (username/password only). */
export class LeaderboardRequiresGoogleError extends Error {
	readonly code = LEADERBOARD_REQUIRES_GOOGLE_CODE;
	constructor() {
		super("Leaderboard is only available when your account is signed in with Google.");
		this.name = "LeaderboardRequiresGoogleError";
	}
}

export async function getLeaderboard(limit = 50, rank?: string): Promise<LeaderboardResponse> {
	const params = new URLSearchParams({ limit: String(limit) });
	const r = rank != null ? String(rank).trim().toUpperCase() : "";
	if (r && LEADERBOARD_RANK_QUERY.has(r)) params.set("rank", r);
	const res = await apiFetch(`/api/leaderboard?${params.toString()}`);
	if (res.status === 403) {
		const body = (await res.json().catch(() => ({}))) as {
			code?: string;
			requiresGoogle?: boolean;
			error?: string;
		};
		if (body.code === LEADERBOARD_REQUIRES_GOOGLE_CODE || body.requiresGoogle === true) {
			throw new LeaderboardRequiresGoogleError();
		}
		const msg = typeof body.error === "string" && body.error.trim() ? body.error.trim() : "Forbidden";
		throw new Error(msg);
	}
	if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load leaderboard"));
	return res.json();
}

const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:5000";

/**
 * WebSocket URL for live leaderboard updates (requires auth token in localStorage).
 * In dev, connects straight to the API host (not through the Vite WS proxy) to avoid flaky proxies / ECONNRESET.
 */
export function getLeaderboardWebSocketUrl(): string {
	if (typeof window === "undefined") return "";
	const token = localStorage.getItem("auth_token");
	if (!token) return "";
	const enc = encodeURIComponent(token);
	const apiBase = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";
	if (apiBase && /^https?:\/\//i.test(String(apiBase))) {
		const u = new URL(String(apiBase));
		const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
		return `${wsProto}//${u.host}/ws/leaderboard?token=${enc}`;
	}
	if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
		const raw = String((import.meta as any).env?.VITE_DEV_API_ORIGIN || DEFAULT_DEV_API_ORIGIN).replace(/\/$/, "");
		try {
			const u = new URL(raw);
			const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
			return `${wsProto}//${u.host}/ws/leaderboard?token=${enc}`;
		} catch {
			/* fall through */
		}
	}
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${window.location.host}/ws/leaderboard?token=${enc}`;
}
