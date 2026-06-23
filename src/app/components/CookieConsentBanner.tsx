import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import {
	grantAnalyticsConsent,
	readCookieConsent,
	revokeAnalyticsConsent,
	COOKIE_CONSENT_UPDATED_EVENT,
	type CookieConsentChoice,
} from "../analytics/cookieConsent";
import { applyAnalyticsConsent } from "../analytics/posthog";

export function CookieConsentBanner() {
	const [visible, setVisible] = useState(false);

	const syncVisibility = useCallback(() => {
		setVisible(readCookieConsent() === null);
	}, []);

	useEffect(() => {
		syncVisibility();
		const onUpdate = () => syncVisibility();
		window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onUpdate);
		return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onUpdate);
	}, [syncVisibility]);

	const choose = (choice: CookieConsentChoice) => {
		if (choice === "accepted") {
			grantAnalyticsConsent();
			void applyAnalyticsConsent();
		} else {
			revokeAnalyticsConsent();
			void applyAnalyticsConsent();
		}
		setVisible(false);
	};

	return (
		<AnimatePresence>
			{visible ? (
				<motion.div
					role="dialog"
					aria-labelledby="cookie-consent-title"
					aria-describedby="cookie-consent-desc"
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 24 }}
					transition={{ duration: 0.25 }}
					className="fixed bottom-0 inset-x-0 z-[100] p-4 pointer-events-none"
				>
					<div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-purple-500/30 bg-[#111827]/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-4 sm:p-5">
						<h2 id="cookie-consent-title" className="text-sm font-semibold text-white mb-1.5">
							Cookies &amp; analytics
						</h2>
						<p id="cookie-consent-desc" className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
							We use strictly necessary storage to keep you signed in. With your permission, we also use PostHog analytics
							to understand how LevelUp is used and improve the product (including masked session replays). See our{" "}
							<Link to="/legal/cookies" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">
								Cookie Policy
							</Link>{" "}
							and{" "}
							<Link to="/privacy" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">
								Privacy Policy
							</Link>
							.
						</p>
						<div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								className="border-purple-500/30 text-white hover:bg-white/5"
								onClick={() => choose("essential")}
							>
								Essential only
							</Button>
							<Button
								type="button"
								className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
								onClick={() => choose("accepted")}
							>
								Accept analytics
							</Button>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
