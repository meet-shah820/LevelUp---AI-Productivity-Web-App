import { useCallback, useEffect, useState } from "react";
import { PartyPopper, Share2, Sparkles, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { SocialSharePicker } from "./SocialShareDialog";
import type { CelebrationItem } from "../utils/celebration";
import { CELEBRATION_EVENT, buildCelebrationSharePayload } from "../utils/celebration";

type Props = {
	item: CelebrationItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type ModalView = "celebration" | "share";

export function CelebrationModal({ item, open, onOpenChange }: Props) {
	const [view, setView] = useState<ModalView>("celebration");

	const resolveSharePayload = useCallback(
		(origin: string) => {
			if (!item) {
				return { title: "LevelUp", text: "", url: origin };
			}
			return buildCelebrationSharePayload(item, origin);
		},
		[item]
	);

	const contentType = item?.kind === "achievement" ? "achievement" : "all_quests";

	const headline =
		item?.kind === "achievement"
			? `Congratulations on getting the ${item.achievement.name} achievement`
			: "Congratulations on completing All the quests";

	const subtitle =
		item?.kind === "achievement"
			? item.achievement.description || "A new milestone on your training journey."
			: "You finished every daily, weekly, and monthly quest in this cycle. Outstanding work.";

	useEffect(() => {
		if (!open) setView("celebration");
	}, [open, item]);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setView("celebration");
				onOpenChange(next);
			}}
		>
			<DialogContent
				className="sm:max-w-lg border-purple-500/30 bg-[#0c101c] text-white shadow-2xl shadow-purple-900/40 gap-0 p-0"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				{view === "share" && item ? (
					<SocialSharePicker
						key={`share-${item.kind}-${item.kind === "achievement" ? item.achievement.id : "all"}`}
						resolvePayload={resolveSharePayload}
						contentType={contentType}
						title="Share on social media"
						description="Choose one or more platforms to share your milestone."
						onCancel={() => setView("celebration")}
						onComplete={() => setView("celebration")}
					/>
				) : (
					<>
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
							{item ? (
								<Button
									type="button"
									className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-600 text-white gap-2"
									onClick={() => setView("share")}
								>
									<Share2 className="w-4 h-4" aria-hidden />
									Share
								</Button>
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
					</>
				)}
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
