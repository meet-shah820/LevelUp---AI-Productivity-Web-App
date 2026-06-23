import { ACHIEVEMENTS } from "../data/achievements.js";

export function achievementsForClient(ids) {
	if (!Array.isArray(ids) || ids.length === 0) return [];
	return ids
		.map((id) => {
			const a = ACHIEVEMENTS.find((x) => x.id === id);
			if (!a) return null;
			return { id: a.id, name: a.name, description: a.description, rarity: a.rarity };
		})
		.filter(Boolean);
}
