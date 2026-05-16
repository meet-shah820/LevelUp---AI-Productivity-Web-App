import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
	tierRankOf,
	type BillingTierId,
} from "../utils/tierFeatures";

export type EffectiveTierContextValue = {
	/** Stripe / DB tier */
	billedTier: BillingTierId;
	/** After admin bypass (UI preview) — same as billed when bypass off */
	effectiveTier: BillingTierId;
	billingResolved: boolean;
	effectiveTierRank: number;
};

const defaultValue: EffectiveTierContextValue = {
	billedTier: "free",
	effectiveTier: "free",
	billingResolved: false,
	effectiveTierRank: 0,
};

const EffectiveTierContext = createContext<EffectiveTierContextValue>(defaultValue);

export function EffectiveTierProvider({
	billedTier,
	effectiveTier,
	billingResolved,
	children,
}: {
	billedTier: BillingTierId;
	effectiveTier: BillingTierId;
	billingResolved: boolean;
	children: ReactNode;
}) {
	const value = useMemo<EffectiveTierContextValue>(
		() => ({
			billedTier,
			effectiveTier,
			billingResolved,
			effectiveTierRank: tierRankOf(effectiveTier),
		}),
		[billedTier, effectiveTier, billingResolved]
	);
	return <EffectiveTierContext.Provider value={value}>{children}</EffectiveTierContext.Provider>;
}

export function useEffectiveTier(): EffectiveTierContextValue {
	return useContext(EffectiveTierContext);
}
