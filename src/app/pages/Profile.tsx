import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Edit2, Award, Target, Clock, TrendingUp, Swords, Brain, Shield, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { getProfile, patchProfile, PROFILE_UPDATED_EVENT } from "../utils/api";

export default function Profile() {
  const [data, setData] = useState<any>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await getProfile();
      setData(res);
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const openRename = () => {
    const u = data?.user?.username ?? "shadow_hunter";
    setRenameInput(u);
    setRenameError(null);
    setRenameOpen(true);
  };

  const saveRename = async () => {
    setRenameError(null);
    setRenameSaving(true);
    try {
      const res = await patchProfile({ username: renameInput.trim() });
      localStorage.setItem("last_username", res.user.username);
      await loadProfile();
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
      setRenameOpen(false);
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : "Could not update username");
    } finally {
      setRenameSaving(false);
    }
  };

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
        title: "The System's Chosen",
        joinDate: "—",
        bio: "",
      };
    }
    const dn = String(data.user.displayName || "").trim();
    const un = data.user.username || "hunter";
    return {
      name: dn || "Player",
      username: `@${un}`,
      avatar: data.user.avatarDataUrl || "",
      level: data.user.level,
      currentXP: data.user.xp,
      maxXP: data.user.nextLevelXp,
      rank: data.user.rank ?? "E",
      title: "The System's Chosen",
      joinDate: "—",
      bio: data.user.bio || "",
    };
  }, [data]);

  const displayInitials = useMemo(() => {
    const dn = String(data?.user?.displayName || "").trim();
    const un = String(data?.user?.username || "sh");
    const base = dn || un.replace(/_/g, " ");
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    const clean = base.replace(/[^a-z0-9]/gi, "");
    return (clean.slice(0, 2) || "SH").toUpperCase();
  }, [data]);

  const stats = [
    { name: "Strength", value: data?.user?.stats?.strength ?? 0, max: 100, icon: Swords, color: "from-red-500 to-orange-500" },
    { name: "Intelligence", value: data?.user?.stats?.intelligence ?? 0, max: 100, icon: Brain, color: "from-blue-500 to-cyan-500" },
    { name: "Agility", value: data?.user?.stats?.agility ?? 0, max: 100, icon: Shield, color: "from-purple-500 to-pink-500" },
    { name: "Vitality", value: data?.user?.stats?.vitality ?? 0, max: 100, icon: Zap, color: "from-green-500 to-emerald-500" },
  ];

  const achievements = (data?.recentAchievements || []).map((a: any) => ({ id: a.id, name: a.name, unlocked: true }));

  const recentActivity = (data?.recentActivity || []).map((h: any, idx: number) => {
    const type = h.type;
    const text =
      type === "quest_complete" ? `Completed: ${h.meta?.title || "Quest"}` :
      type === "focus_session" ? "Focus session completed" :
      type === "level_up" ? `Reached Level ${h.meta?.level}` :
      type === "achievement_unlocked" ? `Achievement unlocked: ${h.meta?.achievementId}` :
      type;
    return { id: idx, type: type.includes("quest") ? "quest" : type.includes("achievement") ? "achievement" : type.includes("level") ? "level" : "skill", text, time: new Date(h.occurredAt).toLocaleString(), xp: h.xpChange };
  });

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="text-gray-400">Your journey and achievements</p>
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

                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                    <Button type="button" size="icon" variant="ghost" className="w-8 h-8" onClick={openRename} title="Change username">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-gray-400 mb-3">{user.username}</p>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 shadow-lg shadow-red-500/50">
                      Rank {user.rank}
                    </Badge>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                      Level {user.level}
                    </Badge>
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
                    <span className="text-sm text-gray-400">Total Quests</span>
                  </div>
                  <span className="text-lg font-bold text-white">{data?.quickStats?.questsCompleted ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-gray-400">Focus Time</span>
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
                <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300">
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
                      className="aspect-square rounded-xl border-2 flex items-center justify-center text-xs text-white transition-all bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30 shadow-lg shadow-yellow-500/20"
                      title={achievement.name}
                    >
                      <span className="px-2 text-center">{achievement.name}</span>
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
                      {activity.type === "skill" && <Zap className="w-5 h-5 text-white" />}
                      {activity.type === "achievement" && <Award className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white mb-1">{activity.text}</p>
                      {activity.xp && (
                        <p className="text-xs text-indigo-400 mb-1">+{activity.xp} XP</p>
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-[#111827] border-purple-500/30 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change username</DialogTitle>
            <DialogDescription className="text-gray-400">
              This updates your handle everywhere in the app (header, dashboard, settings). Use 3–32 characters: letters, numbers, and underscores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="profile-username">Username</Label>
            <div className="flex items-center gap-1 rounded-md border border-purple-500/30 bg-[#0B0F1A] px-3">
              <span className="text-gray-400 select-none">@</span>
              <Input
                id="profile-username"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value.replace(/\s/g, "_"))}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-white"
                placeholder="your_handle"
                autoComplete="username"
              />
            </div>
            {renameError ? <p className="text-sm text-red-400">{renameError}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="border-purple-500/30 text-white" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-r from-indigo-500 to-purple-500"
              onClick={() => void saveRename()}
              disabled={renameSaving || renameInput.trim().length < 3}
            >
              {renameSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}