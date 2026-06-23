import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import {
	getLeaderboard,
	getLeaderboardWebSocketUrl,
	LeaderboardRequiresGoogleError,
	ApiUnauthorizedError,
	type LeaderboardEntry,
	type LeaderboardResponse,
} from "../utils/api";
import { setAuthReturnPath } from "../utils/authRedirect";
import { Radio, Trophy } from "lucide-react";
import { useEffectiveTier } from "../context/EffectiveTierContext";
import { tierMeetsMinimum, TIER_FOR, LEADERBOARD_PREVIEW_ENTRY_LIMIT } from "../utils/tierFeatures";

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

const RANK_TABS = ["E", "D", "C", "B", "A", "S"] as const;

/** E is lowest; higher tiers unlock as Hunter rank promotions. */
const RANK_ORDER: Record<(typeof RANK_TABS)[number], number> = {
	E: 0,
	D: 1,
	C: 2,
	B: 3,
	A: 4,
	S: 5,
};

function formatXp(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(Math.round(n));
}

function rowAccent(position: number): string {
	if (position === 1) return "border-amber-400/40 bg-amber-500/10";
	if (position === 2) return "border-slate-300/30 bg-slate-400/10";
	if (position === 3) return "border-amber-700/40 bg-amber-800/15";
	return "border-purple-500/15 bg-white/[0.03]";
}

export default function Leaderboard() {
	const { effectiveTier } = useEffectiveTier();
	const [data, setData] = useState<LeaderboardResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	/** Username/password (or other) sign-in without a linked Google account — API and live updates are withheld. */
	const [googleAccountRequired, setGoogleAccountRequired] = useState(false);
	const [sessionExpired, setSessionExpired] = useState(false);
	const [live, setLive] = useState(false);
	/** When null, the API defaults to the viewer's own rank bracket. */
	const [selectedRank, setSelectedRank] = useState<string | null>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const scrolledForUserIdRef = useRef<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			setGoogleAccountRequired(false);
			setSessionExpired(false);
			const res = await getLeaderboard(50, selectedRank ?? undefined);
			setData(res);
		} catch (e) {
			if (e instanceof LeaderboardRequiresGoogleError) {
				setGoogleAccountRequired(true);
				setData(null);
				setError(null);
			} else if (e instanceof ApiUnauthorizedError) {
				setSessionExpired(true);
				setData(null);
				setError(e.message);
			} else {
				setError("Failed to load leaderboard");
			}
		} finally {
			setLoading(false);
		}
	}, [selectedRank]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (googleAccountRequired) {
			setLive(false);
			return;
		}
		const url = getLeaderboardWebSocketUrl();
		if (!url) return;

		let ws: WebSocket | null = null;
		let cancelled = false;

		function connect() {
			if (cancelled) return;
			try {
				ws = new WebSocket(url);
			} catch {
				setLive(false);
				return;
			}

			ws.onopen = () => setLive(true);
			ws.onclose = () => setLive(false);
			ws.onerror = () => setLive(false);
			ws.onmessage = (ev) => {
				try {
					const msg = JSON.parse(String(ev.data)) as { type?: string };
					if (msg.type === "leaderboard_updated") void load();
				} catch {
					/* ignore */
				}
			};
		}

		connect();

		return () => {
			cancelled = true;
			if (ws && ws.readyState === WebSocket.OPEN) ws.close();
			else if (ws) ws.close();
			setLive(false);
		};
	}, [load, googleAccountRequired]);

	const yourId = data?.yourRank?.userId;
	const bracketHighlight = selectedRank ?? data?.rankBracket ?? null;
	const fullLeaderboard = data?.fullLeaderboardUnlocked ?? tierMeetsMinimum(effectiveTier, TIER_FOR.leaderboardFullView);
	const previewLimit = data?.visibilityLimit ?? LEADERBOARD_PREVIEW_ENTRY_LIMIT;

	const visibleRankTabs = useMemo(() => {
		const v = data?.viewerHunterRank;
		if (!v) return [] as (typeof RANK_TABS)[number][];
		const maxI = RANK_ORDER[v as keyof typeof RANK_ORDER];
		const cap = maxI !== undefined ? maxI : 0;
		return RANK_TABS.filter((r) => RANK_ORDER[r] <= cap);
	}, [data?.viewerHunterRank]);

	useEffect(() => {
		const v = data?.viewerHunterRank;
		if (!v || selectedRank === null) return;
		const maxI = RANK_ORDER[v as keyof typeof RANK_ORDER] ?? 0;
		const selI = RANK_ORDER[selectedRank as keyof typeof RANK_ORDER];
		if (selI === undefined || selI > maxI) setSelectedRank(null);
	}, [data?.viewerHunterRank, selectedRank]);

	useEffect(() => {
		scrolledForUserIdRef.current = null;
	}, [data?.rankBracket]);

	useEffect(() => {
		if (!data?.entries?.length || !yourId) return;
		const inList = data.entries.some((e) => e.userId === yourId);
		if (!inList) {
			scrolledForUserIdRef.current = null;
			return;
		}
		if (scrolledForUserIdRef.current === yourId) return;
		const row = listRef.current?.querySelector<HTMLElement>('[data-current-user="true"]');
		row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		scrolledForUserIdRef.current = yourId;
	}, [data, yourId]);

	return (
		<div className="min-h-full p-4 md:p-8 max-w-4xl mx-auto">
			<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
				<div className="flex flex-wrap items-center gap-3 mb-2">
					<Trophy className="w-8 h-8 text-amber-400" aria-hidden />
					<h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Leaderboard</h1>
					{tierMeetsMinimum(effectiveTier, TIER_FOR.leaderboardEliteBadge) ? (
						<span
							className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-gradient-to-r from-fuchsia-500/20 to-violet-600/25 border-fuchsia-400/40 text-fuchsia-100"
							title="Elite subscription leaderboard flair"
						>
							Elite
						</span>
					) : null}
					<span
						className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
							live && !googleAccountRequired
								? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
								: "border-white/10 text-white/45 bg-white/5"
						}`}
						title={
							googleAccountRequired
								? "Live rankings require a Google-linked account"
								: live
									? "Connected — rankings refresh when anyone earns XP or changes rank"
									: "Reconnecting…"
						}
					>
						<Radio className={`w-3.5 h-3.5 ${live && !googleAccountRequired ? "text-emerald-400" : ""}`} />
						{live && !googleAccountRequired ? "Live" : "Offline"}
					</span>
				</div>
				<p className="text-white/55 text-sm md:text-base max-w-2xl">
					{googleAccountRequired ? (
						<>
							Rankings and live updates are enabled only for accounts that use Google sign-in, so names and standings stay tied
							to a verified identity.
						</>
					) : (
						<>
							Each Hunter rank has its own board (fitness quest XP and progression). Tabs for ranks you have not reached yet stay hidden until you promote.
							You only compete with players on the same rank. Sorting is by XP, then level and stats. Underdog boost applies
							on your current-rank board when active.
						</>
					)}
				</p>
			</motion.div>

			{sessionExpired && (
				<Card className="mb-8 p-6 md:p-8 border border-amber-500/25 bg-gradient-to-br from-[#111827]/90 to-[#1a1f35]/90">
					<h2 className="text-lg font-semibold text-white mb-2">Session expired</h2>
					<p className="text-white/60 text-sm mb-6 leading-relaxed max-w-xl">
						{error || "Please sign in again to view the leaderboard."}
					</p>
					<Button
						type="button"
						className="w-full sm:w-auto min-w-[220px] bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
						onClick={() => {
							localStorage.removeItem("auth_token");
							setAuthReturnPath("/leaderboard");
							window.location.href = "/auth";
						}}
					>
						Sign in again
					</Button>
				</Card>
			)}

			{googleAccountRequired && (
				<Card className="mb-8 p-6 md:p-8 border border-purple-500/25 bg-gradient-to-br from-[#111827]/90 to-[#1a1f35]/90">
					<h2 className="text-lg font-semibold text-white mb-2">Connect Google to view the leaderboard</h2>
					<p className="text-white/60 text-sm mb-6 leading-relaxed max-w-xl">
						Your account was created with a username and password. To see rankings, live updates, and compete on the board, sign in once with
						the same Google account you want to use here. If your Google email matches an account email in our system, we link it automatically.
					</p>
					<Button
						type="button"
						className="w-full sm:w-auto min-w-[220px] bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
						onClick={() => {
							setAuthReturnPath("/leaderboard");
							window.location.href = `${API_BASE}/api/auth/google`;
						}}
					>
						Continue with Google
					</Button>
					<p className="text-xs text-white/40 mt-4">
						After Google sign-in you will return here. You can still use the rest of the app with your current login until you switch fully to Google.
					</p>
				</Card>
			)}

			<div className={`flex flex-wrap gap-2 mb-6 ${googleAccountRequired || sessionExpired ? "hidden" : ""}`}>
				{visibleRankTabs.map((r) => (
					<Button
						key={r}
						type="button"
						size="sm"
						variant={bracketHighlight != null && bracketHighlight === r ? "default" : "outline"}
						className={
							bracketHighlight != null && bracketHighlight === r
								? "bg-amber-500/90 text-black hover:bg-amber-500 border-0"
								: "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
						}
						onClick={() => setSelectedRank(r)}
					>
						Rank {r}
					</Button>
				))}
			</div>

			{!googleAccountRequired && !sessionExpired && data && !data.viewerInBracket && data.viewerHunterRank && (
				<Card className="mb-4 p-3 border border-amber-500/20 bg-amber-500/5 text-sm text-amber-100/95">
					Your Hunter rank is <span className="font-semibold text-white">{data.viewerHunterRank}</span>. This tab
					shows rank <span className="font-semibold text-white">{data.rankBracket}</span> only — open Rank{" "}
					<span className="font-semibold text-white">{data.viewerHunterRank}</span> to see your position.
				</Card>
			)}

			{!googleAccountRequired && !sessionExpired && data?.yourRank && (
				<Card className="mb-6 p-4 border border-indigo-500/25 bg-indigo-500/5">
					<p className="text-xs uppercase tracking-wider text-indigo-300/80 mb-1">
						Your standing · Rank {data.rankBracket}
					</p>
					<p className="text-white text-lg">
						<span className="font-semibold text-indigo-200">#{data.yourRank.position}</span>
						<span className="text-white/50"> / {data.totalUsers}</span>
						<span className="text-white/60"> · {data.yourRank.displayName}</span>
					</p>
					<p className="text-sm text-white/45 mt-1">
						Level {data.yourRank.level} · Hunter {data.yourRank.rank} · {formatXp(data.yourRank.xp)} XP ·{" "}
						{data.yourRank.statSum} stat pts
					</p>
					{data.viewerLeaderboardUnderdog?.active && (
						<p className="text-sm text-sky-200/95 mt-3 pt-3 border-t border-white/10">
							<span className="font-semibold text-sky-100">Underdog boost active</span>
							{" — "}
							Your rank is computed with {data.viewerLeaderboardUnderdog.multiplier}× effective XP for sorting. Listed XP
							stays your real total.
							{data.viewerLeaderboardUnderdog.endsAt ? (
								<>
									{" "}
									Ends {new Date(data.viewerLeaderboardUnderdog.endsAt).toLocaleString(undefined, {
										dateStyle: "medium",
										timeStyle: "short",
									})}
									.
								</>
							) : null}
						</p>
					)}
				</Card>
			)}

			{loading && !data && !googleAccountRequired && !sessionExpired && (
				<p className="text-white/50" role="status">
					Loading rankings…
				</p>
			)}
			{error && !sessionExpired && <p className="text-red-400">{error}</p>}

			{!googleAccountRequired && !sessionExpired && data && (
				<Card className="border border-purple-500/20 bg-[#0f1424]/80 overflow-hidden">
					<div className="flex gap-2 md:gap-3 px-3 py-2.5 text-xs font-medium text-white/40 border-b border-white/10 items-center">
						<span className="w-7 md:w-9 shrink-0">#</span>
						<span className="flex-1 min-w-0">Player</span>
						<span className="w-8 shrink-0 text-center">Rank</span>
						<span className="w-8 shrink-0 text-right hidden md:block">Lv</span>
						<span className="w-14 shrink-0 text-right">XP</span>
					</div>
					<ul ref={listRef} className="divide-y divide-white/[0.06]">
						{data.entries.map((e: LeaderboardEntry) => {
							const mine = Boolean(yourId && e.userId === yourId);
							const rowClass = mine
								? "border-l-[3px] border-l-indigo-400 bg-indigo-500/[0.14] ring-1 ring-inset ring-indigo-400/35 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.12)]"
								: `border-l-2 ${rowAccent(e.position)}`;
							return (
								<li
									key={e.userId}
									data-current-user={mine ? "true" : undefined}
									className={`flex gap-2 md:gap-3 px-3 py-3 items-center ${rowClass}`}
								>
									<span
										className={`font-mono text-sm tabular-nums w-7 md:w-9 shrink-0 ${
											mine ? "text-indigo-200 font-semibold" : "text-white/70"
										}`}
									>
										{e.position}
									</span>
									<div className="min-w-0 flex-1">
										<p className="text-white font-medium truncate flex items-center gap-2 min-w-0">
											<span className="truncate">{e.displayName}</span>
											{mine && (
												<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-500/35 text-indigo-100 border border-indigo-400/40">
													You
												</span>
											)}
										</p>
										<p className={`text-xs truncate ${mine ? "text-indigo-200/50" : "text-white/35"}`}>@{e.username}</p>
									</div>
									<span className="text-amber-300/90 font-semibold text-sm w-8 shrink-0 text-center">{e.rank}</span>
									<span className="text-white/60 text-sm text-right tabular-nums w-8 shrink-0 hidden md:block">{e.level}</span>
									<span className="text-emerald-300/90 text-sm text-right tabular-nums font-medium w-14 shrink-0">{formatXp(e.xp)}</span>
								</li>
							);
						})}
					</ul>
					{data.entries.length === 0 && (
						<p className="p-6 text-white/45 text-center">No players in rank {data.rankBracket} yet.</p>
					)}
					{data.totalUsers > data.entries.length && (
						<div className="px-3 py-3 text-xs border-t border-white/10 space-y-2">
							<p className="text-white/40">
								Rank {data.rankBracket}: showing top {data.entries.length} of {data.totalUsers} players.
							</p>
							{!fullLeaderboard && data.totalUsers > previewLimit ? (
								<p className="text-white/55 leading-relaxed">
									Free, Starter, and Pro accounts see the top {previewLimit} players per rank.{" "}
									<Link
										to="/pricing?need=elite"
										className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2"
									>
										Upgrade to Elite
									</Link>{" "}
									to view the full leaderboard.
								</p>
							) : null}
						</div>
					)}
				</Card>
			)}
		</div>
	);
}
