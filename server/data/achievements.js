/** Fitness training app — milestones tied to quests, XP, streaks, programs, and Hunter rank progression. */
export const ACHIEVEMENTS = [
	{ id: "program_committed", name: "Program Committed", description: "Start a training program goal in the app", rarity: "common", requiredCategory: "Fitness" },
	{ id: "plan_snapshot", name: "Roadmap Forged", description: "Your goal has an AI-generated training roadmap snapshot", rarity: "common", requiredCategory: "Fitness" },
	{ id: "library_grounded", name: "Evidence-Grounded", description: "Your program is grounded with open fitness-library references", rarity: "rare", requiredCategory: "Fitness" },

	{ id: "first_quest", name: "First Rep", description: "Complete your first training quest", rarity: "common", requiredCategory: "Fitness" },
	{ id: "five_quests", name: "Early Groove", description: "Complete 5 training quests", rarity: "common", requiredCategory: "Fitness" },
	{ id: "ten_quests", name: "Getting Warm", description: "Complete 10 training quests", rarity: "rare", requiredCategory: "Fitness" },
	{ id: "twentyfive_quests", name: "Habit Loaded", description: "Complete 25 training quests", rarity: "rare", requiredCategory: "Fitness" },
	{ id: "fifty_quests", name: "Momentum", description: "Complete 50 training quests", rarity: "epic", requiredCategory: "Fitness" },
	{ id: "hundred_quests", name: "Iron Will", description: "Complete 100 training quests", rarity: "legendary", requiredCategory: "Fitness" },

	{ id: "streak_3", name: "Three-Day Ignition", description: "Hit a 3-day training activity streak", rarity: "common", requiredCategory: "Fitness" },
	{ id: "streak_7", name: "Week of Steel", description: "Hit a 7-day training activity streak", rarity: "rare", requiredCategory: "Fitness" },
	{ id: "streak_14", name: "Two-Week Block", description: "Hit a 14-day training activity streak", rarity: "epic", requiredCategory: "Fitness" },
	{ id: "streak_30", name: "Unbroken Month", description: "Hit a 30-day training activity streak", rarity: "legendary", requiredCategory: "Fitness" },

	{ id: "level_10", name: "Double Digits", description: "Reach Hunter level 10", rarity: "rare", requiredCategory: "Fitness" },
	{ id: "level_25", name: "Veteran Hunter", description: "Reach Hunter level 25", rarity: "epic", requiredCategory: "Fitness" },

	{ id: "xp_1k", name: "Spark", description: "Reach 1,000 total XP", rarity: "common", requiredCategory: "Fitness" },
	{ id: "xp_10k", name: "Power Surge", description: "Reach 10,000 total XP", rarity: "epic", requiredCategory: "Fitness" },
	{ id: "xp_25k", name: "Ascendant", description: "Reach 25,000 total XP", rarity: "epic", requiredCategory: "Fitness" },
	{ id: "xp_50k", name: "Overpowered", description: "Reach 50,000 total XP", rarity: "legendary", requiredCategory: "Fitness" },
	{ id: "xp_100k", name: "Myth Forged", description: "Reach 100,000 total XP", rarity: "mythic", requiredCategory: "Fitness" },
];
