export type TutorialStepKind = "next" | "goal_created" | "quest_completed";

export type TutorialStepDef = {
	id: string;
	path: string;
	kind: TutorialStepKind;
	title: string;
	body: string;
	/** CSS selector for spotlight ring; omitted = no ring */
	spotlightSelector?: string;
	/** Primary button label for `next` steps */
	nextLabel?: string;
};

export const TUTORIAL_STEPS: TutorialStepDef[] = [
	{
		id: "welcome",
		path: "/",
		kind: "next",
		title: "Welcome to LevelUp",
		body: "This quick tour walks you through the essentials. You will begin on the **Quests** page with a short **onboarding quest**, then Training, more quests, achievements, streaks, leaderboard, profile, pricing, and settings. Progress when you tap **Next** or complete the highlighted actions.",
		nextLabel: "Start tour",
	},
	{
		id: "onboarding_quest",
		path: "/quests",
		kind: "next",
		title: "Onboarding quest: First program",
		body: "The highlighted card is your **onboarding quest**. Finish it by adding your first training program under **Training** — that unlocks generated quests here and earns XP. Tap **Continue** when you are ready to go to Training.",
		nextLabel: "Continue",
		spotlightSelector: '[data-tutorial="onboarding-quest"]',
	},
	{
		id: "goals_create",
		path: "/goals",
		kind: "goal_created",
		title: "Complete the quest",
		body: "Tap **Add program** (or **Add your first program**), fill the form, and submit. You earn **XP** for your first program, same idea as quest rewards. This step advances automatically when the program is created.",
		spotlightSelector: '[data-tutorial="add-goal"]',
	},
	{
		id: "xp_bar_intro",
		path: "/quests",
		kind: "next",
		title: "Your XP bar",
		body: "You just earned XP. The bar up top tracks progress toward your **next level** — keep earning XP from quests and training to climb **Hunter rank**. Tap **Next** to keep going with your quests board.",
		nextLabel: "Next",
		spotlightSelector: '[data-tutorial="xp-bar"]',
	},
	{
		id: "quests_intro",
		path: "/quests",
		kind: "next",
		title: "Your quests board",
		body: "Quests are daily, weekly, and monthly missions tied to your programs. Use filters and tabs to focus. When you are ready, tap **Next** — then you will complete one real quest to continue the tour.",
		nextLabel: "Next",
	},
	{
		id: "quests_complete",
		path: "/quests",
		kind: "quest_completed",
		title: "Complete one quest",
		body: "Pick any unfinished quest and press **Complete** so we can log real XP. This step advances automatically when the server accepts your first completion during the tour (if you already finished quests before, we will move you forward when you open this page).",
		spotlightSelector: '[data-tutorial="quest-board"]',
	},
	{
		id: "achievements",
		path: "/achievements",
		kind: "next",
		title: "Achievements",
		body: "Badges and titles unlock from your training habits — streaks, quest volume, levels, and more. Locked cards show hints; unlocked ones celebrate milestones. Check back after hard weeks.",
		nextLabel: "Next",
	},
	{
		id: "streak",
		path: "/streak",
		kind: "next",
		title: "Streak calendar",
		body: "Consistency is tracked on a calendar: days with logged activity build your streak. Long breaks can trigger comeback boosts — the app nudges you without shaming.",
		nextLabel: "Next",
	},
	{
		id: "leaderboard",
		path: "/leaderboard",
		kind: "next",
		title: "Leaderboard",
		body: "Compare Hunter rank and XP with others in your rank bracket. Live updates show when the board changes. Some accounts need Google sign-in to view the board — the app will say so if that applies to you.",
		nextLabel: "Next",
	},
	{
		id: "profile",
		path: "/profile",
		kind: "next",
		title: "Profile",
		body: "Your display name, avatar, and bio live here. Keeping your profile fresh helps teammates recognize you on the leaderboard.",
		nextLabel: "Next",
	},
	{
		id: "pricing",
		path: "/pricing",
		kind: "next",
		title: "Pricing",
		body: "Optional paid tiers add perks like analytics depth or flair. You can run the full quest loop on the free tier.",
		nextLabel: "Next",
	},
	{
		id: "settings",
		path: "/settings",
		kind: "next",
		title: "Settings",
		body: "Notification toggles and preferences live here. You are done with the tour — tap **Finish** to dismiss and save progress.",
		nextLabel: "Finish",
	},
];
