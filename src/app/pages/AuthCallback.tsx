import { useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { syncBillingOnboardedCache } from "../utils/api";

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
		const onboarded = params.get("onboarded");
		if (onboarded === "0" || onboarded === "1") {
			syncBillingOnboardedCache(onboarded === "1");
		}
		const dest = onboarded === "0" ? "/settings?onboarding=1#billing" : "/";
		window.location.replace(dest);
	}, [params]);

	return null;
}

