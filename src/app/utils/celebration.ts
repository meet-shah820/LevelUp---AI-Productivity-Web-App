export type CelebrationAchievement = {
	id: string;
	name: string;
	description?: string;
	rarity?: string;
};

export type CelebrationItem =
	| { kind: "achievement"; achievement: CelebrationAchievement }
	| { kind: "all_quests" };

export const CELEBRATION_EVENT = "levelup:celebration";

export type CelebrationEventDetail = {
	items: CelebrationItem[];
};

export function dispatchCelebrations(items: CelebrationItem[]) {
	if (!items.length) return;
	window.dispatchEvent(
		new CustomEvent<CelebrationEventDetail>(CELEBRATION_EVENT, {
			detail: { items },
		})
	);
}

export function celebrationsFromQuestCompleteResponse(resp: {
	newlyUnlockedAchievements?: CelebrationAchievement[];
	allQuestsComplete?: boolean;
}): CelebrationItem[] {
	const items: CelebrationItem[] = [];
	if (resp.allQuestsComplete) {
		items.push({ kind: "all_quests" });
	}
	for (const achievement of resp.newlyUnlockedAchievements || []) {
		items.push({ kind: "achievement", achievement });
	}
	return items;
}
