import { Navigate, Outlet, useLocation } from "react-router-dom";

export function ProtectedLayout() {
	const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
	const location = useLocation();
	if (!token) {
		return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
	}
	return <Outlet />;
}
