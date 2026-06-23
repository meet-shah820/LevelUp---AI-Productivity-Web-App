import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Copy, Gift, Share2, Users, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { getReferrals } from "../utils/api";
import { trackContentShared, trackReferralLinkCopied } from "../analytics/posthog";
import {
	SHARE_PLATFORMS,
	buildReferralSharePayload,
	canUseNativeShare,
	copyToClipboard,
	sharePayload,
	type SharePlatform,
} from "../utils/socialShare";

type ReferralData = {
	code: string;
	link: string;
	stats: { totalInvited: number; activated: number; xpEarned: number; recent: { username: string; milestone: string; xpAwarded: number; at: string }[] };
	milestones: { key: string; label: string; referrerXp: number; refereeXp: number }[];
	referredBy: string | null;
};

const MILESTONE_LABELS: Record<string, string> = {
	signup: "Signed up",
	first_program: "First program",
	first_quest: "First quest",
};

export default function Referrals() {
	const [data, setData] = useState<ReferralData | null>(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		try {
			const res = await getReferrals();
			setData(res);
		} catch {
			setData(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, []);

	const sharePayloadMemo = useMemo(() => {
		if (!data) return null;
		return buildReferralSharePayload(data.link, data.code);
	}, [data]);

	const handleCopyLink = async () => {
		if (!data?.link) return;
		const ok = await copyToClipboard(data.link);
		if (ok) {
			trackReferralLinkCopied();
			toast.success("Invite link copied");
		} else toast.error("Could not copy link");
	};

	const handleCopyCode = async () => {
		if (!data?.code) return;
		const ok = await copyToClipboard(data.code);
		if (ok) toast.success("Referral code copied");
		else toast.error("Could not copy code");
	};

	const handleShare = async (platform: SharePlatform) => {
		if (!sharePayloadMemo) return;
		const result = await sharePayload(platform, sharePayloadMemo);
		if (result === "copied") toast.success("Copied to clipboard");
		else if (result === "shared") toast.success("Shared");
		if (result === "copied" || result === "shared" || result === "opened") {
			trackContentShared({ contentType: "referral", platform });
		}
	};

	const nativeShare = canUseNativeShare();
	const sharePlatforms = SHARE_PLATFORMS.filter((p) => p.id !== "native" || nativeShare);

	return (
		<div className="min-h-full p-4 lg:p-8 space-y-6">
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
				<h1 className="text-3xl font-bold text-white">Invite Friends</h1>
				<p className="text-gray-400 max-w-2xl">
					Grow your hunter squad and earn XP when friends join LevelUp and start training. They get bonus XP too.
				</p>
			</motion.div>

			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
				<Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 p-6 space-y-5">
					<div className="flex items-start gap-4">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
							<Gift className="w-6 h-6 text-white" />
						</div>
						<div className="min-w-0 flex-1">
							<h2 className="text-xl font-bold text-white mb-1">Your invite link</h2>
							<p className="text-sm text-gray-400 mb-4">Share this link or code. Rewards unlock as friends engage with training.</p>
							{loading ? (
								<p className="text-sm text-gray-500">Loading…</p>
							) : data ? (
								<div className="space-y-3">
									<div className="flex flex-col sm:flex-row gap-2">
										<Input readOnly value={data.link} className="bg-[#0B0F1A] border-purple-500/30 text-white text-sm" />
										<Button type="button" onClick={handleCopyLink} className="shrink-0 bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90">
											<Copy className="w-4 h-4 mr-2" />
											Copy link
										</Button>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-xs text-gray-500">Code:</span>
										<button
											type="button"
											onClick={handleCopyCode}
											className="font-mono text-sm font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-1"
										>
											{data.code}
										</button>
									</div>
								</div>
							) : (
								<p className="text-sm text-red-300">Could not load referral data. Try refreshing.</p>
							)}
						</div>
					</div>

					{data && sharePayloadMemo ? (
						<div className="pt-2 border-t border-purple-500/15">
							<p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
								<Share2 className="w-3.5 h-3.5" />
								Share on social media
							</p>
							<div className="flex flex-wrap gap-2">
								{sharePlatforms.map((p) => (
									<Button
										key={p.id}
										type="button"
										variant="outline"
										size="sm"
										className="border-purple-500/30 text-gray-200 hover:bg-white/10 hover:text-white"
										onClick={() => void handleShare(p.id)}
									>
										{p.label}
									</Button>
								))}
							</div>
						</div>
					) : null}
				</Card>
			</motion.div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<Card className="bg-[#111827] border-purple-500/20 p-5">
					<div className="flex items-center gap-3 mb-2">
						<Users className="w-5 h-5 text-indigo-400" />
						<span className="text-sm text-gray-400">Friends invited</span>
					</div>
					<p className="text-3xl font-bold text-white tabular-nums">{data?.stats.totalInvited ?? 0}</p>
				</Card>
				<Card className="bg-[#111827] border-purple-500/20 p-5">
					<div className="flex items-center gap-3 mb-2">
						<Zap className="w-5 h-5 text-yellow-400" />
						<span className="text-sm text-gray-400">Activated hunters</span>
					</div>
					<p className="text-3xl font-bold text-white tabular-nums">{data?.stats.activated ?? 0}</p>
					<p className="text-xs text-gray-500 mt-1">Started a program or completed a quest</p>
				</Card>
				<Card className="bg-[#111827] border-purple-500/20 p-5">
					<div className="flex items-center gap-3 mb-2">
						<Gift className="w-5 h-5 text-purple-400" />
						<span className="text-sm text-gray-400">Referral XP earned</span>
					</div>
					<p className="text-3xl font-bold text-white tabular-nums">{(data?.stats.xpEarned ?? 0).toLocaleString()}</p>
				</Card>
			</div>

			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
				<Card className="bg-[#111827] border-purple-500/20 p-6">
					<h3 className="text-lg font-bold text-white mb-4">Reward milestones</h3>
					<div className="space-y-3">
						{(data?.milestones || []).map((m) => (
							<div
								key={m.key}
								className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-white/5 border border-purple-500/15"
							>
								<span className="text-sm text-gray-200">{m.label}</span>
								<div className="flex flex-wrap gap-2 text-xs">
									<span className="text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-2.5 py-0.5">
										You +{m.referrerXp} XP
									</span>
									{m.refereeXp > 0 ? (
										<span className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-0.5">
											Friend +{m.refereeXp} XP
										</span>
									) : null}
								</div>
							</div>
						))}
					</div>
				</Card>
			</motion.div>

			{data?.stats.recent?.length ? (
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
					<Card className="bg-[#111827] border-purple-500/20 p-6">
						<h3 className="text-lg font-bold text-white mb-4">Recent invites</h3>
						<div className="space-y-2">
							{data.stats.recent.map((r, i) => (
								<div key={`${r.username}-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm">
									<span className="text-white">@{r.username}</span>
									<span className="text-gray-400">{MILESTONE_LABELS[r.milestone] || r.milestone}</span>
								</div>
							))}
						</div>
					</Card>
				</motion.div>
			) : null}
		</div>
	);
}
