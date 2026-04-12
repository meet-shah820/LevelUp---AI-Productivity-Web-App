import { useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";

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
		window.location.replace("/");
	}, [params]);

	return null;
}
