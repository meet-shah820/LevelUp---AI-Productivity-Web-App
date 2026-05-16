import { Navigate, useLocation } from "react-router-dom";
import { useEffectiveTier } from "../context/EffectiveTierContext";
import { tierMeetsMinimum, type BillingTierId } from "../utils/tierFeatures";

export function TierProtectedRoute({
	minTier,
	children,
}: {
	minTier: BillingTierId;
	children: React.ReactNode;
}) {
	const { effectiveTier, billingResolved } = useEffectiveTier();
	const location = useLocation();

	if (!billingResolved) {
		return (
			<div className="min-h-[40vh] flex items-center justify-center p-8 text-gray-400 text-sm">
				Loading your plan…
			</div>
		);
	}

	if (!tierMeetsMinimum(effectiveTier, minTier)) {
		return (
			<Navigate
				to={`/pricing?need=${encodeURIComponent(minTier)}`}
				replace
				state={{ from: location.pathname }}
			/>
		);
	}

	return <>{children}</>;
}
