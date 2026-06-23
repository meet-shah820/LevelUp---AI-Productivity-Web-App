import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Share2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { trackContentShared } from "../analytics/posthog";
import type { CelebrationItem } from "../utils/celebration";
import { CELEBRATION_EVENT } from "../utils/celebration";
import {
	SHARE_PLATFORMS,
	buildAchievementSharePayload,
	buildAllQuestsSharePayload,
	canUseNativeShare,
	sharePayload,
	type SharePayload,
	type SharePlatform,
} from "../utils/socialShare";

type Props = {
	item: CelebrationItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function runShare(platform: SharePlatform, payload: SharePayload, contentType: "achievement" | "all_quests") {
	void sharePayload(platform, payload).then((result) => {
		if (result === "copied") toast.success("Copied to clipboard");
		else if (result === "shared") toast.success("Shared");
		if (result === "copied" || result === "shared" || result === "opened") {
			trackContentShared({ contentType, platform });
		}
	});
}

export function CelebrationModal({ item, open, onOpenChange }: Props) {
	const [shareOpen, setShareOpen] = useState(false);
	const nativeAvailable = canUseNativeShare();

	const sharePayloadMemo = useMemo((): SharePayload | null => {
		if (!item) return null;
		if (item.kind === "achievement") return buildAchievementSharePayload(item.achievement);
		return buildAllQuestsSharePayload();
	}, [item]);

	const platforms = SHARE_PLATFORMS.filter((p) => p.id !== "native" || nativeAvailable);
	const contentType = item?.kind === "achievement" ? "achievement" : "all_quests";

	const headline =
		item?.kind === "achievement"
			? `Congratulations on getting the ${item.achievement.name} achievement`
			: "Congratulations on completing All the quests";

	const subtitle =
		item?.kind === "achievement"
			? item.achievement.description || "A new milestone on your training journey."
			: "You finished every daily, weekly, and monthly quest in this cycle. Outstanding work.";

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setShareOpen(false);
				onOpenChange(next);
			}}
		>
			<DialogContent
				className="sm:max-w-md border-purple-500/30 bg-[#0c101c] text-white shadow-2xl shadow-purple-900/40 gap-0 p-0"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<div className="p-6 sm:p-8 space-y-5 text-center">
					<DialogHeader className="space-y-4 items-center text-center">
						<div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/35">
							{item?.kind === "achievement" ? (
								<Trophy className="w-8 h-8 text-white" aria-hidden />
							) : (
								<PartyPopper className="w-8 h-8 text-white" aria-hidden />
							)}
						</div>
						<div className="space-y-2">
							<p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center justify-center gap-1.5">
								<Sparkles className="w-3.5 h-3.5" aria-hidden />
								Milestone unlocked
							</p>
							<DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-snug">{headline}</DialogTitle>
							<DialogDescription className="text-white/60 text-sm sm:text-base leading-relaxed">{subtitle}</DialogDescription>
						</div>
					</DialogHeader>
				</div>

				<DialogFooter className="border-t border-white/10 bg-black/20 px-6 py-4 flex-col sm:flex-col gap-2">
					{sharePayloadMemo ? (
						<DropdownMenu open={shareOpen} onOpenChange={setShareOpen}>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-600 text-white gap-2"
								>
									<Share2 className="w-4 h-4" aria-hidden />
									Share
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="center"
								className="bg-[#111827] border-purple-500/30 text-white min-w-[11rem]"
							>
								<DropdownMenuLabel className="text-gray-400 text-xs font-normal">Share your win</DropdownMenuLabel>
								<DropdownMenuSeparator className="bg-purple-500/20" />
								{platforms.map((p) => (
									<DropdownMenuItem
										key={p.id}
										className="focus:bg-white/10 focus:text-white cursor-pointer"
										onClick={() => {
											setShareOpen(false);
											runShare(p.id, sharePayloadMemo, contentType);
										}}
									>
										{p.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
					<Button
						type="button"
						variant="outline"
						className="w-full border-purple-500/30 text-gray-200 hover:bg-white/10 hover:text-white"
						onClick={() => onOpenChange(false)}
					>
						Continue
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function CelebrationHost() {
	const [queue, setQueue] = useState<CelebrationItem[]>([]);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onCelebration = (e: Event) => {
			const detail = (e as CustomEvent<{ items: CelebrationItem[] }>).detail;
			const items = detail?.items?.filter(Boolean) || [];
			if (!items.length) return;
			setQueue((prev) => [...prev, ...items]);
			setOpen(true);
		};
		window.addEventListener(CELEBRATION_EVENT, onCelebration);
		return () => window.removeEventListener(CELEBRATION_EVENT, onCelebration);
	}, []);

	const current = queue[0] ?? null;

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setQueue((prev) => {
				const rest = prev.slice(1);
				if (rest.length > 0) {
					window.setTimeout(() => setOpen(true), 200);
				}
				return rest;
			});
		}
		setOpen(next);
	};

	return <CelebrationModal item={current} open={open && current != null} onOpenChange={handleOpenChange} />;
}
