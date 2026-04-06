import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function AuthCallback() {
	const [params] = useSearchParams();
	useEffect(() => {
		const token = params.get("token");
		const username = params.get("username");
		if (token) localStorage.setItem("auth_token", token);
		if (username) localStorage.setItem("last_username", username);
		window.location.href = "/";
	}, [params]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] text-gray-300">
			Completing sign-in...
		</div>
	);
}

