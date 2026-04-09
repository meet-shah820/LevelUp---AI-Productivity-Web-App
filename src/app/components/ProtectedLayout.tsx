import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getBillingOnboardedCache, getBillingStatus, syncBillingOnboardedCache } from "../utils/api";

export function ProtectedLayout() {
	const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
	const location = useLocation();
	if (!token) {
		return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
	}

	const cached = typeof window !== "undefined" ? getBillingOnboardedCache() : null;
	const [checked, setChecked] = useState(cached !== null);
	const [needsOnboarding, setNeedsOnboarding] = useState(cached === false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const s = await getBillingStatus();
				syncBillingOnboardedCache(s.onboarded);
				if (!cancelled) {
					setNeedsOnboarding(!s.onboarded);
					setChecked(true);
				}
			} catch {
				// If billing status fails, don't block the app.
				if (!cancelled) setChecked(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!checked) {
		return <div className="min-h-screen bg-[#0B0F1A]" aria-hidden />;
	}
	if (needsOnboarding && location.pathname !== "/settings") {
		return <Navigate to="/settings?onboarding=1#billing" replace />;
	}
	return <Outlet />;
}

