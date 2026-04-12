export type GoalRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type Goal = {
  id: string;
  title: string;
  category: "Fitness" | "Learning" | "Business" | "Health" | "Career" | "Personal" | "Creative";
  /** Easiest → hardest */
  rarity: GoalRarity;
  description: string;
  deadline?: string;
  progress: number;
  createdAt: string;
  color: {
    from: string;
    to: string;
    glow: string;
  };
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  xp: number;
  difficulty: "Easy" | "Medium" | "Hard";
  completed: boolean;
  goalId: string | null;
  timeframe: "daily" | "weekly" | "monthly";
  expiresAt?: string;
  /** Server: incomplete quests surface a discipline protocol instead of the main quest text. */
  isPenaltyActive?: boolean;
  originalTitle?: string;
  category: string;
};

export const categoryColors: Record<Goal["category"], { from: string; to: string; glow: string }> = {
  Fitness: { from: "from-red-500", to: "to-orange-500", glow: "shadow-red-500/50" },
  Learning: { from: "from-blue-500", to: "to-cyan-500", glow: "shadow-blue-500/50" },
  Business: { from: "from-green-500", to: "to-emerald-500", glow: "shadow-green-500/50" },
  Health: { from: "from-pink-500", to: "to-rose-500", glow: "shadow-pink-500/50" },
  Career: { from: "from-purple-500", to: "to-indigo-500", glow: "shadow-purple-500/50" },
  Personal: { from: "from-yellow-500", to: "to-amber-500", glow: "shadow-yellow-500/50" },
  Creative: { from: "from-fuchsia-500", to: "to-purple-500", glow: "shadow-fuchsia-500/50" },
};

// Generate quests based on a goal
export function generateQuestsForGoal(goal: Goal): Quest[] {
  const questTemplates: Record<Goal["category"], {
    daily: { title: string; description: string; xp: number; difficulty: Quest["difficulty"] }[];
    weekly: { title: string; description: string; xp: number; difficulty: Quest["difficulty"] }[];
    monthly: { title: string; description: string; xp: number; difficulty: Quest["difficulty"] }[];
  }> = {
    Fitness: {
      daily: [
        { title: "Morning Workout", description: "Complete a 30-minute workout session", xp: 150, difficulty: "Medium" },
        { title: "Protein Goal", description: "Hit your daily protein intake target", xp: 100, difficulty: "Easy" },
        { title: "10K Steps", description: "Walk at least 10,000 steps today", xp: 120, difficulty: "Easy" },
        { title: "Stretch Session", description: "Complete 15 minutes of stretching", xp: 80, difficulty: "Easy" },
      ],
      weekly: [
        { title: "5 Workout Days", description: "Complete 5 workout sessions this week", xp: 500, difficulty: "Hard" },
        { title: "Progressive Overload", description: "Increase weight on 3 exercises", xp: 400, difficulty: "Medium" },
        { title: "Meal Prep Sunday", description: "Prepare healthy meals for the week", xp: 350, difficulty: "Medium" },
        { title: "Track Everything", description: "Log all workouts and meals for 7 days", xp: 450, difficulty: "Hard" },
      ],
      monthly: [
        { title: "Body Transformation", description: "Lose 2-4 lbs or gain lean muscle", xp: 2000, difficulty: "Hard" },
        { title: "New PR", description: "Set a new personal record in any lift", xp: 1500, difficulty: "Hard" },
        { title: "Consistency King", description: "Workout 20+ days this month", xp: 1800, difficulty: "Hard" },
        { title: "Nutrition Master", description: "Hit macros 25+ days this month", xp: 1600, difficulty: "Hard" },
      ],
    },
    Learning: {
      daily: [
        { title: "Read 30 Pages", description: "Read at least 30 pages of any book", xp: 120, difficulty: "Easy" },
        { title: "Course Progress", description: "Complete one lesson in your online course", xp: 150, difficulty: "Medium" },
        { title: "Practice Skills", description: "Practice your target skill for 25 minutes", xp: 100, difficulty: "Easy" },
        { title: "Take Notes", description: "Summarize what you learned today", xp: 80, difficulty: "Easy" },
      ],
      weekly: [
        { title: "Finish a Book", description: "Complete reading one full book", xp: 600, difficulty: "Hard" },
        { title: "Course Milestone", description: "Complete 3+ course modules", xp: 500, difficulty: "Medium" },
        { title: "Apply Knowledge", description: "Create a project using what you learned", xp: 700, difficulty: "Hard" },
        { title: "Teach Someone", description: "Explain a concept to someone else", xp: 400, difficulty: "Medium" },
      ],
      monthly: [
        { title: "Skill Master", description: "Complete an entire course or certification", xp: 2500, difficulty: "Hard" },
        { title: "Portfolio Piece", description: "Build a major project showcasing your skills", xp: 2000, difficulty: "Hard" },
        { title: "Reading Streak", description: "Read every single day this month", xp: 1800, difficulty: "Hard" },
        { title: "Knowledge Share", description: "Write 4 blog posts or create 4 videos", xp: 2200, difficulty: "Hard" },
      ],
    },
    Business: {
      daily: [
        { title: "Network", description: "Reach out to 3 potential connections", xp: 130, difficulty: "Medium" },
        { title: "Content Creation", description: "Create and post business content", xp: 150, difficulty: "Medium" },
        { title: "Revenue Focus", description: "Spend 1 hour on revenue-generating tasks", xp: 140, difficulty: "Medium" },
        { title: "Learn Business", description: "Study business strategies for 30 minutes", xp: 100, difficulty: "Easy" },
      ],
      weekly: [
        { title: "Close a Deal", description: "Close at least one sale or client", xp: 800, difficulty: "Hard" },
        { title: "Marketing Push", description: "Launch a marketing campaign", xp: 600, difficulty: "Hard" },
        { title: "Optimize Systems", description: "Improve one business process or system", xp: 500, difficulty: "Medium" },
        { title: "Team Meeting", description: "Hold productive team strategy session", xp: 400, difficulty: "Medium" },
      ],
      monthly: [
        { title: "Revenue Goal", description: "Hit your monthly revenue target", xp: 3000, difficulty: "Hard" },
        { title: "Launch Product", description: "Launch a new product or service", xp: 2500, difficulty: "Hard" },
        { title: "Scale Operations", description: "Hire or automate to grow capacity", xp: 2200, difficulty: "Hard" },
        { title: "Market Leader", description: "Publish 12+ pieces of valuable content", xp: 2000, difficulty: "Hard" },
      ],
    },
    Health: {
      daily: [
        { title: "Water Intake", description: "Drink 8 glasses of water", xp: 80, difficulty: "Easy" },
        { title: "Healthy Meals", description: "Eat 3 balanced, nutritious meals", xp: 120, difficulty: "Easy" },
        { title: "Sleep 8 Hours", description: "Get at least 8 hours of quality sleep", xp: 100, difficulty: "Medium" },
        { title: "Vitamin Routine", description: "Take all your daily supplements", xp: 60, difficulty: "Easy" },
      ],
      weekly: [
        { title: "Meal Planning", description: "Plan and prep healthy meals for the week", xp: 400, difficulty: "Medium" },
        { title: "Health Checkup", description: "Complete a health assessment or doctor visit", xp: 500, difficulty: "Medium" },
        { title: "Stress Management", description: "Practice meditation or yoga 4+ times", xp: 450, difficulty: "Medium" },
        { title: "No Junk Food", description: "Avoid processed foods for 7 days", xp: 600, difficulty: "Hard" },
      ],
      monthly: [
        { title: "Health Transformation", description: "Improve key health metrics", xp: 2000, difficulty: "Hard" },
        { title: "Habit Stack", description: "Build 3 new healthy habits", xp: 1800, difficulty: "Hard" },
        { title: "Wellness Warrior", description: "Complete 30-day wellness challenge", xp: 2200, difficulty: "Hard" },
        { title: "Mindful Month", description: "Meditate every day for 30 days", xp: 1600, difficulty: "Hard" },
      ],
    },
    Career: {
      daily: [
        { title: "Skill Development", description: "Learn something new in your field", xp: 120, difficulty: "Easy" },
        { title: "Professional Network", description: "Connect with industry professionals", xp: 100, difficulty: "Easy" },
        { title: "Portfolio Update", description: "Add to your professional portfolio", xp: 140, difficulty: "Medium" },
        { title: "Industry News", description: "Stay updated with industry trends", xp: 80, difficulty: "Easy" },
      ],
      weekly: [
        { title: "Career Project", description: "Complete a significant work project", xp: 600, difficulty: "Hard" },
        { title: "Mentorship", description: "Have a session with mentor or mentee", xp: 400, difficulty: "Medium" },
        { title: "Resume Polish", description: "Update and improve your resume/LinkedIn", xp: 350, difficulty: "Medium" },
        { title: "Industry Event", description: "Attend a professional event or webinar", xp: 450, difficulty: "Medium" },
      ],
      monthly: [
        { title: "Promotion Push", description: "Complete requirements for next level", xp: 2500, difficulty: "Hard" },
        { title: "Certification", description: "Earn a professional certification", xp: 2200, difficulty: "Hard" },
        { title: "Side Project", description: "Launch a career-boosting side project", xp: 2000, difficulty: "Hard" },
        { title: "Thought Leader", description: "Establish yourself as an expert", xp: 1800, difficulty: "Hard" },
      ],
    },
    Personal: {
      daily: [
        { title: "Gratitude Journal", description: "Write 3 things you're grateful for", xp: 80, difficulty: "Easy" },
        { title: "Quality Time", description: "Spend quality time with loved ones", xp: 100, difficulty: "Easy" },
        { title: "Personal Hobby", description: "Dedicate time to your favorite hobby", xp: 120, difficulty: "Easy" },
        { title: "Self-Reflection", description: "Reflect on your day and growth", xp: 90, difficulty: "Easy" },
      ],
      weekly: [
        { title: "New Experience", description: "Try something you've never done before", xp: 500, difficulty: "Medium" },
        { title: "Relationship Building", description: "Deepen a meaningful relationship", xp: 400, difficulty: "Medium" },
        { title: "Organize Life", description: "Declutter and organize your space", xp: 350, difficulty: "Medium" },
        { title: "Digital Detox", description: "Take one day off from social media", xp: 450, difficulty: "Hard" },
      ],
      monthly: [
        { title: "Major Milestone", description: "Achieve a significant personal goal", xp: 2000, difficulty: "Hard" },
        { title: "Adventure", description: "Go on a memorable trip or experience", xp: 1800, difficulty: "Hard" },
        { title: "Give Back", description: "Volunteer or help your community 4+ times", xp: 1600, difficulty: "Hard" },
        { title: "Life Balance", description: "Maintain work-life balance for 30 days", xp: 2200, difficulty: "Hard" },
      ],
    },
    Creative: {
      daily: [
        { title: "Creative Work", description: "Spend 1 hour on creative projects", xp: 150, difficulty: "Medium" },
        { title: "Inspiration Hunt", description: "Collect 5 pieces of creative inspiration", xp: 80, difficulty: "Easy" },
        { title: "Skill Practice", description: "Practice your creative craft", xp: 120, difficulty: "Easy" },
        { title: "Share Your Work", description: "Post your creative work online", xp: 100, difficulty: "Easy" },
      ],
      weekly: [
        { title: "Complete a Piece", description: "Finish one creative project", xp: 600, difficulty: "Hard" },
        { title: "Experiment", description: "Try a new creative technique or style", xp: 500, difficulty: "Medium" },
        { title: "Creative Challenge", description: "Participate in a creative challenge", xp: 550, difficulty: "Medium" },
        { title: "Get Feedback", description: "Share work and gather constructive feedback", xp: 400, difficulty: "Medium" },
      ],
      monthly: [
        { title: "Portfolio Piece", description: "Create a portfolio-worthy masterpiece", xp: 2500, difficulty: "Hard" },
        { title: "Exhibition", description: "Display your work publicly or online", xp: 2000, difficulty: "Hard" },
        { title: "Creative Streak", description: "Create something every day for 30 days", xp: 2200, difficulty: "Hard" },
        { title: "Monetize", description: "Sell or monetize your creative work", xp: 1800, difficulty: "Hard" },
      ],
    },
  };

  const templates = questTemplates[goal.category];
  const today = new Date();
  
  return [
    ...templates.daily.map((q, i) => ({
      id: `${goal.id}-daily-${i}`,
      ...q,
      goalId: goal.id,
      timeframe: "daily" as const,
      completed: false,
      category: goal.category,
      expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })),
    ...templates.weekly.map((q, i) => ({
      id: `${goal.id}-weekly-${i}`,
      ...q,
      goalId: goal.id,
      timeframe: "weekly" as const,
      completed: false,
      category: goal.category,
      expiresAt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })),
    ...templates.monthly.map((q, i) => ({
      id: `${goal.id}-monthly-${i}`,
      ...q,
      goalId: goal.id,
      timeframe: "monthly" as const,
      completed: false,
      category: goal.category,
      expiresAt: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })),
  ];
}
