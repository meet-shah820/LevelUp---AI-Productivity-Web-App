export function calculateLevelFromXp(xp) {
	const safeXp = typeof xp === "number" && xp >= 0 ? xp : 0;
	return Math.floor(Math.sqrt(safeXp / 100)) + 1;
}

