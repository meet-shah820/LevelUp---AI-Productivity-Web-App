import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getBillingStatus, getProfile, BILLING_UPDATED_EVENT, PROFILE_UPDATED_EVENT, RANK_UPDATED_EVENT } from "../utils/api";
import { capturePageView, identifyUser, initPostHog, isPostHogEnabled } from "./posthog";

function PostHogPageTracker() {
	const location = useLocation();

	useEffect(() => {
		if (!isPostHogEnabled()) return;
		capturePageView(`${location.pathname}${location.search}`);
	}, [location.pathname, location.search]);

	return null;
}

function PostHogUserSync() {
	useEffect(() => {
		if (!isPostHogEnabled()) return;
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		let cancelled = false;

		async function sync() {
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

		return () => {
			cancelled = true;
			window.removeEventListener(BILLING_UPDATED_EVENT, refresh);
			window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
			window.removeEventListener(RANK_UPDATED_EVENT, refresh);
		};
	}, []);

	return null;
}

/** Root route wrapper: pageviews for every screen + user traits when signed in. */
export function PostHogRouteShell() {
	useEffect(() => {
		initPostHog();
	}, []);

	return (
		<>
			<PostHogPageTracker />
			<PostHogUserSync />
			<Outlet />
		</>
	);
}
