import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Eye, EyeOff } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  completeFocusSession,
  getFocusTodayStats,
  type FocusTodayStats,
  PROFILE_UPDATED_EVENT,
  RANK_UPDATED_EVENT,
} from "../utils/api";

function formatFocusDurationHours(hours: number): { value: string; unit: string } {
  if (!Number.isFinite(hours) || hours <= 0) return { value: "0", unit: "h" };
  const totalMinutes = hours * 60;
  if (totalMinutes < 60) {
    const m = Math.max(0, Math.round(totalMinutes));
    return { value: String(m), unit: "m" };
  }
  const rounded = Math.round(hours * 10) / 10;
  const str = Number.isInteger(rounded)
    ? String(Math.round(rounded))
    : rounded.toFixed(1).replace(/\.0$/, "");
  return { value: str, unit: "h" };
}

function FocusStatCard({
  value,
  unit,
  label,
}: {
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <Card className="bg-[#111827] border-purple-500/20 p-4 text-center">
      <p className="text-2xl font-bold text-white mb-1 tabular-nums flex items-baseline justify-center gap-1 flex-wrap">
        <span>{value}</span>
        <span className="text-lg font-semibold text-gray-400">{unit}</span>
      </p>
      <p className="text-xs text-gray-400">{label}</p>
    </Card>
  );
}

// XP calculation function
const calculateXP = (minutes: number): number => {
  // Base XP for 10 minutes is 90
  const baseXP = 90;
  const xpPerMinute = baseXP / 10; // 9 XP per minute
  
  let totalXP = minutes * xpPerMinute;
  
  // If time is above 30 minutes, add 3% bonus
  if (minutes > 30) {
    totalXP = totalXP * 1.03;
  }
  
  return Math.round(totalXP);
};

const sessionTypes = {
  "5min": { duration: 5, name: "Quick Break (5m)", xp: calculateXP(5), color: "from-cyan-500 to-blue-500" },
  "10min": { duration: 10, name: "Mini Session (10m)", xp: calculateXP(10), color: "from-blue-500 to-indigo-500" },
  "15min": { duration: 15, name: "Short Break (15m)", xp: calculateXP(15), color: "from-green-500 to-emerald-500" },
  "20min": { duration: 20, name: "Focus Sprint (20m)", xp: calculateXP(20), color: "from-teal-500 to-cyan-500" },
  "25min": { duration: 25, name: "Pomodoro (25m)", xp: calculateXP(25), color: "from-red-500 to-orange-500" },
  "30min": { duration: 30, name: "Half Hour (30m)", xp: calculateXP(30), color: "from-orange-500 to-amber-500" },
  "45min": { duration: 45, name: "Deep Work (45m)", xp: calculateXP(45), color: "from-purple-500 to-pink-500" },
  "60min": { duration: 60, name: "Power Hour (60m)", xp: calculateXP(60), color: "from-indigo-500 to-purple-500" },
  "90min": { duration: 90, name: "Deep Work (90m)", xp: calculateXP(90), color: "from-purple-500 to-fuchsia-500" },
  "120min": { duration: 120, name: "Ultra Focus (120m)", xp: calculateXP(120), color: "from-pink-500 to-rose-500" },
};

export default function FocusMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightFocus = searchParams.get("highlight");

  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [selectedSession, setSelectedSession] = useState("25min");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ambientMode, setAmbientMode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [justLeveled, setJustLeveled] = useState(false);
  const [todayStats, setTodayStats] = useState<FocusTodayStats | null>(null);

  const loadTodayStats = useCallback(async () => {
    try {
      const s = await getFocusTodayStats();
      setTodayStats(s);
    } catch {
      setTodayStats(null);
    }
  }, []);

  const handleCompleteSession = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const session = sessionTypes[selectedSession as keyof typeof sessionTypes] || sessionTypes["25min"];
    try {
      const xp = session.xp;
      const resp = await completeFocusSession(xp);
      if (resp?.leveledUp) {
        setJustLeveled(true);
        setTimeout(() => setJustLeveled(false), 1800);
      }
      window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
      await loadTodayStats();
      setTimeLeft(session.duration * 60);
      setIsActive(false);
    } catch {
      setTimeLeft((t) => (t === 0 ? session.duration * 60 : t));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, selectedSession, loadTodayStats]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      void handleCompleteSession();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, handleCompleteSession]);

  useEffect(() => {
    void loadTodayStats();
  }, [loadTodayStats]);

  useEffect(() => {
    if (highlightFocus !== "1") return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById("focus-mode-timer-card")?.scrollIntoView({
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
  }, [highlightFocus, setSearchParams]);

  const handleSessionChange = (value: string) => {
    setSelectedSession(value);
    const session = sessionTypes[value as keyof typeof sessionTypes];
    setTimeLeft(session.duration * 60);
    setIsActive(false);
  };

  const handleReset = () => {
    const session = sessionTypes[selectedSession as keyof typeof sessionTypes];
    setTimeLeft(session.duration * 60);
    setIsActive(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentSession = sessionTypes[selectedSession as keyof typeof sessionTypes] || sessionTypes["25min"];
  const totalSeconds = currentSession.duration * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const sessionsToday = todayStats?.sessionsToday ?? 0;
  const focusDurationFmt = formatFocusDurationHours(todayStats?.focusHoursToday ?? 0);
  const focusXpToday = todayStats?.focusXpToday ?? 0;

  return (
    <div className="min-h-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Ambient mode overlay */}
      {ambientMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-xl z-10"
        />
      )}

      <div className="relative z-20 w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Focus Mode</h1>
            <p className="text-gray-400">Stay focused and earn XP</p>
          </div>

          {/* Main Timer Card */}
          <Card
            id="focus-mode-timer-card"
            className={`bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 shadow-2xl shadow-purple-500/20 overflow-hidden relative ${
              highlightFocus === "1"
                ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0B0F1A] shadow-lg shadow-amber-500/30"
                : ""
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

            <div className="relative z-10 p-8 lg:p-12 space-y-8">
              {/* Session Type Selector */}
              <div className="flex justify-center">
                <Select value={selectedSession} onValueChange={handleSessionChange}>
                  <SelectTrigger className="w-72 bg-[#0B0F1A] border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-purple-500/30 text-white max-h-80">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                      Short Sessions
                    </div>
                    {["5min", "10min", "15min", "20min"].map((key) => {
                      const session = sessionTypes[key as keyof typeof sessionTypes];
                      return (
                        <SelectItem key={key} value={key}>
                          {session.name} - {session.xp} XP
                        </SelectItem>
                      );
                    })}
                    
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase mt-2">
                      Medium Sessions
                    </div>
                    {["25min", "30min", "45min"].map((key) => {
                      const session = sessionTypes[key as keyof typeof sessionTypes];
                      return (
                        <SelectItem key={key} value={key}>
                          {session.name} - {session.xp} XP
                        </SelectItem>
                      );
                    })}
                    
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase mt-2">
                      Long Sessions (+3% Bonus)
                    </div>
                    {["60min", "90min", "120min"].map((key) => {
                      const session = sessionTypes[key as keyof typeof sessionTypes];
                      return (
                        <SelectItem key={key} value={key}>
                          {session.name} - {session.xp} XP
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Timer Display */}
              <div className="relative">
                <svg className="w-full max-w-md mx-auto" viewBox="0 0 200 200">
                  {/* Background circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.1)"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 90}`}
                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                    transform="rotate(-90 100 100)"
                    initial={{ strokeDashoffset: 2 * Math.PI * 90 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 90 * (1 - progress / 100) }}
                    transition={{ duration: 0.5 }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Timer text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <motion.div
                      key={timeLeft}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className="text-6xl lg:text-7xl font-bold text-white mb-2"
                    >
                      {formatTime(timeLeft)}
                    </motion.div>
                    <p className="text-gray-400 text-sm">{currentSession.name}</p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-full w-14 h-14 border-purple-500/30 text-white hover:bg-white/5"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>

                <Button
                  size="lg"
                  onClick={() => setIsActive(!isActive)}
                  className={`rounded-full w-20 h-20 bg-gradient-to-r ${currentSession.color} hover:opacity-80 shadow-2xl text-white border-0`}
                >
                  {isActive ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8 ml-1" />
                  )}
                </Button>

                <Button
                  size="lg"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  variant="outline"
                  className="rounded-full w-14 h-14 border-purple-500/30 text-white hover:bg-white/5"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5" />
                  ) : (
                    <VolumeX className="w-5 h-5" />
                  )}
                </Button>
              </div>

              {/* XP Preview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <p className="text-sm text-gray-400 mb-2">Complete this session to earn</p>
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-purple-500/30">
                  <span className="text-2xl font-bold text-indigo-400">
                    +{currentSession.xp} XP
                  </span>
                </div>
                {currentSession.duration > 30 && (
                  <p className="text-xs text-green-400 mt-2">✨ +3% Bonus for sessions over 30 minutes</p>
                )}
                <div className="mt-4">
                  <Button
                    onClick={handleCompleteSession}
                    disabled={submitting}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-80"
                  >
                    {submitting ? "Recording..." : "Mark Session Complete"}
                  </Button>
                </div>
              </motion.div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={() => setAmbientMode(!ambientMode)}
              variant="outline"
              className="border-purple-500/30 text-white hover:bg-white/5"
            >
              {ambientMode ? (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show UI
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Ambient Mode
                </>
              )}
            </Button>
          </div>

          {/* Stats — units inline with values (live from today&apos;s focus sessions) */}
          <div className="grid grid-cols-3 gap-4">
            <FocusStatCard
              value={String(sessionsToday)}
              unit={sessionsToday === 1 ? "session" : "sessions"}
              label="Sessions Today"
            />
            <FocusStatCard
              value={focusDurationFmt.value}
              unit={focusDurationFmt.unit}
              label="Focus Time"
            />
            <FocusStatCard
              value={focusXpToday.toLocaleString()}
              unit="XP"
              label="XP Earned"
            />
          </div>
        </motion.div>
      </div>
      {justLeveled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/70 z-50"
        >
          <div className="px-8 py-6 rounded-2xl border border-purple-500/40 bg-gradient-to-br from-[#111827] to-[#1F2937] text-center shadow-2xl shadow-purple-500/30">
            <p className="text-purple-400 font-bold text-sm">System Message</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">Level Up!</h3>
            <p className="text-gray-400 mt-1">Your focus has increased your level</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
