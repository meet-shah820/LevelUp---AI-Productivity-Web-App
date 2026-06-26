import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Award, Target, Clock, TrendingUp, Swords, Brain, Shield, Zap, Flame } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { getProfile, getRecentHistory, PROFILE_UPDATED_EVENT, RANK_UPDATED_EVENT } from "../utils/api";
import { useEffectiveTier } from "../context/EffectiveTierContext";
import { tierMeetsMinimum, TIER_FOR } from "../utils/tierFeatures";
import { AchievementShareMenu } from "../components/AchievementShareMenu";
import { avatarInitialsFromProfile } from "../utils/avatarInitials";
import { usernameFromDisplayName } from "../utils/usernameFromDisplayName";

export default function Profile() {
  const navigate = useNavigate();
  const { effectiveTier } = useEffectiveTier();
  const [data, setData] = useState<any>(null);
  const [recentItems, setRecentItems] = useState<
    { id: string; type: "quest" | "level" | "achievement" | "focus" | "penalty"; message: string; xp?: number; at: string }[]
  >([]);

  const loadProfile = async () => {
    try {
      const res = await getProfile();
      setData(res);
    } catch {
      setData(null);
    }
  };

  const loadRecent = async () => {
    try {
      const hist = await getRecentHistory();
      setRecentItems(hist.items || []);
    } catch {
      setRecentItems([]);
    }
  };

  useEffect(() => {
    void loadProfile();
    void loadRecent();
    const onRank = () => {
      void loadProfile();
      void loadRecent();
    };
    window.addEventListener(RANK_UPDATED_EVENT, onRank);
    window.addEventListener(PROFILE_UPDATED_EVENT, onRank);
    return () => {
      window.removeEventListener(RANK_UPDATED_EVENT, onRank);
      window.removeEventListener(PROFILE_UPDATED_EVENT, onRank);
    };
  }, []);

  const user = useMemo(() => {
    if (!data) {
      return {
        name: "Player",
        username: "@shadow_hunter",
        avatar: "",
        level: 1,
        currentXP: 0,
        maxXP: 100,
        rank: "E",
        title: "Rising Hunter",
        joinDate: "—",
        bio: "",
      };
    }
    const dn = String(data.user.displayName || "").trim();
    const stored = data.user.username || "shadow_hunter";
    const handle = usernameFromDisplayName(dn, stored);
    return {
      name: dn || "Player",
      username: `@${handle}`,
      avatar: data.user.avatarDataUrl || "",
      level: data.user.level,
      currentXP: data.user.xp,
      maxXP: data.user.nextLevelXp,
      rank: data.user.rank ?? "E",
      title: "Rising Hunter",
      joinDate: "—",
      bio: data.user.bio || "",
    };
  }, [data]);

  const displayInitials = useMemo(() => {
    const dn = data?.user?.displayName || "";
    const stored = data?.user?.username || "shadow_hunter";
    return avatarInitialsFromProfile(dn, usernameFromDisplayName(dn, stored));
  }, [data]);

  const stats = [
    { name: "Strength", value: data?.user?.stats?.strength ?? 0, max: 100, icon: Swords, color: "from-red-500 to-orange-500" },
    { name: "Intelligence", value: data?.user?.stats?.intelligence ?? 0, max: 100, icon: Brain, color: "from-blue-500 to-cyan-500" },
    { name: "Agility", value: data?.user?.stats?.agility ?? 0, max: 100, icon: Shield, color: "from-purple-500 to-pink-500" },
    { name: "Vitality", value: data?.user?.stats?.vitality ?? 0, max: 100, icon: Zap, color: "from-green-500 to-emerald-500" },
  ];

  const achievements = (data?.recentAchievements || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    rarity: a.rarity,
    unlocked: true,
  }));

  const recentActivity = recentItems.map((it) => ({
    id: it.id,
    type: it.type,
    text: it.message,
    time: new Date(it.at).toLocaleString(),
    xp: it.xp,
  }));

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="text-gray-400">Your hunter profile, stats, and training history</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 shadow-xl shadow-purple-500/20 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

              <div className="relative z-10 p-6 space-y-6">
                {/* Avatar and Basic Info */}
                <div className="text-center">
                  <Avatar className="w-32 h-32 mx-auto border-4 border-purple-500/50 shadow-2xl shadow-purple-500/50 mb-4">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-3xl">
                      {displayInitials}
                    </AvatarFallback>
                  </Avatar>

                  <h2 className="text-2xl font-bold text-white mb-2">{user.name}</h2>

                  <p className="text-gray-400 mb-3">{user.username}</p>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 shadow-lg shadow-red-500/50">
                      Rank {user.rank}
                    </Badge>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                      Level {user.level}
                    </Badge>
                    {tierMeetsMinimum(effectiveTier, TIER_FOR.foundingBadgeFlair) ? (
                      <Badge
                        variant="outline"
                        className="border-violet-400/35 text-violet-200 bg-violet-500/10"
                        title="Founding flair for paid members (Starter or higher)"
                      >
                        Founder
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-sm text-purple-400 mb-4">{user.title}</p>
                </div>

                {/* XP Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Level Progress</span>
                    <span className="text-indigo-400 font-medium">
                      {user.currentXP.toLocaleString()} / {user.maxXP.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-purple-500/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(user.currentXP / user.maxXP) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="pt-4 border-t border-purple-500/20">
                  <p className="text-sm text-gray-400 mb-2">Bio</p>
                  <p className="text-sm text-white">{user.bio}</p>
                </div>

                {/* Joined Date */}
                <div className="text-center pt-4 border-t border-purple-500/20">
                  <p className="text-xs text-gray-500">Joined {user.joinDate}</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-gray-400">Quests completed</span>
                  </div>
                  <span className="text-lg font-bold text-white">{data?.quickStats?.questsCompleted ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-gray-400">Training focus time</span>
                  </div>
                  <span className="text-lg font-bold text-white">{data?.quickStats?.focusHours ?? 0}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-gray-400">Total XP</span>
                  </div>
                  <span className="text-lg font-bold text-white">{(data?.quickStats?.totalXp ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h3 className="text-lg font-bold text-white mb-6">Attributes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {stats.map((stat, index) => (
                  <div key={stat.name} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-400">{stat.name}</span>
                          <span className="text-sm font-bold text-white">{stat.value}/{stat.max}</span>
                        </div>
                        <Progress value={(stat.value / stat.max) * 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Achievements Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Recent Achievements</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-400 hover:text-indigo-300"
                  onClick={() => navigate("/achievements")}
                >
                  View All
                </Button>
              </div>
              {achievements.length === 0 ? (
                <p className="text-sm text-gray-500">No achievements yet. Complete quests to unlock your first.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                  {achievements.map((achievement: any) => (
                    <div
                      key={achievement.id}
                      className="relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-xs text-white transition-all bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30 shadow-lg shadow-yellow-500/20 p-2"
                      title={achievement.name}
                    >
                      <div className="absolute top-1 right-1">
                        <AchievementShareMenu achievement={achievement} variant="compact" />
                      </div>
                      <span className="px-1 text-center leading-tight">{achievement.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      {activity.type === "quest" && <Target className="w-5 h-5 text-white" />}
                      {activity.type === "level" && <TrendingUp className="w-5 h-5 text-white" />}
                      {activity.type === "focus" && <Clock className="w-5 h-5 text-white" />}
                      {activity.type === "achievement" && <Award className="w-5 h-5 text-white" />}
                      {activity.type === "penalty" && <Flame className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white mb-1">{activity.text}</p>
                      {typeof activity.xp === "number" && activity.xp !== 0 && (
                        <p className={`text-xs mb-1 ${activity.xp > 0 ? "text-indigo-400" : "text-red-400"}`}>
                          {activity.xp > 0 ? "+" : ""}{activity.xp} XP
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}