import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CookieConsentBanner } from "../components/CookieConsentBanner";
import { getBillingStatus, getProfile, BILLING_UPDATED_EVENT, PROFILE_UPDATED_EVENT, RANK_UPDATED_EVENT } from "../utils/api";
import { COOKIE_CONSENT_UPDATED_EVENT, hasAnalyticsConsent } from "./cookieConsent";
import { applyAnalyticsConsent, capturePageView, ensurePostHogConfig, identifyUser, isPostHogEnabled } from "./posthog";

function PostHogPageTracker({ enabled }: { enabled: boolean }) {
	const location = useLocation();

	useEffect(() => {
		if (!enabled || !isPostHogEnabled() || !hasAnalyticsConsent()) return;
		capturePageView(`${location.pathname}${location.search}`);
	}, [enabled, location.pathname, location.search]);

	return null;
}

function PostHogUserSync({ enabled }: { enabled: boolean }) {
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;

		async function sync() {
			await ensurePostHogConfig();
			if (cancelled || !isPostHogEnabled() || !hasAnalyticsConsent()) return;
			const token = localStorage.getItem("auth_token");
			if (!token) return;

			try {
				const [profile, billing] = await Promise.all([
					getProfile(),
					getBillingStatus().catch(() => ({ tier: "free" as const })),
				]);
				if (cancelled) return;
				const user = (profile as { user?: Record<string, unknown> })?.user;
				const quickStats = (profile as { quickStats?: { questsCompleted?: number } })?.quickStats;
				identifyUser({
					username: typeof user?.username === "string" ? user.username : undefined,
					email: typeof user?.email === "string" ? user.email : undefined,
					tier: typeof billing?.tier === "string" ? billing.tier : "free",
					level: typeof user?.level === "number" ? user.level : undefined,
					rank: typeof user?.rank === "string" ? user.rank : undefined,
					questsCompleted: quickStats?.questsCompleted,
				});
			} catch {
				/* profile unavailable */
			}
		}

		void sync();

		const refresh = () => void sync();
		window.addEventListener(BILLING_UPDATED_EVENT, refresh);
		window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
		window.addEventListener(RANK_UPDATED_EVENT, refresh);
		window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, refresh);

		return () => {
			cancelled = true;
			window.removeEventListener(BILLING_UPDATED_EVENT, refresh);
			window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
			window.removeEventListener(RANK_UPDATED_EVENT, refresh);
			window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, refresh);
		};
	}, [enabled]);

	return null;
}

/** Root route wrapper: consent banner, pageviews, and user traits when analytics is allowed. */
export function PostHogRouteShell() {
	const [analyticsReady, setAnalyticsReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void ensurePostHogConfig().then(() => {
			if (cancelled) return;
			void applyAnalyticsConsent();
			setAnalyticsReady(true);
		});

		const onConsent = () => {
			void applyAnalyticsConsent();
		};
		window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
		return () => {
			cancelled = true;
			window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsent);
		};
	}, []);

	return (
		<>
			<CookieConsentBanner />
			<PostHogPageTracker enabled={analyticsReady} />
			<PostHogUserSync enabled={analyticsReady} />
			<Outlet />
		</>
	);
}
