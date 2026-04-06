import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, Target, Clock, Zap, Calendar, Award } from "lucide-react";
import { Card } from "../components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { getAnalytics } from "../utils/api";

export default function Analytics() {
  const [data, setData] = useState<{ stats: any; xpSeries: any[]; focusSeries: any[] } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await getAnalytics();
        setData(res);
      } catch {
        setData(null);
      }
    })();
  }, []);
  const xpData = data?.xpSeries || [];

  const questData = data?.questWeeklySeries || [];

  const focusData = data?.focusSeries || [];

  const statsData = data?.statsRadar || [];
  const month = data?.monthSummary || { questsCompleted: 0, focusHours: 0, levelsGained: 0, achievementsUnlocked: 0 };

  const stats = [
    {
      label: "Total XP",
      value: data ? data.stats.totalXp.toLocaleString() : "—",
      change: "",
      icon: Zap,
      color: "from-indigo-500 to-purple-600",
    },
    {
      label: "Quests Completed",
      value: data ? data.stats.questsCompleted : "—",
      change: "",
      icon: Target,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Focus Time",
      value: data ? `${data.stats.focusHours}h` : "—",
      change: "",
      icon: Clock,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Current Streak",
      value: data ? `${data.stats.streak} days` : "—",
      change: "",
      icon: Award,
      color: "from-orange-500 to-red-600",
    },
  ];

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400">Track your progress and performance</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-xl hover:shadow-purple-500/20">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded">
                    {stat.change}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* XP Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-[#111827] border-purple-500/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">XP Progress</h2>
                  <p className="text-sm text-gray-400">Last 7 days</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={xpData}>
                  <defs>
                    <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="xp"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="url(#xpGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Quests Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-[#111827] border-purple-500/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Quests Completed</h2>
                  <p className="text-sm text-gray-400">Monthly breakdown</p>
                </div>
                <Target className="w-5 h-5 text-green-400" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={questData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                  <XAxis
                    dataKey="name"
                    stroke="#9CA3AF"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="completed" fill="#10B981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Focus Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-[#111827] border-purple-500/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Focus Time</h2>
                  <p className="text-sm text-gray-400">Daily focus sessions</p>
                </div>
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={focusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                  <XAxis
                    dataKey="day"
                    stroke="#9CA3AF"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ fill: "#8B5CF6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Stats Radar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-[#111827] border-purple-500/20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Stat Distribution</h2>
                  <p className="text-sm text-gray-400">Current attributes</p>
                </div>
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={statsData}>
                  <PolarGrid stroke="rgba(139, 92, 246, 0.2)" />
                  <PolarAngleAxis
                    dataKey="stat"
                    stroke="#9CA3AF"
                    style={{ fontSize: "12px" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    stroke="#9CA3AF"
                    style={{ fontSize: "10px" }}
                  />
                  <Radar
                    name="Stats"
                    dataKey="value"
                    stroke="#6366F1"
                    fill="#6366F1"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/20">
          <div className="p-6">
            <h2 className="text-lg font-bold text-white mb-6">This Month's Achievements</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-purple-500/20 text-center">
                <p className="text-3xl font-bold text-white mb-1">{month.questsCompleted}</p>
                <p className="text-sm text-gray-400">Quests</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-purple-500/20 text-center">
                <p className="text-3xl font-bold text-white mb-1">{month.focusHours}h</p>
                <p className="text-sm text-gray-400">Focus Time</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-purple-500/20 text-center">
                <p className="text-3xl font-bold text-white mb-1">{month.levelsGained}</p>
                <p className="text-sm text-gray-400">Levels Gained</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-purple-500/20 text-center">
                <p className="text-3xl font-bold text-white mb-1">{month.achievementsUnlocked}</p>
                <p className="text-sm text-gray-400">Achievements</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
