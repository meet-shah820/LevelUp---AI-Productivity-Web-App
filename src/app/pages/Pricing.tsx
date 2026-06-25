import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, LayoutDashboard, Shield, Sparkles, Star, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
	getBillingPlans,
	getBillingStatus,
	createBillingCheckoutSession,
	createBillingPortalSession,
	BillingApiError,
	BILLING_UPDATED_EVENT,
	type BillingPlanTier,
	type BillingTierId,
	type BillingInterval,
} from "../utils/api";
import {
	trackCheckoutCanceled,
	trackCheckoutStarted,
	trackSubscriptionCompleted,
} from "../analytics/posthog";
import { toast } from "sonner";
import { setAuthReturnPath } from "../utils/authRedirect";

function formatMoney(cents: number, currency = "usd") {
	const code = currency.length === 3 ? currency.toUpperCase() : "USD";
	if (cents <= 0) {
		return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(0);
	}
	return new Intl.NumberFormat(undefined, { style: "currency", currency: code, minimumFractionDigits: 2 }).format(
		cents / 100,
	);
}

function readSignedIn(): boolean {
	try {
		return Boolean(typeof localStorage !== "undefined" && localStorage.getItem("auth_token"));
	} catch {
		return false;
	}
}

export default function Pricing() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [tiers, setTiers] = useState<BillingPlanTier[]>([]);
	const [checkoutAvailable, setCheckoutAvailable] = useState(false);
	const [annualCheckoutAvailable, setAnnualCheckoutAvailable] = useState(false);
	const [annualTrialDays, setAnnualTrialDays] = useState(14);
	const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
	const [plansNotice, setPlansNotice] = useState<string | null>(null);
	const [currentTier, setCurrentTier] = useState<BillingTierId>("free");
	const [signedIn, setSignedIn] = useState(readSignedIn);
	const [loadingKey, setLoadingKey] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);

	const freeTier = tiers.find((t) => t.id === "free");
	const paidTiers = tiers.filter((t) => t.id !== "free");

	const maxAnnualDiscount = useMemo(
		() => Math.max(0, ...paidTiers.map((t) => t.annualDiscountPercent ?? 0)),
		[paidTiers],
	);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const plans = await getBillingPlans();
				if (!cancelled) {
					setTiers(plans.tiers);
					setCheckoutAvailable(plans.checkoutAvailable);
					setAnnualCheckoutAvailable(Boolean(plans.annualCheckoutAvailable));
					setAnnualTrialDays(plans.annualTrialDays ?? 14);
					setPlansNotice(plans.plansNotice ?? null);
				}
			} catch {
				if (!cancelled) toast.error("Could not load plans.");
			}
			try {
				const st = await getBillingStatus();
				if (!cancelled) {
					setCurrentTier(st.tier);
					setSignedIn(true);
				}
			} catch {
				if (!cancelled) setSignedIn(readSignedIn());
			}
			if (!cancelled) setLoaded(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const c = searchParams.get("checkout");
		if (c === "success") {
			toast.success("Subscription updated. It may take a few seconds for your tier to sync.");
			void (async () => {
				try {
					const st = await getBillingStatus();
					setCurrentTier(st.tier);
					trackSubscriptionCompleted(st.tier);
					window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
				} catch {
					/* not signed in */
				}
			})();
			searchParams.delete("checkout");
			setSearchParams(searchParams, { replace: true });
		} else if (c === "canceled") {
			toast.message("Checkout canceled.");
			trackCheckoutCanceled();
			searchParams.delete("checkout");
			setSearchParams(searchParams, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		const need = searchParams.get("need");
		if (!loaded || !need) return;
		const t = window.setTimeout(() => {
			document.getElementById(`pricing-tier-${need}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
		}, 120);
		return () => window.clearTimeout(t);
	}, [loaded, searchParams]);

	async function subscribe(tierId: BillingTierId, interval: BillingInterval) {
		if (tierId === "free") return;
		if (!readSignedIn()) {
			setAuthReturnPath("/pricing");
			navigate("/auth?next=/pricing");
			return;
		}
		const key = `${tierId}-${interval}`;
		setLoadingKey(key);
		try {
			trackCheckoutStarted(tierId);
			const { url } = await createBillingCheckoutSession(tierId, interval);
			window.location.href = url;
		} catch (e) {
			if (e instanceof BillingApiError && e.code === "USE_PORTAL") {
				toast.message("You already have a subscription. Opening Stripe to change your plan.");
				try {
					const { url } = await createBillingPortalSession();
					window.location.href = url;
				} catch (pe) {
					const pm = pe instanceof Error ? pe.message : "Could not open billing portal.";
					toast.error(pm);
					setLoadingKey(null);
				}
				return;
			}
			if (e instanceof BillingApiError && e.status === 401) {
				setAuthReturnPath("/pricing");
				navigate("/auth?next=/pricing");
				setLoadingKey(null);
				return;
			}
			const msg = e instanceof Error ? e.message : "Checkout failed.";
			toast.error(msg);
			setLoadingKey(null);
		}
	}

	function renderPaidTierCard(tier: BillingPlanTier, index: number) {
		const isCurrent = tier.id === currentTier;
		const showHighlight = Boolean(tier.highlight);
		const showLowerMonthlyBadge = tier.pricingNote === "lower monthly";
		const currency = tier.currency || "usd";
		const annualCents = tier.annualPriceCents ?? 0;
		const annualMonthlyEq = annualCents > 0 ? Math.round(annualCents / 12) : 0;
		const compareAt = tier.compareAtMonthlyPriceCents ?? null;
		const showAnnual = billingInterval === "year";
		const monthlyReady = checkoutAvailable && tier.hasPriceId && tier.stripePriceReachable !== false;
		const annualReady =
			annualCheckoutAvailable &&
			tier.hasAnnualPriceId &&
			tier.stripeAnnualPriceReachable !== false;
		const primaryInterval: BillingInterval = showAnnual ? "year" : "month";
		const primaryReady = showAnnual ? annualReady : monthlyReady;
		return (
			<motion.div
				key={tier.id}
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.05 * index }}
				className="pt-3"
			>
				<Card
					id={`pricing-tier-${tier.id}`}
					className={`relative h-full flex flex-col p-5 rounded-2xl bg-[#0f1420]/90 backdrop-blur-sm ${
						showHighlight
							? "border border-indigo-400/50 shadow-[0_0_40px_-8px_rgba(99,102,241,0.45)]"
							: "border border-white/[0.08]"
					}`}
				>
					{showHighlight ? (
						<div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg">
							<Star className="w-3 h-3 fill-current" />
							Most popular
						</div>
					) : null}

					{showLowerMonthlyBadge ? (
						<div className="absolute top-4 right-4 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border border-amber-500/50 text-amber-300/90 bg-amber-500/10">
							Lower monthly
						</div>
					) : null}

					<div className={`mb-4 ${showLowerMonthlyBadge ? "pr-24" : ""}`}>
						<h2 className="text-xl font-bold text-white">{tier.name}</h2>
						<p className="text-sm text-gray-500 mt-0.5 leading-snug">{tier.tagline}</p>
					</div>

					<div className="mb-5">
						{showAnnual ? (
							<>
								<div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
									<span className="text-3xl font-bold text-white tracking-tight">
										{formatMoney(annualCents, currency)}
									</span>
									<span className="text-gray-500 text-sm font-medium">/ yr</span>
								</div>
								{annualMonthlyEq > 0 ? (
									<p className="text-sm text-gray-500 mt-1.5">
										≈ {formatMoney(annualMonthlyEq, currency)}/mo billed annually
									</p>
								) : null}
								{(tier.annualSavingsCents ?? 0) > 0 ? (
									<p className="text-sm text-emerald-400/90 mt-0.5 font-medium">
										Save {formatMoney(tier.annualSavingsCents ?? 0, currency)}
										{(tier.annualDiscountPercent ?? 0) > 0
											? ` (${tier.annualDiscountPercent}% off)`
											: null}
									</p>
								) : null}
							</>
						) : (
							<>
								<div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
									<span className="text-3xl font-bold text-white tracking-tight">
										{formatMoney(tier.monthlyPriceCents, currency)}
									</span>
									<span className="text-gray-500 text-sm font-medium">/ mo</span>
								</div>
								{compareAt != null && compareAt > tier.monthlyPriceCents ? (
									<p className="text-sm text-gray-600 mt-1.5">
										was{" "}
										<span className="line-through">{formatMoney(compareAt, currency)}/mo</span>
									</p>
								) : null}
							</>
						)}
					</div>

					<ul className="space-y-2 mb-6 flex-1">
						{tier.features.map((f) => (
							<li key={f} className="flex gap-2 text-sm text-gray-400">
								<Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" strokeWidth={2.5} />
								<span>{f}</span>
							</li>
						))}
					</ul>

					{isCurrent ? (
						<Button
							disabled
							className="w-full h-10 rounded-xl bg-white/[0.06] text-gray-400 border border-white/10 cursor-default"
						>
							Current plan
						</Button>
					) : (
						<div className="space-y-2 mt-auto">
							<Button
								className={`w-full h-10 rounded-xl font-medium ${
									showHighlight
										? "bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-lg shadow-indigo-500/25"
										: "bg-white/[0.07] hover:bg-white/[0.11] text-white border border-white/10"
								}`}
								disabled={!primaryReady || loadingKey !== null}
								onClick={() => void subscribe(tier.id, primaryInterval)}
							>
								<Zap className="w-4 h-4 mr-2 shrink-0" />
								{loadingKey === `${tier.id}-${primaryInterval}`
									? "Redirecting…"
									: !primaryReady
										? "Unavailable"
										: !signedIn
											? "Sign in to subscribe"
											: showAnnual
												? `Start ${annualTrialDays}-day free trial`
												: "Subscribe monthly"}
							</Button>
							{!showAnnual ? (
								<Button
									variant="ghost"
									className="w-full h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08]"
									disabled={!annualReady || loadingKey !== null}
									onClick={() => void subscribe(tier.id, "year")}
								>
									{loadingKey === `${tier.id}-year`
										? "Redirecting…"
										: !annualReady
											? "Annual unavailable"
											: !signedIn
												? `Sign in — ${annualTrialDays}-day trial`
												: `Start ${annualTrialDays}-day free trial`}
									<ArrowRight className="w-4 h-4 ml-1.5 opacity-60" />
								</Button>
							) : (
								<Button
									variant="ghost"
									className="w-full h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.04]"
									disabled={!monthlyReady || loadingKey !== null}
									onClick={() => void subscribe(tier.id, "month")}
								>
									{loadingKey === `${tier.id}-month` ? "Redirecting…" : "Subscribe monthly instead"}
									<ArrowRight className="w-4 h-4 ml-1.5 opacity-60" />
								</Button>
							)}
						</div>
					)}
				</Card>
			</motion.div>
		);
	}

	const statusMessage =
		(loaded && plansNotice) ||
		(loaded && !checkoutAvailable && !plansNotice
			? "Checkout is not configured (set Stripe keys and Price IDs in the server environment)."
			: null);

	return (
		<div className="relative min-h-full overflow-hidden">
			{/* Background grid + glow */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.35]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)",
					backgroundSize: "48px 48px",
				}}
			/>
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-violet-600/10 blur-[120px] rounded-full" />

			<div className="relative z-10 px-4 lg:px-6 pt-3 lg:pt-4 pb-8 max-w-5xl mx-auto space-y-5">
				{/* Header — back link overlays top-left so the title block starts higher */}
				<div className="relative">
					<Button
						type="button"
						variant="ghost"
						onClick={() => navigate("/")}
						className="absolute left-0 top-0 z-10 text-gray-500 hover:text-white hover:bg-white/[0.05] -ml-2 gap-2 h-8 text-sm"
					>
						<LayoutDashboard className="w-4 h-4" />
						<span className="hidden sm:inline">Back to Dashboard</span>
						<span className="sm:hidden">Back</span>
					</Button>

					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center space-y-2.5 pt-8 sm:pt-0"
					>
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/25 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">
						<Sparkles className="w-3.5 h-3.5" />
						Recommended pricing
					</div>
					<h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-b from-violet-200 to-violet-400/80 bg-clip-text text-transparent">
						Choose your tier
					</h1>
					<p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
						Free forever for core training. Paid tiers unlock deeper quests, analytics, and elite perks — with
						optional annual billing and a {annualTrialDays}-day free trial.
					</p>

					{/* Billing toggle */}
					<div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#0f1420] border border-white/[0.08]">
						<button
							type="button"
							onClick={() => setBillingInterval("month")}
							className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
								billingInterval === "month"
									? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md"
									: "text-gray-500 hover:text-gray-300"
							}`}
						>
							Monthly
						</button>
						<button
							type="button"
							onClick={() => setBillingInterval("year")}
							className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
								billingInterval === "year"
									? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md"
									: "text-gray-500 hover:text-gray-300"
							}`}
						>
							Annual
							{maxAnnualDiscount > 0 ? (
								<span
									className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
										billingInterval === "year"
											? "bg-white/20 text-white"
											: "bg-emerald-500/20 text-emerald-400"
									}`}
								>
									Save {maxAnnualDiscount}%
								</span>
							) : null}
						</button>
					</div>

					{loaded && !signedIn ? (
						<p className="text-gray-600 text-sm">Sign in to subscribe. Browse plans below anytime.</p>
					) : null}
					{statusMessage ? (
						<p className="text-amber-400/90 text-sm max-w-lg mx-auto">{statusMessage}</p>
					) : null}
					</motion.div>
				</div>

				{/* Free tier — horizontal card */}
				{freeTier ? (
					<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
						<Card
							id="pricing-tier-free"
							className="p-4 lg:p-5 rounded-2xl bg-[#0f1420]/90 backdrop-blur-sm border border-white/[0.08] flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"
						>
							<div className="shrink-0 lg:min-w-[170px]">
								<div className="flex items-center gap-2 mb-0.5">
									<Shield className="w-5 h-5 text-violet-400" />
									<h2 className="text-lg font-bold text-white">{freeTier.name}</h2>
								</div>
								<p className="text-sm text-gray-500">{freeTier.tagline}</p>
								<p className="text-2xl font-bold text-white mt-2 tracking-tight">
									{formatMoney(0)}
									<span className="text-sm font-normal text-gray-500 ml-1.5">forever</span>
								</p>
							</div>
							<ul className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-1 gap-x-5 gap-y-1.5">
								{freeTier.features.map((f) => (
									<li key={f} className="flex gap-2 text-sm text-gray-500">
										<Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" strokeWidth={2.5} />
										<span>{f}</span>
									</li>
								))}
							</ul>
							<Button
								disabled
								className="shrink-0 h-9 px-5 rounded-xl bg-white/[0.06] text-gray-400 border border-white/10 cursor-default lg:ml-auto"
							>
								{currentTier === "free" ? "Current plan" : "Default at signup"}
							</Button>
						</Card>
					</motion.div>
				) : null}

				{/* Paid tiers */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-5">{paidTiers.map(renderPaidTierCard)}</div>

				<p className="text-gray-600 text-xs text-center leading-relaxed max-w-lg mx-auto">
					Paid plans are subject to our{" "}
					<Link to="/terms" className="text-gray-500 hover:text-violet-300 underline-offset-2 hover:underline">
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link to="/privacy" className="text-gray-500 hover:text-violet-300 underline-offset-2 hover:underline">
						Privacy Policy
					</Link>
					. Subscriptions are billed by Stripe; taxes may apply.
				</p>
			</div>
		</div>
	);
}
