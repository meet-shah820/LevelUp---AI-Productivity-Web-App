import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BillingSection } from "../components/BillingSection";

export default function Pricing() {
	const [params] = useSearchParams();
	const onboarding = params.get("onboarding") === "1";
	useEffect(() => {
		// Keep /pricing working for old links, but Settings is now canonical.
		// (No automatic redirect here to preserve the page if bookmarked.)
	}, []);

	return (
		<div className="min-h-full p-4 lg:p-8">
			<BillingSection onboarding={onboarding} />
		</div>
	);
}

