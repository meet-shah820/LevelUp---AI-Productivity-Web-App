import { createBrowserRouter, Navigate } from "react-router-dom";
import { PostHogRouteShell } from "./analytics/PostHogProvider";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Quests from "./pages/Quests";
import Goals from "./pages/Goals";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Achievements from "./pages/Achievements";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CookiePolicy from "./pages/legal/CookiePolicy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import { ProtectedLayout } from "./components/ProtectedLayout";
import Streak from "./pages/Streak";
import Leaderboard from "./pages/Leaderboard";
import Referrals from "./pages/Referrals";
import { TierProtectedRoute } from "./components/TierProtectedRoute";

function RedirectToPrivacy() {
	return <Navigate to="/privacy" replace />;
}

function RedirectToTerms() {
	return <Navigate to="/terms" replace />;
}

function RedirectSkillsToAchievements() {
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const h = qs?.get("highlightAchievement") || qs?.get("highlight");
  const to = h ? `/achievements?highlight=${encodeURIComponent(h)}` : "/achievements";
  return <Navigate to={to} replace />;
}

export const router = createBrowserRouter([
  {
    element: <PostHogRouteShell />,
    children: [
  {
    path: "/auth",
    Component: Auth
  },
  {
    path: "/auth/callback",
    Component: AuthCallback
  },
  { path: "/privacy", Component: Privacy },
  { path: "/terms", Component: Terms },
  { path: "/legal/privacy", Component: RedirectToPrivacy },
  { path: "/legal/terms", Component: RedirectToTerms },
  { path: "/legal/cookies", Component: CookiePolicy },
  { path: "/legal/refunds", Component: RefundPolicy },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "quests", Component: Quests },
          { path: "goals", Component: Goals },
          { path: "skills", Component: RedirectSkillsToAchievements },
          { path: "analytics", element: (
            <TierProtectedRoute minTier="pro">
              <Analytics />
            </TierProtectedRoute>
          ) },
          { path: "streak", Component: Streak },
          { path: "leaderboard", Component: Leaderboard },
          { path: "referrals", Component: Referrals },
          { path: "profile", Component: Profile },
          { path: "achievements", Component: Achievements },
          { path: "pricing", Component: Pricing },
          { path: "settings", Component: Settings },
        ],
      },
    ],
  },
    ],
  },
]);