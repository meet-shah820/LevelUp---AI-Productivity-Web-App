import { Navigate, Outlet, useLocation } from "react-router-dom";
import Pricing from "../pages/Pricing";

export function ProtectedLayout() {
	const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
	const location = useLocation();
	if (!token) {
		// Public pricing for visitors (landing, legal links); app routes require sign-in.
		if (location.pathname === "/pricing") {
			return <Pricing />;
		}
		return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
	}
	return <Outlet />;
}
