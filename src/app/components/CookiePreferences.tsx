import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import {
	COOKIE_CONSENT_UPDATED_EVENT,
	grantAnalyticsConsent,
	hasAnalyticsConsent,
	readCookieConsent,
	revokeAnalyticsConsent,
	type CookieConsentChoice,
} from "../analytics/cookieConsent";
import { applyAnalyticsConsent } from "../analytics/posthog";
import { toast } from "sonner";

export function CookiePreferences() {
	const [choice, setChoice] = useState<CookieConsentChoice | null>(() => readCookieConsent());

	useEffect(() => {
		const sync = () => setChoice(readCookieConsent());
		window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, sync);
		return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, sync);
	}, []);

	const analyticsOn = hasAnalyticsConsent();

	function enableAnalytics() {
		grantAnalyticsConsent();
		applyAnalyticsConsent();
		setChoice("accepted");
		toast.success("Analytics enabled");
	}

	function disableAnalytics() {
		revokeAnalyticsConsent();
		applyAnalyticsConsent();
		setChoice("essential");
		toast.message("Analytics disabled — essential cookies only");
	}

	return (
		<div className="space-y-3">
			<p className="text-sm text-gray-400">
				Current choice:{" "}
				<span className="text-gray-200 font-medium">
					{choice === null ? "Not set yet" : analyticsOn ? "Analytics accepted" : "Essential only"}
				</span>
			</p>
			<p className="text-xs text-gray-500 leading-relaxed">
				Essential storage keeps you signed in. Analytics helps us improve LevelUp via PostHog. Details in our{" "}
				<Link to="/legal/cookies" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">
					Cookie Policy
				</Link>
				.
			</p>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					variant={analyticsOn ? "default" : "outline"}
					className={analyticsOn ? "bg-gradient-to-r from-indigo-500 to-purple-600" : "border-purple-500/30 text-white hover:bg-white/5"}
					onClick={enableAnalytics}
					disabled={analyticsOn}
				>
					Allow analytics
				</Button>
				<Button
					type="button"
					size="sm"
					variant={!analyticsOn && choice !== null ? "default" : "outline"}
					className={
						!analyticsOn && choice !== null
							? "bg-slate-600 hover:bg-slate-500"
							: "border-purple-500/30 text-white hover:bg-white/5"
					}
					onClick={disableAnalytics}
					disabled={!analyticsOn}
				>
					Essential only
				</Button>
			</div>
		</div>
	);
}
