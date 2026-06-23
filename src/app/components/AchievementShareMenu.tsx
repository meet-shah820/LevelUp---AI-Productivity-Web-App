import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { trackContentShared } from "../analytics/posthog";
import {
	SHARE_PLATFORMS,
	buildAchievementSharePayload,
	canUseNativeShare,
	sharePayload,
	type SharePayload,
	type SharePlatform,
} from "../utils/socialShare";

export type AchievementShareTarget = {
	id: string;
	name: string;
	description?: string;
	rarity?: string;
};

type AchievementShareMenuProps = {
	achievement: AchievementShareTarget;
	/** compact = icon-only button on cards */
	variant?: "default" | "compact";
	className?: string;
};

function runShare(platform: SharePlatform, payload: SharePayload) {
	void sharePayload(platform, payload).then((result) => {
		if (result === "copied") toast.success("Copied to clipboard");
		else if (result === "shared") toast.success("Shared");
		if (result === "copied" || result === "shared" || result === "opened") {
			trackContentShared({ contentType: "achievement", platform });
		}
	});
}

export function AchievementShareMenu({ achievement, variant = "default", className }: AchievementShareMenuProps) {
	const [open, setOpen] = useState(false);
	const payload = buildAchievementSharePayload(achievement);
	const nativeAvailable = canUseNativeShare();

	const platforms = SHARE_PLATFORMS.filter((p) => p.id !== "native" || nativeAvailable);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				{variant === "compact" ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={`h-8 w-8 text-indigo-300 hover:text-white hover:bg-white/10 ${className || ""}`}
						aria-label={`Share ${achievement.name}`}
						onClick={(e) => e.stopPropagation()}
					>
						<Share2 className="w-4 h-4" />
					</Button>
				) : (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className={`border-purple-500/40 text-indigo-200 hover:bg-white/10 hover:text-white gap-2 ${className || ""}`}
						onClick={(e) => e.stopPropagation()}
					>
						<Share2 className="w-4 h-4" />
						Share
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="bg-[#111827] border-purple-500/30 text-white min-w-[11rem]"
				onClick={(e) => e.stopPropagation()}
			>
				<DropdownMenuLabel className="text-gray-400 text-xs font-normal">Share achievement</DropdownMenuLabel>
				<DropdownMenuSeparator className="bg-purple-500/20" />
				{platforms.map((p) => (
					<DropdownMenuItem
						key={p.id}
						className="focus:bg-white/10 focus:text-white cursor-pointer"
						onClick={() => {
							setOpen(false);
							runShare(p.id, payload);
						}}
					>
						{p.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
