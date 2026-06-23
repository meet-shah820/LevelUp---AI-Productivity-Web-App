import posthog from "posthog-js";

const POSTHOG_KEY =
	(typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_POSTHOG_KEY) ||
	"";
const POSTHOG_HOST =
	(typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_POSTHOG_HOST) ||
	"https://us.i.posthog.com";

let initialized = false;

export function isPostHogEnabled(): boolean {
	return Boolean(POSTHOG_KEY.trim());
}

export function initPostHog(): void {
	if (initialized || typeof window === "undefined" || !isPostHogEnabled()) return;

	posthog.init(POSTHOG_KEY.trim(), {
		api_host: POSTHOG_HOST.replace(/\/$/, ""),
		person_profiles: "identified_only",
		capture_pageview: false,
		capture_pageleave: true,
		autocapture: true,
		session_recording: {
			maskAllInputs: true,
			maskTextSelector: "[data-ph-mask]",
		},
	});

	initialized = true;
}

export function getPostHog() {
	return initialized ? posthog : null;
}

function readAuthUserId(): string | null {
	if (typeof window === "undefined") return null;
	const token = localStorage.getItem("auth_token");
	if (!token) return null;
	try {
		const segment = token.split(".")[1];
		if (!segment) return null;
		const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
		const payload = JSON.parse(json) as { uid?: string; username?: string };
		if (payload.uid) return String(payload.uid);
		if (payload.username) return String(payload.username);
	} catch {
		/* invalid token */
	}
	return null;
}

export function identifyUser(props: {
	username?: string;
	email?: string;
	tier?: string;
	level?: number;
	rank?: string;
	questsCompleted?: number;
}) {
	if (!initialized) return;
	const distinctId = readAuthUserId();
	if (!distinctId) return;

	const personProps: Record<string, string | number> = {};
	if (props.username) personProps.username = props.username;
	if (props.email) personProps.email = props.email;
	if (props.tier) personProps.subscription_tier = props.tier;
	if (typeof props.level === "number") personProps.level = props.level;
	if (props.rank) personProps.hunter_rank = props.rank;
	if (typeof props.questsCompleted === "number") personProps.quests_completed = props.questsCompleted;

	posthog.identify(distinctId, personProps);
}

export function resetUser() {
	if (!initialized) return;
	posthog.reset();
}

export function capturePageView(path: string) {
	if (!initialized) return;
	posthog.capture("$pageview", { $current_url: window.location.origin + path });
}

type AuthMethod = "email" | "google";

export function trackUserSignedUp(method: AuthMethod, hasReferral: boolean) {
	capture("user_signed_up", { method, has_referral: hasReferral });
}

export function trackUserLoggedIn(method: AuthMethod) {
	capture("user_logged_in", { method });
}

export function trackReferralCodeCaptured() {
	capture("referral_code_captured");
}

export function trackGoalCreated(props: { category: string; rarity: string }) {
	capture("goal_created", props);
}

export function trackQuestCompleted(props: {
	source: "dashboard" | "quests";
	timeframe?: string;
	difficulty?: string;
	xp?: number;
	questTag?: string;
	leveledUp?: boolean;
	timerUsed?: boolean;
}) {
	capture("quest_completed", props);
}

export function trackQuestReverted(source: "dashboard" | "quests") {
	capture("quest_reverted", { source });
}

export function trackCheckoutStarted(tier: string) {
	capture("checkout_started", { tier });
}

export function trackSubscriptionCompleted(tier: string) {
	capture("subscription_completed", { tier });
}

export function trackCheckoutCanceled() {
	capture("checkout_canceled");
}

export function trackContentShared(props: { contentType: "achievement" | "referral"; platform: string }) {
	capture("content_shared", { content_type: props.contentType, platform: props.platform });
}

export function trackReferralLinkCopied() {
	capture("referral_link_copied");
}

export function trackTutorialCompleted() {
	capture("tutorial_completed");
}

export function trackTutorialSkipped(stepIndex: number) {
	capture("tutorial_skipped", { step_index: stepIndex });
}

export function trackGoogleAuthStarted(mode: "login" | "signup") {
	capture("google_auth_started", { mode });
}

function capture(event: string, properties?: Record<string, unknown>) {
	if (!initialized) return;
	posthog.capture(event, properties);
}
