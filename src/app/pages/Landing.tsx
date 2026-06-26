import { Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, Flag, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { LegalFooterLinks } from "../components/legal/LegalFooterLinks";

function readAuthToken(): string | null {
	try {
		return localStorage.getItem("auth_token");
	} catch {
		return null;
	}
}

const FEATURES = [
	{
		icon: Flag,
		title: "Training goals",
		body: "Set strength, conditioning, or race-prep goals and get an AI-built quest roadmap.",
	},
	{
		icon: Target,
		title: "Daily missions",
		body: "Daily, weekly, and monthly quests with XP, streaks, and Hunter rank progression.",
	},
	{
		icon: Trophy,
		title: "Achievements",
		body: "Unlock badges for consistency, milestones, and leaderboard climbs.",
	},
];

export default function Landing() {
	if (readAuthToken()) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<div className="min-h-screen bg-[#0B0F1A] text-gray-300 overflow-x-hidden">
			<div
				className="pointer-events-none fixed inset-0 opacity-[0.35]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)",
					backgroundSize: "48px 48px",
				}}
			/>
			<div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[min(900px,100vw)] h-[420px] bg-violet-600/12 blur-[120px] rounded-full" />

			<header className="relative z-10 border-b border-white/[0.06] bg-[#0B0F1A]/80 backdrop-blur-xl">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
					<div className="flex items-center gap-2 min-w-0">
						<div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
							<Zap className="w-5 h-5 text-white" aria-hidden />
						</div>
						<span className="font-bold text-white text-lg truncate">LevelUp</span>
					</div>
					<nav className="flex items-center gap-2 sm:gap-3 shrink-0">
						<Button variant="ghost" className="text-gray-400 hover:text-white hidden sm:inline-flex" asChild>
							<Link to="/pricing">Pricing</Link>
						</Button>
						<Button variant="outline" className="border-purple-500/30 text-white hover:bg-white/5" asChild>
							<Link to="/auth">Sign in</Link>
						</Button>
						<Button className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0" asChild>
							<Link to="/auth">
								Get started
								<ArrowRight className="w-4 h-4 ml-1.5" aria-hidden />
							</Link>
						</Button>
					</nav>
				</div>
			</header>

			<main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="space-y-6 text-center lg:text-left"
					>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/25 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">
							<Sparkles className="w-3.5 h-3.5" aria-hidden />
							Fitness quest log
						</div>
						<h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
							Level up your training with{" "}
							<span className="bg-gradient-to-r from-violet-200 to-indigo-400 bg-clip-text text-transparent">
								quests, not spreadsheets
							</span>
						</h1>
						<p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
							LevelUp turns your gym and conditioning goals into daily missions, weekly checkpoints, and monthly
							milestones — with XP, streaks, and Hunter ranks that keep you showing up.
						</p>
						<div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
							<Button
								size="lg"
								className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white h-12 px-8"
								asChild
							>
								<Link to="/auth">
									Start free
									<ArrowRight className="w-4 h-4 ml-2" aria-hidden />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="w-full sm:w-auto border-purple-500/35 text-white hover:bg-white/5 h-12"
								asChild
							>
								<Link to="/pricing">View plans</Link>
							</Button>
						</div>
						<ul className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 justify-center lg:justify-start">
							<li className="flex items-center gap-2">
								<Check className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
								Free tier available
							</li>
							<li className="flex items-center gap-2">
								<Check className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
								No credit card to explore
							</li>
						</ul>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.12 }}
						className="relative"
					>
						<div className="absolute -inset-4 bg-gradient-to-br from-indigo-500/20 to-violet-600/10 rounded-3xl blur-2xl" />
						<Card className="relative border-purple-500/30 bg-[#111827]/95 backdrop-blur-sm p-4 sm:p-6 space-y-4 shadow-2xl shadow-purple-900/30">
							<div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
								<div>
									<p className="text-xs text-gray-500 uppercase tracking-wide">Today&apos;s board</p>
									<p className="text-lg font-semibold text-white">Quests</p>
								</div>
								<div className="text-right">
									<p className="text-xs text-gray-500">Rank E → S</p>
									<p className="text-sm font-medium text-indigo-300">+120 XP</p>
								</div>
							</div>
							{[
								{ title: "Upper push session", tag: "Daily", xp: 45, done: true },
								{ title: "Zone 2 cardio 25 min", tag: "Daily", xp: 35, done: false },
								{ title: "Weekly volume checkpoint", tag: "Weekly", xp: 80, done: false },
							].map((q) => (
								<div
									key={q.title}
									className={`rounded-xl border p-3 flex items-start gap-3 ${
										q.done
											? "border-emerald-500/30 bg-emerald-500/5"
											: "border-white/[0.08] bg-white/[0.03]"
									}`}
								>
									<div
										className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
											q.done ? "bg-emerald-500 border-emerald-400" : "border-gray-600"
										}`}
									>
										{q.done ? <Check className="w-3 h-3 text-white" aria-hidden /> : null}
									</div>
									<div className="min-w-0 flex-1">
										<p className={`text-sm font-medium ${q.done ? "text-emerald-200 line-through" : "text-white"}`}>
											{q.title}
										</p>
										<p className="text-xs text-gray-500 mt-0.5">
											{q.tag} · +{q.xp} XP
										</p>
									</div>
								</div>
							))}
							<p className="text-[11px] text-center text-gray-600 pt-1">
								Preview — your quests are generated from your goals after signup.
							</p>
						</Card>
					</motion.div>
				</div>

				<section className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
					{FEATURES.map((f, i) => (
						<motion.div
							key={f.title}
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 + i * 0.06 }}
						>
							<Card className="h-full border-purple-500/20 bg-[#111827]/80 p-5 space-y-3">
								<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/80 to-violet-600/80 flex items-center justify-center">
									<f.icon className="w-5 h-5 text-white" aria-hidden />
								</div>
								<h2 className="text-base font-semibold text-white">{f.title}</h2>
								<p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
							</Card>
						</motion.div>
					))}
				</section>
			</main>

			<footer className="relative z-10 border-t border-white/[0.06] mt-8 py-8 px-4">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
					<p className="text-gray-600">© {new Date().getFullYear()} LevelUp</p>
					<LegalFooterLinks align="center" className="text-sm" />
				</div>
			</footer>
		</div>
	);
}
