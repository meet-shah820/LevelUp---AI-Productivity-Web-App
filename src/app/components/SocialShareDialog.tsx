import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { trackContentShared } from "../analytics/posthog";
import {
	SHARE_PLATFORMS,
	absolutizeSharePayload,
	canUseNativeShare,
	copyToClipboard,
	resolvePublicAppOrigin,
	sharePayload,
	type SharePayload,
	type SharePlatform,
} from "../utils/socialShare";

export type ShareContentType = "achievement" | "all_quests" | "referral";

type SocialSharePickerProps = {
	/** Build share payload after the public app origin is resolved. */
	resolvePayload: (origin: string) => SharePayload;
	contentType: ShareContentType;
	title?: string;
	description?: string;
	onCancel: () => void;
	onComplete?: () => void;
};

async function shareToPlatforms(
	platforms: SharePlatform[],
	payload: SharePayload,
	contentType: ShareContentType
): Promise<{ opened: number; copied: number; shared: number }> {
	let opened = 0;
	let copied = 0;
	let shared = 0;

	for (const platform of platforms) {
		const result = await sharePayload(platform, payload);
		if (result === "opened") opened += 1;
		if (result === "copied") copied += 1;
		if (result === "shared") shared += 1;
		if (result === "copied" || result === "shared" || result === "opened") {
			trackContentShared({ contentType, platform });
		}
		if (platform !== platforms[platforms.length - 1]) {
			await new Promise((r) => window.setTimeout(r, 300));
		}
	}

	return { opened, copied, shared };
}

function shareResultToast({ opened, copied, shared }: { opened: number; copied: number; shared: number }) {
	if (shared > 0) {
		toast.success(shared === 1 ? "Shared successfully" : `Shared to ${shared} destinations`);
		return;
	}
	if (copied > 0) {
		toast.success(copied === 1 ? "Copied to clipboard" : `Copied ${copied} times`);
		return;
	}
	if (opened > 0) {
		toast.success(opened === 1 ? "Share window opened" : `Opened ${opened} share windows`);
	}
}

/** Multi-select social share picker — embed inside a parent dialog or standalone dialog. */
export function SocialSharePicker({
	resolvePayload,
	contentType,
	title = "Share on social media",
	description = "Select one or more platforms, then tap Share.",
	onCancel,
	onComplete,
}: SocialSharePickerProps) {
	const nativeAvailable = canUseNativeShare();
	const platforms = useMemo(
		() => SHARE_PLATFORMS.filter((p) => p.id !== "copy" && (p.id !== "native" || nativeAvailable)),
		[nativeAvailable]
	);

	const [livePayload, setLivePayload] = useState<SharePayload | null>(null);
	const [selected, setSelected] = useState<Set<SharePlatform>>(new Set());
	const [sharing, setSharing] = useState(false);
	const [copying, setCopying] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setSelected(new Set());
		setLivePayload(null);

		void resolvePublicAppOrigin().then((origin) => {
			if (cancelled) return;
			setLivePayload(resolvePayload(origin));
		});

		return () => {
			cancelled = true;
		};
	}, [resolvePayload]);

	const handleCopyLink = async () => {
		if (copying || !livePayload) return;
		setCopying(true);
		try {
			const ok = await copyToClipboard(livePayload.url);
			if (ok) {
				toast.success("Link copied");
				trackContentShared({ contentType, platform: "copy" });
			} else {
				toast.error("Could not copy link");
			}
		} finally {
			setCopying(false);
		}
	};

	const togglePlatform = (id: SharePlatform) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleShare = async () => {
		if (!livePayload || selected.size === 0 || sharing) return;
		setSharing(true);
		try {
			const results = await shareToPlatforms([...selected], livePayload, contentType);
			shareResultToast(results);
			onComplete?.();
		} finally {
			setSharing(false);
		}
	};

	return (
		<div className="flex flex-col">
			<div className="p-6 sm:p-8 space-y-5">
				<DialogHeader className="space-y-2 text-left">
					<DialogTitle className="text-xl font-bold text-white pr-8">{title}</DialogTitle>
					<DialogDescription className="text-white/55 text-sm leading-relaxed">{description}</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{platforms.map((p) => {
						const isSelected = selected.has(p.id);
						return (
							<button
								key={p.id}
								type="button"
								aria-pressed={isSelected}
								onClick={() => togglePlatform(p.id)}
								className={cn(
									"relative flex items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium transition-colors min-h-[3rem]",
									isSelected
										? "border-indigo-400/70 bg-indigo-500/20 text-white shadow-sm shadow-indigo-500/20"
										: "border-purple-500/25 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08] hover:text-white"
								)}
							>
								{isSelected ? (
									<span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white">
										<Check className="h-2.5 w-2.5" aria-hidden />
									</span>
								) : null}
								<span className="text-center leading-tight">{p.label}</span>
							</button>
						);
					})}
				</div>

				<p
					className={cn(
						"text-xs text-center",
						selected.size > 0 ? "text-indigo-300/90" : "text-white/40"
					)}
				>
					{selected.size > 0
						? `${selected.size} platform${selected.size === 1 ? "" : "s"} selected`
						: "Tap platforms to select them"}
				</p>
			</div>

			<div className="border-t border-white/10 bg-black/20 px-6 py-3">
				<div className="flex items-center gap-2 rounded-xl border border-purple-500/25 bg-[#0B0F1A] p-2 pl-3 min-h-[2.75rem]">
					<p
						className="min-w-0 flex-1 text-xs sm:text-sm text-indigo-200/90 truncate font-mono"
						title={livePayload?.url}
					>
						{livePayload?.url ?? "Loading share link…"}
					</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="shrink-0 border-purple-500/40 text-white hover:bg-white/10 gap-1.5 h-9"
						onClick={() => void handleCopyLink()}
						disabled={copying || !livePayload}
						aria-label="Copy link"
					>
						<Copy className="w-3.5 h-3.5" aria-hidden />
						Copy
					</Button>
				</div>
			</div>

			<div className="border-t border-white/10 bg-black/20 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					className="w-full sm:w-auto border-purple-500/30 text-gray-200 hover:bg-white/10 hover:text-white"
					onClick={onCancel}
					disabled={sharing}
				>
					Back
				</Button>
				<Button
					type="button"
					className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-600 text-white gap-2"
					onClick={() => void handleShare()}
					disabled={!livePayload || selected.size === 0 || sharing}
				>
					<Share2 className="w-4 h-4" aria-hidden />
					{sharing ? "Sharing…" : selected.size > 0 ? `Share (${selected.size})` : "Share"}
				</Button>
			</div>
		</div>
	);
}

type SocialShareDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	payload: SharePayload | null;
	contentType: ShareContentType;
	title?: string;
	description?: string;
};

/** Standalone share dialog (e.g. referrals, achievements). */
export function SocialShareDialog({
	open,
	onOpenChange,
	payload,
	contentType,
	title,
	description,
}: SocialShareDialogProps) {
	const resolvePayload = useCallback(
		(origin: string) => (payload ? absolutizeSharePayload(payload, origin) : { title: "", text: "", url: origin }),
		[payload]
	);

	if (!payload) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg border-purple-500/30 bg-[#0c101c] text-white shadow-2xl shadow-purple-900/40 gap-0 p-0"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<SocialSharePicker
					resolvePayload={resolvePayload}
					contentType={contentType}
					title={title}
					description={description}
					onCancel={() => onOpenChange(false)}
					onComplete={() => onOpenChange(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}
