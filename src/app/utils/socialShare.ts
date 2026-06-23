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

let cachedPublicOrigin: string | null = null;
let publicOriginPromise: Promise<string> | null = null;

function encode(value: string) {
	return encodeURIComponent(value);
}

function readVitePublicOrigin(): string {
	const raw =
		(typeof import.meta !== "undefined" &&
			(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PUBLIC_APP_ORIGIN) ||
		"";
	return typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
}

/** Synchronous best-effort origin (env cache, then current browser origin). */
export function getAppOrigin(): string {
	const fromEnv = readVitePublicOrigin();
	if (fromEnv) return fromEnv;
	if (cachedPublicOrigin) return cachedPublicOrigin;
	if (typeof window !== "undefined" && window.location?.origin) {
		return window.location.origin.replace(/\/$/, "");
	}
	return "";
}

async function fetchPublicOriginFromApi(): Promise<string | null> {
	try {
		const apiBase =
			(typeof import.meta !== "undefined" &&
				(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE) ||
			"";
		const base = String(apiBase).replace(/\/$/, "");
		const res = await fetch(`${base}/api/public-config`, { credentials: "omit" });
		if (!res.ok) return null;
		const data = (await res.json()) as { appPublicOrigin?: string | null };
		const origin = typeof data.appPublicOrigin === "string" ? data.appPublicOrigin.trim().replace(/\/$/, "") : "";
		return origin || null;
	} catch {
		return null;
	}
}

/** Resolve canonical public app origin (Vite env → API config → current window). */
export async function resolvePublicAppOrigin(): Promise<string> {
	const fromEnv = readVitePublicOrigin();
	if (fromEnv) return fromEnv;
	if (cachedPublicOrigin) return cachedPublicOrigin;
	if (!publicOriginPromise) {
		publicOriginPromise = (async () => {
			const fromApi = await fetchPublicOriginFromApi();
			if (fromApi) {
				cachedPublicOrigin = fromApi;
				return fromApi;
			}
			return getAppOrigin();
		})().finally(() => {
			publicOriginPromise = null;
		});
	}
	return publicOriginPromise;
}

/** Rebuild a share URL with the resolved public origin (path + query preserved). */
export function absolutizeSharePayload(payload: SharePayload, origin: string): SharePayload {
	const base = origin.replace(/\/$/, "");
	if (!base) return payload;
	try {
		const parsed = new URL(payload.url);
		return {
			...payload,
			url: `${base}${parsed.pathname}${parsed.search}${parsed.hash}`,
		};
	} catch {
		if (payload.url.startsWith("/")) {
			return { ...payload, url: `${base}${payload.url}` };
		}
		return payload;
	}
}

export function buildAchievementSharePayload(
	achievement: {
		id: string;
		name: string;
		description?: string;
		rarity?: string;
	},
	origin?: string
): SharePayload {
	const base = (origin || getAppOrigin()).replace(/\/$/, "");
	const url = `${base}/achievements?highlight=${encodeURIComponent(achievement.id)}`;
	const rarity = achievement.rarity ? ` (${achievement.rarity})` : "";
	const text = `I unlocked the "${achievement.name}"${rarity} achievement on ${APP_NAME}! ${achievement.description || "Training quests, XP, and Hunter rank — join me."}`;
	return {
		title: `${achievement.name} — ${APP_NAME}`,
		text,
		url,
	};
}

export function buildAllQuestsSharePayload(origin?: string): SharePayload {
	const base = (origin || getAppOrigin()).replace(/\/$/, "");
	const url = `${base}/quests`;
	const text = `I completed all my daily, weekly, and monthly training quests on ${APP_NAME}! Quests, XP, and Hunter rank — join me.`;
	return {
		title: `All quests complete — ${APP_NAME}`,
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
		const ok = await copyToClipboard(payload.url);
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
