import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Lock, Check, Award, Trophy } from "lucide-react";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { getAchievements, RANK_UPDATED_EVENT } from "../utils/api";

type Achievement = {
  id: string | number;
  name: string;
  description: string;
  icon?: string;
  unlocked?: boolean;
  unlockedDate?: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  progress?: number;
  maxProgress?: number;
  /** When set, a goal in this category is required before this achievement can unlock. */
  blockedByCategory?: string;
};

export default function Achievements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightAchievementId = searchParams.get("highlight");

  const [serverData, setServerData] = useState<{ unlocked: Achievement[]; locked: Achievement[]; stats: any } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await getAchievements();
        setServerData(res);
        window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
      } catch {
        // ignore; fallback to static rendering with none
      }
    })();
  }, []);
  const achievements: Achievement[] = useMemo(() => {
    const merged: Achievement[] = [
      ...(serverData?.unlocked?.map((a) => ({ ...a, unlocked: true })) || []),
      ...(serverData?.locked || []),
    ];
    const order: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
    merged.sort((a, b) => (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9));
    return merged;
  }, [serverData]);

  useEffect(() => {
    if (!highlightAchievementId) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`achievement-card-${highlightAchievementId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    const clearHighlight = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("highlight");
          return n;
        },
        { replace: true }
      );
    }, 6000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearHighlight);
    };
  }, [highlightAchievementId, setSearchParams]);

  const rarityColors = {
    common: {
      bg: "from-gray-500/20 to-gray-600/20",
      border: "border-gray-500/30",
      text: "text-gray-400",
      glow: "shadow-gray-500/20",
    },
    rare: {
      bg: "from-blue-500/20 to-cyan-500/20",
      border: "border-blue-500/30",
      text: "text-blue-400",
      glow: "shadow-blue-500/30",
    },
    epic: {
      bg: "from-purple-500/20 to-pink-500/20",
      border: "border-purple-500/30",
      text: "text-purple-400",
      glow: "shadow-purple-500/30",
    },
    legendary: {
      bg: "from-yellow-500/20 to-orange-500/20",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
      glow: "shadow-yellow-500/30",
    },
    mythic: {
      bg: "from-red-500/25 to-rose-700/20",
      border: "border-red-500/50",
      text: "text-red-300",
      glow: "shadow-red-500/40",
    },
  };

  const stats = {
    total: achievements.length,
    unlocked: achievements.filter((a) => a.unlocked).length,
    byRarity: {
      common: achievements.filter((a) => a.rarity === "common" && a.unlocked).length,
      rare: achievements.filter((a) => a.rarity === "rare" && a.unlocked).length,
      epic: achievements.filter((a) => a.rarity === "epic" && a.unlocked).length,
      legendary: achievements.filter((a) => a.rarity === "legendary" && a.unlocked).length,
      mythic: achievements.filter((a) => a.rarity === "mythic" && a.unlocked).length,
    },
  };

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Achievements</h1>
        <p className="text-gray-400">
          Unlock achievements to showcase your progress
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 shadow-xl shadow-purple-500/20">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {stats.unlocked} / {stats.total}
                  </h2>
                  <p className="text-sm text-gray-400">Achievements Unlocked</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 text-center">
                <p className="text-2xl font-bold text-gray-400 mb-1">
                  {stats.byRarity.common}
                </p>
                <p className="text-xs text-gray-500">Common</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                <p className="text-2xl font-bold text-blue-400 mb-1">
                  {stats.byRarity.rare}
                </p>
                <p className="text-xs text-gray-500">Rare</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                <p className="text-2xl font-bold text-purple-400 mb-1">
                  {stats.byRarity.epic}
                </p>
                <p className="text-xs text-gray-500">Epic</p>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
                <p className="text-2xl font-bold text-yellow-400 mb-1">
                  {stats.byRarity.legendary}
                </p>
                <p className="text-xs text-gray-500">Legendary</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-center col-span-2 sm:col-span-1 ring-1 ring-red-500/25">
                <p className="text-2xl font-bold text-red-400 mb-1">
                  {stats.byRarity.mythic}
                </p>
                <p className="text-xs text-red-200/85">Mythic</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {achievements.map((achievement, index) => {
          const colors = rarityColors[achievement.rarity] ?? rarityColors.common;
          const progressPercentage = achievement.maxProgress
            ? ((achievement.progress || 0) / achievement.maxProgress) * 100
            : 0;
          const aid = String(achievement.id);
          const isHighlighted = Boolean(highlightAchievementId && aid === highlightAchievementId);

          return (
            <motion.div
              key={achievement.id}
              id={`achievement-card-${aid}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.03 }}
              className={
                isHighlighted
                  ? "rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0B0F1A] shadow-lg shadow-amber-500/20"
                  : ""
              }
            >
              <Card
                className={`bg-gradient-to-br ${colors.bg} ${colors.border} border-2 ${
                  achievement.unlocked ? `shadow-xl ${colors.glow}` : "opacity-60"
                } hover:scale-105 transition-all group relative overflow-hidden`}
              >
                {/* Background glow effect */}
                {achievement.unlocked && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                <div className="relative z-10 p-5 space-y-4">
                  {/* Icon and Status */}
                  <div className="flex items-start justify-between">
                    <div
                      className={`text-5xl ${
                        achievement.unlocked ? "" : "grayscale opacity-50"
                      }`}
                    >
                      {achievement.icon}
                    </div>
                    {achievement.unlocked ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div>
                    <h3
                      className={`font-bold mb-1 ${
                        achievement.unlocked ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {achievement.name}
                    </h3>
                    <p className="text-xs text-gray-400">{achievement.description}</p>
                    {achievement.blockedByCategory ? (
                      <p className="text-xs text-amber-400/90 mt-2">
                        Requires an active <span className="font-medium">{achievement.blockedByCategory}</span> goal
                      </p>
                    ) : null}
                  </div>

                  {/* Rarity Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${colors.text} uppercase`}>
                      {achievement.rarity}
                    </span>
                    {achievement.unlocked && achievement.unlockedDate && (
                      <span className="text-xs text-gray-500">{achievement.unlockedDate}</span>
                    )}
                  </div>

                  {/* Progress Bar for Locked Achievements */}
                  {!achievement.unlocked && achievement.maxProgress && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Progress</span>
                        <span className={colors.text}>
                          {achievement.progress} / {achievement.maxProgress}
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-1.5" />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
