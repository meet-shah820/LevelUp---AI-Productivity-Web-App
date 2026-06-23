export type SharePlatform =
	| "native"
	| "twitter"
	| "facebook"
	| "linkedin"
	| "whatsapp"
	| "reddit"
	| "telegram"
	| "copy";

export type SharePayload = {
	title: string;
	text: string;
	url: string;
};

const APP_NAME = "LevelUp";

function encode(value: string) {
	return encodeURIComponent(value);
}

export function getAppOrigin(): string {
	if (typeof window !== "undefined" && window.location?.origin) {
		return window.location.origin;
	}
	return "";
}

export function buildAchievementSharePayload(achievement: {
	id: string;
	name: string;
	description?: string;
	rarity?: string;
}): SharePayload {
	const origin = getAppOrigin();
	const url = `${origin}/achievements?highlight=${encodeURIComponent(achievement.id)}`;
	const rarity = achievement.rarity ? ` (${achievement.rarity})` : "";
	const text = `I unlocked the "${achievement.name}"${rarity} achievement on ${APP_NAME}! ${achievement.description || "Training quests, XP, and Hunter rank — join me."}`;
	return {
		title: `${achievement.name} — ${APP_NAME}`,
		text,
		url,
	};
}

export function buildReferralSharePayload(link: string, code: string): SharePayload {
	const text = `Join me on ${APP_NAME} — gamified training quests, XP, and Hunter rank. Use my invite code ${code} for bonus XP when you sign up!`;
	return {
		title: `Invite friends to ${APP_NAME}`,
		text,
		url: link,
	};
}

export function buildShareUrl(platform: Exclude<SharePlatform, "native" | "copy">, payload: SharePayload): string {
	const { title, text, url } = payload;
	switch (platform) {
		case "twitter":
			return `https://twitter.com/intent/tweet?text=${encode(text)}&url=${encode(url)}`;
		case "facebook":
			return `https://www.facebook.com/sharer/sharer.php?u=${encode(url)}&quote=${encode(text)}`;
		case "linkedin":
			return `https://www.linkedin.com/sharing/share-offsite/?url=${encode(url)}`;
		case "whatsapp":
			return `https://wa.me/?text=${encode(`${text} ${url}`)}`;
		case "reddit":
			return `https://www.reddit.com/submit?title=${encode(title)}&url=${encode(url)}`;
		case "telegram":
			return `https://t.me/share/url?url=${encode(url)}&text=${encode(text)}`;
		default:
			return url;
	}
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* fallback below */
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.style.position = "fixed";
		ta.style.left = "-9999px";
		document.body.appendChild(ta);
		ta.select();
		document.execCommand("copy");
		document.body.removeChild(ta);
		return true;
	} catch {
		return false;
	}
}

export async function sharePayload(platform: SharePlatform, payload: SharePayload): Promise<"shared" | "copied" | "opened"> {
	if (platform === "copy") {
		const ok = await copyToClipboard(`${payload.text}\n${payload.url}`);
		return ok ? "copied" : "opened";
	}
	if (platform === "native" && typeof navigator !== "undefined" && navigator.share) {
		try {
			await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
			return "shared";
		} catch (err) {
			if ((err as Error)?.name === "AbortError") return "opened";
		}
	}
	const url = buildShareUrl(platform === "native" ? "twitter" : platform, payload);
	window.open(url, "_blank", "noopener,noreferrer,width=600,height=520");
	return "opened";
}

export const SHARE_PLATFORMS: { id: SharePlatform; label: string }[] = [
	{ id: "native", label: "Share…" },
	{ id: "twitter", label: "X / Twitter" },
	{ id: "facebook", label: "Facebook" },
	{ id: "linkedin", label: "LinkedIn" },
	{ id: "whatsapp", label: "WhatsApp" },
	{ id: "telegram", label: "Telegram" },
	{ id: "reddit", label: "Reddit" },
	{ id: "copy", label: "Copy link" },
];

export function canUseNativeShare(): boolean {
	return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
