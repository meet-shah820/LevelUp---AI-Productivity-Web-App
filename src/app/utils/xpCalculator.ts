/**
 * Calculate XP required for a specific level
 * Formula: Each level requires progressively more XP
 * Base XP is 1000 for level 1, then increases by 8% per level
 */
export function calculateXPForLevel(level: number): number {
  const baseXP = 1000;
  const growthRate = 1.08; // 8% increase per level
  
  return Math.round(baseXP * Math.pow(growthRate, level - 1));
}

/**
 * Calculate total XP needed to reach a specific level from level 1
 */
export function calculateTotalXPForLevel(level: number): number {
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += calculateXPForLevel(i);
  }
  return totalXP;
}

/**
 * Get current level based on total XP earned
 */
export function getLevelFromXP(totalXP: number): {
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
  progressToNextLevel: number;
} {
  let level = 1;
  let xpAccumulated = 0;
  
  while (xpAccumulated + calculateXPForLevel(level) <= totalXP) {
    xpAccumulated += calculateXPForLevel(level);
    level++;
  }
  
  const currentLevelXP = totalXP - xpAccumulated;
  const xpForNextLevel = calculateXPForLevel(level);
  const progressToNextLevel = currentLevelXP;
  
  return {
    level,
    currentLevelXP,
    xpForNextLevel,
    progressToNextLevel,
  };
}

/**
 * Examples of XP requirements:
 * Level 1 -> 2: 1,000 XP
 * Level 5 -> 6: 1,360 XP
 * Level 10 -> 11: 2,159 XP
 * Level 20 -> 21: 4,661 XP
 * Level 30 -> 31: 10,063 XP
 * Level 42 -> 43: 22,658 XP
 * Level 50 -> 51: 46,902 XP
 * Level 100 -> 101: 2,199,761 XP
 */
