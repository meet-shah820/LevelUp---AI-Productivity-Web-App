import { useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { trackUserLoggedIn, trackUserSignedUp } from "../analytics/posthog";
import { tryClaimPendingReferral } from "../utils/api";
import { consumeAuthReturnPath } from "../utils/authRedirect";
import { clearPendingReferralCode, readPendingReferralCode } from "../utils/referralStorage";

export default function AuthCallback() {
	const [params] = useSearchParams();
	useLayoutEffect(() => {
		const token = params.get("token");
		if (!token) {
			window.location.replace("/auth");
			return;
		}
		localStorage.setItem("auth_token", token);
		const username = params.get("username");
		if (username) localStorage.setItem("last_username", username);
		const isNew = params.get("isNew") === "1";
		if (isNew) {
			trackUserSignedUp("google", Boolean(readPendingReferralCode()));
			clearPendingReferralCode();
		} else {
			trackUserLoggedIn("google");
		}
		void tryClaimPendingReferral().finally(() => {
			const next = consumeAuthReturnPath() || "/dashboard";
			window.location.replace(next);
		});
	}, [params]);

	return null;
}
