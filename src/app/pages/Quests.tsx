import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Clock, Zap, Target, Calendar, Filter, Signal } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Quest, Goal, categoryColors, type GoalRarity } from "../utils/goalSystem";
import { completeQuest, revertQuest, getQuests, getGoals, RANK_UPDATED_EVENT } from "../utils/api";
import { useSearchParams } from "react-router-dom";
import { QuestDetailDialog } from "../components/QuestDetailDialog";
import { formatQuestTitleForDisplay } from "../utils/questDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function normalizeGoalId(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "$oid" in raw) return String((raw as { $oid: string }).$oid);
  return String(raw);
}

const RARITIES: GoalRarity[] = ["common", "rare", "epic", "legendary", "mythic"];

function normalizeRarity(raw: unknown): GoalRarity {
  const s = String(raw ?? "").toLowerCase();
  return RARITIES.includes(s as GoalRarity) ? (s as GoalRarity) : "common";
}

function mapDifficultyFromApi(raw: string | undefined): Quest["difficulty"] {
  const s = String(raw ?? "medium").toLowerCase();
  if (s === "easy") return "Easy";
  if (s === "hard") return "Hard";
  return "Medium";
}

function mapServerGoals(raw: any[]): Goal[] {
  return (raw || []).map((g: any) => ({
    id: normalizeGoalId(g._id ?? g.id),
    title: g.title,
    category: (g.category || "Personal") as Goal["category"],
    rarity: normalizeRarity(g.rarity),
    description: "",
    progress: 0,
    createdAt: g.createdAt,
    color: categoryColors[(g.category || "Personal") as Goal["category"]],
  }));
}

export default function Quests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const goalIdFilter = searchParams.get("goalId") ?? "";
  const difficultyFilter = searchParams.get("difficulty") ?? "";
  const difficultyFilterIconClass =
    difficultyFilter === "easy"
      ? "text-green-400"
      : difficultyFilter === "medium"
        ? "text-amber-400"
        : difficultyFilter === "hard"
          ? "text-orange-400"
          : "text-amber-400";
  const highlightQuestParam = searchParams.get("highlightQuest");

  const setGoalIdFilter = (goalId: string | null) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (goalId) n.set("goalId", goalId);
        else n.delete("goalId");
        return n;
      },
      { replace: true }
    );
  };

  const setDifficultyFilter = (tier: string | null) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (tier && ["easy", "medium", "hard"].includes(tier)) n.set("difficulty", tier);
        else n.delete("difficulty");
        return n;
      },
      { replace: true }
    );
  };

  const [goals, setGoals] = useState<Goal[]>([]);
  const allQuests: Quest[] = [];
  const [quests, setQuests] = useState<Quest[]>(allQuests);
  const [engagement, setEngagement] = useState<{
    comebackBonusQuestsRemaining: number;
    comebackBoostActive: boolean;
    leaderboardUnderdogActive?: boolean;
    leaderboardUnderdogEndsAt?: string | null;
    easyModeTier?: number;
    easyModeActive?: boolean;
  }>({
    comebackBonusQuestsRemaining: 0,
    comebackBoostActive: false,
    leaderboardUnderdogActive: false,
    leaderboardUnderdogEndsAt: null,
    easyModeTier: 0,
    easyModeActive: false,
  });
  const mountedRef = useRef(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailQuestId, setDetailQuestId] = useState<string | null>(null);
  // Per-card timers will update locally; avoid page-wide rerenders.

  const openQuestDetail = (id: string) => {
    if (!MONGO_OBJECT_ID_RE.test(id)) return;
    setDetailQuestId(id);
    setDetailOpen(true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadGoalsAndQuests = useCallback(async () => {
    const mapRow = (q: any, timeframe: Quest["timeframe"]): Quest => {
      const tagRaw = String(q.questTag || "standard");
      const questTag: Quest["questTag"] =
        tagRaw === "recovery" || tagRaw === "welcome_bonus" || tagRaw === "streak_saver"
          ? (tagRaw as Quest["questTag"])
          : "standard";
      return {
        id: q.id,
        goalId: q.goalId || "",
        title: q.title,
        description: typeof q.executionPreview === "string" ? q.executionPreview.trim() : "",
        xp: q.xp,
        completed: q.isCompleted,
        timeframe,
        difficulty: mapDifficultyFromApi(q.difficulty),
        category: "",
        expiresAt: q.expiresAt ? String(q.expiresAt) : undefined,
        isPenaltyActive: !!q.isPenaltyActive,
        originalTitle: typeof q.originalTitle === "string" ? q.originalTitle : "",
        questTag,
        comebackBoostApplies: !!q.comebackBoostApplies,
        easyModeTier: typeof q.easyModeTier === "number" ? q.easyModeTier : 0,
      };
    };
    try {
      const res = await getGoals();
      if (!mountedRef.current) return;
      setGoals(mapServerGoals(res.goals || []));
      const daily = await getQuests("daily");
      if (!mountedRef.current) return;
      setEngagement({
        comebackBonusQuestsRemaining: Number(daily.engagement?.comebackBonusQuestsRemaining) || 0,
        comebackBoostActive: !!daily.engagement?.comebackBoostActive,
        leaderboardUnderdogActive: !!daily.engagement?.leaderboardUnderdogActive,
        leaderboardUnderdogEndsAt: daily.engagement?.leaderboardUnderdogEndsAt ?? null,
        easyModeTier: Number(daily.engagement?.easyModeTier) || 0,
        easyModeActive: !!daily.engagement?.easyModeActive,
      });
      const [weekly, monthly] = await Promise.all([getQuests("weekly"), getQuests("monthly")]);
      if (!mountedRef.current) return;
      const mapped: Quest[] = [
        ...(daily.quests || []).map((q: any) => mapRow(q, "daily")),
        ...(weekly.quests || []).map((q: any) => mapRow(q, "weekly")),
        ...(monthly.quests || []).map((q: any) => mapRow(q, "monthly")),
      ];
      setQuests(mapped);
    } catch {
      if (!mountedRef.current) return;
      setGoals([]);
      setQuests(allQuests);
      setEngagement({
        comebackBonusQuestsRemaining: 0,
        comebackBoostActive: false,
        leaderboardUnderdogActive: false,
        leaderboardUnderdogEndsAt: null,
        easyModeTier: 0,
        easyModeActive: false,
      });
    }
  }, []);

  useEffect(() => {
    void loadGoalsAndQuests();
    const onRank = () => {
      void loadGoalsAndQuests();
    };
    window.addEventListener(RANK_UPDATED_EVENT, onRank);
    return () => {
      window.removeEventListener(RANK_UPDATED_EVENT, onRank);
    };
  }, [loadGoalsAndQuests]);

  useEffect(() => {
    if (!goalIdFilter) return;
    if (goals.length === 0) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("goalId");
          return n;
        },
        { replace: true }
      );
      return;
    }
    const exists = goals.some((g) => g.id === goalIdFilter);
    if (!exists) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("goalId");
          return n;
        },
        { replace: true }
      );
    }
  }, [goals, goalIdFilter, setSearchParams]);

  useEffect(() => {
    if (!difficultyFilter) return;
    if (!["easy", "medium", "hard"].includes(difficultyFilter)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("difficulty");
          return n;
        },
        { replace: true }
      );
    }
  }, [difficultyFilter, setSearchParams]);

  useEffect(() => {
    if (!highlightQuestParam) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`quest-card-${highlightQuestParam}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    const clearHighlight = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("highlightQuest");
          return n;
        },
        { replace: true }
      );
    }, 6000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearHighlight);
    };
  }, [highlightQuestParam, setSearchParams]);

  const handleCompleteQuest = async (questId: string) => {
    setQuests(quests.map((q) => (q.id === questId ? { ...q, completed: true } : q)));
    if (questId && questId.length >= 12) {
      try {
        await completeQuest(questId);
        window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
        await loadGoalsAndQuests();
      } catch {
        await loadGoalsAndQuests();
      }
    }
  };

  const handleUndoQuest = async (questId: string) => {
    setQuests(quests.map((q) => (q.id === questId ? { ...q, completed: false } : q)));
    if (questId && questId.length >= 12) {
      try {
        await revertQuest(questId);
        window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
        await loadGoalsAndQuests();
      } catch {
        await loadGoalsAndQuests();
      }
    }
  };

  const questsAfterGoal = goalIdFilter ? quests.filter((q) => q.goalId === goalIdFilter) : quests;
  const questsInScope =
    difficultyFilter && ["easy", "medium", "hard"].includes(difficultyFilter)
      ? questsAfterGoal.filter((q) => q.difficulty.toLowerCase() === difficultyFilter)
      : questsAfterGoal;

  const dailyQuests = questsInScope.filter((q) => q.timeframe === "daily");
  const weeklyQuests = questsInScope.filter((q) => q.timeframe === "weekly");
  const monthlyQuests = questsInScope.filter((q) => q.timeframe === "monthly");

  const countAll = questsInScope.length;
  const countDaily = dailyQuests.length;
  const countWeekly = weeklyQuests.length;
  const countMonthly = monthlyQuests.length;

  const dailyCompleted = dailyQuests.filter((q) => q.completed).length;
  const weeklyCompleted = weeklyQuests.filter((q) => q.completed).length;
  const monthlyCompleted = monthlyQuests.filter((q) => q.completed).length;

  const dailyXP = dailyQuests.reduce((acc, q) => acc + (q.completed ? q.xp : 0), 0);
  const weeklyXP = weeklyQuests.reduce((acc, q) => acc + (q.completed ? q.xp : 0), 0);
  const monthlyXP = monthlyQuests.reduce((acc, q) => acc + (q.completed ? q.xp : 0), 0);

  const getTimeframeIcon = (timeframe: Quest["timeframe"]) => {
    switch (timeframe) {
      case "daily":
        return <Clock className="w-4 h-4" />;
      case "weekly":
        return <Calendar className="w-4 h-4" />;
      case "monthly":
        return <Target className="w-4 h-4" />;
    }
  };

  const getTimeframeColor = (timeframe: Quest["timeframe"]) => {
    switch (timeframe) {
      case "daily":
        return "from-blue-500 to-cyan-500";
      case "weekly":
        return "from-purple-500 to-pink-500";
      case "monthly":
        return "from-orange-500 to-red-500";
    }
  };

  const getDifficultyColor = (difficulty: Quest["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Hard":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    }
  };

  const QuestCard = ({
    quest,
    onOpenDetail,
    highlightQuestId,
  }: {
    quest: Quest;
    onOpenDetail: (id: string) => void;
    highlightQuestId: string | null;
  }) => {
    const goal = goals.find((g) => g.id === quest.goalId);
    const displayTitle = formatQuestTitleForDisplay(quest.title, goal?.title);
    const isHighlighted = Boolean(highlightQuestId && quest.id === highlightQuestId);

    return (
      <motion.div
        id={`quest-card-${quest.id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
        className={isHighlighted ? "rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0B0F1A] shadow-lg shadow-amber-500/20" : ""}
      >
        <Card
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenDetail(quest.id);
            }
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            onOpenDetail(quest.id);
          }}
          className={`overflow-hidden border transition-all text-left ${
            MONGO_OBJECT_ID_RE.test(quest.id) ? "cursor-pointer" : "cursor-default"
          } ${
            quest.completed
              ? "bg-green-500/10 border-green-500/30"
              : `${goalIdFilter && quest.goalId === goalIdFilter ? "ring-2 ring-indigo-500/60" : ""} ${
                  quest.questTag === "recovery"
                    ? "ring-2 ring-teal-500/40 border-teal-500/25"
                    : quest.questTag === "welcome_bonus"
                      ? "ring-2 ring-indigo-400/45 border-indigo-500/25"
                      : quest.questTag === "streak_saver"
                        ? "ring-2 ring-emerald-500/40 border-emerald-500/25"
                        : ""
                } bg-[#111827] border-purple-500/20 hover:border-purple-500/40`
          }`}
        >
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={`${getDifficultyColor(quest.difficulty)} text-xs`}
                  >
                    {quest.difficulty}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 text-xs"
                  >
                    <div className="flex items-center gap-1">
                      {getTimeframeIcon(quest.timeframe)}
                      <span className="capitalize">{quest.timeframe}</span>
                    </div>
                  </Badge>
                  {quest.isPenaltyActive && !quest.completed && (
                    <Badge className="bg-rose-500/20 text-rose-200 border-rose-500/40 text-xs">
                      Penalty protocol
                    </Badge>
                  )}
                  {quest.questTag === "recovery" && !quest.completed && (
                    <Badge className="bg-teal-500/20 text-teal-100 border-teal-500/40 text-xs">Recovery quest</Badge>
                  )}
                  {quest.questTag === "welcome_bonus" && !quest.completed && (
                    <Badge className="bg-indigo-500/25 text-indigo-100 border-indigo-400/40 text-xs">Welcome back bonus</Badge>
                  )}
                  {quest.questTag === "streak_saver" && !quest.completed && (
                    <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-500/40 text-xs">Streak saver</Badge>
                  )}
                  {quest.comebackBoostApplies && !quest.completed && (
                    <Badge className="bg-amber-500/20 text-amber-100 border-amber-500/40 text-xs">2× comeback XP</Badge>
                  )}
                </div>
                <h3
                  className={`text-lg font-bold ${
                    quest.completed ? "text-green-400 line-through" : "text-white"
                  }`}
                >
                  {displayTitle}
                </h3>
                <p className="text-sm text-gray-400 mt-1 leading-snug whitespace-pre-wrap line-clamp-6">
                  {quest.description
                    ? quest.description
                    : MONGO_OBJECT_ID_RE.test(quest.id)
                      ? "Click the card for full execution briefing from the System."
                      : "—"}
                </p>
              </div>

              {quest.completed && (
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50 flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
              )}
            </div>

            {/* Goal Link */}
            {goal && (
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${goal.color.from} ${goal.color.to} flex items-center justify-center`}>
                  <Target className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-gray-400">
                  Contributing to: <span className="text-white">{goal.title}</span>
                </span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-purple-500/10">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-indigo-400">+{quest.xp} XP</span>
                  </div>
                  {quest.comebackBoostApplies && !quest.completed && (
                    <span className="text-[11px] text-amber-200/90">Includes comeback multiplier on complete</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
              {!quest.completed && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteQuest(quest.id);
                  }}
                  size="sm"
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-80"
                >
                  Complete
                </Button>
              )}
              {quest.completed && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUndoQuest(quest.id);
                  }}
                  size="sm"
                  variant="outline"
                  className="border-purple-500/30 text-white hover:bg-white/5"
                >
                  Undo
                </Button>
              )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Quests</h1>
        <p className="text-gray-400">Complete quests to gain XP and achieve your goals</p>
      </motion.div>

      {engagement.comebackBoostActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
        >
          <div className="flex items-center gap-2 text-amber-100">
            <Zap className="w-5 h-5 shrink-0 text-amber-300" aria-hidden />
            <span className="font-semibold">Comeback boost</span>
          </div>
          <p className="text-sm text-amber-100/90 flex-1">
            You were away for more than a week. Your next{" "}
            <span className="font-bold text-white tabular-nums">{engagement.comebackBonusQuestsRemaining}</span> quest
            completions earn <span className="font-bold text-white">2×</span> base XP (daily set bonus unchanged).
          </p>
        </motion.div>
      )}

      {engagement.leaderboardUnderdogActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-sky-500/35 bg-gradient-to-r from-sky-500/12 to-blue-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
        >
          <div className="flex items-center gap-2 text-sky-100">
            <Signal className="w-5 h-5 shrink-0 text-sky-300" aria-hidden />
            <span className="font-semibold">Underdog leaderboard boost</span>
          </div>
          <p className="text-sm text-sky-100/90 flex-1">
            Your rank uses a higher effective XP multiplier for about two days after a long break. Open the Leaderboard
            to see your standing.{" "}
            {engagement.leaderboardUnderdogEndsAt ? (
              <span className="text-white/80">
                Ends {new Date(engagement.leaderboardUnderdogEndsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
              </span>
            ) : null}
          </p>
        </motion.div>
      )}

      {engagement.easyModeActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/12 to-fuchsia-500/8 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
        >
          <div className="flex items-center gap-2 text-violet-100">
            <Target className="w-5 h-5 shrink-0 text-violet-300" aria-hidden />
            <span className="font-semibold">Easy mode</span>
          </div>
          <p className="text-sm text-violet-100/90 flex-1">
            After your recovery quest, penalties ease in tiers. Each quest you complete dials difficulty back toward
            normal. Current tier:{" "}
            <span className="font-bold text-white tabular-nums">{engagement.easyModeTier ?? 0}</span> (0 = normal).
          </p>
        </motion.div>
      )}

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Stats */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Daily Quests</h3>
                  <p className="text-2xl font-bold text-white">
                    {dailyCompleted}/{dailyQuests.length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cyan-400">{dailyXP} XP</p>
                <p className="text-xs text-gray-400">Earned</p>
              </div>
            </div>
            <Progress value={dailyQuests.length ? (dailyCompleted / dailyQuests.length) * 100 : 0} className="h-2" />
          </Card>

          {/* Weekly Stats */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Weekly Quests</h3>
                  <p className="text-2xl font-bold text-white">
                    {weeklyCompleted}/{weeklyQuests.length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-pink-400">{weeklyXP} XP</p>
                <p className="text-xs text-gray-400">Earned</p>
              </div>
            </div>
            <Progress value={weeklyQuests.length ? (weeklyCompleted / weeklyQuests.length) * 100 : 0} className="h-2" />
          </Card>

          {/* Monthly Stats */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/50">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Monthly Quests</h3>
                  <p className="text-2xl font-bold text-white">
                    {monthlyCompleted}/{monthlyQuests.length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-orange-400">{monthlyXP} XP</p>
                <p className="text-xs text-gray-400">Earned</p>
              </div>
            </div>
            <Progress value={monthlyQuests.length ? (monthlyCompleted / monthlyQuests.length) * 100 : 0} className="h-2" />
          </Card>
        </div>
      </motion.div>

      {/* Quests Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <TabsList className="bg-[#111827] border border-purple-500/20 p-1 flex flex-wrap gap-1 w-fit max-w-full">
              <TabsTrigger value="all" className="group data-[state=active]:bg-purple-500/20 gap-2">
                <span>All Quests</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-400 group-data-[state=active]:text-white">
                  {countAll}
                </span>
              </TabsTrigger>
              <TabsTrigger value="daily" className="group data-[state=active]:bg-blue-500/20 gap-2">
                <span>Daily</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-400 group-data-[state=active]:text-white">
                  {countDaily}
                </span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="group data-[state=active]:bg-purple-500/20 gap-2">
                <span>Weekly</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-400 group-data-[state=active]:text-white">
                  {countWeekly}
                </span>
              </TabsTrigger>
              <TabsTrigger value="monthly" className="group data-[state=active]:bg-orange-500/20 gap-2">
                <span>Monthly</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-400 group-data-[state=active]:text-white">
                  {countMonthly}
                </span>
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full lg:w-auto min-w-0">
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto min-w-0">
                <Filter className="w-4 h-4 text-purple-400 shrink-0" aria-hidden />
                <Select
                  value={goalIdFilter || "all"}
                  onValueChange={(v) => setGoalIdFilter(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-full sm:w-[min(100%,240px)] bg-[#111827] border-purple-500/30 text-white">
                    <SelectValue placeholder="Filter by goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-purple-500/30 text-white max-h-72">
                    <SelectItem value="all">All goals</SelectItem>
                    {goals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto min-w-0">
                <Signal className={`w-4 h-4 shrink-0 ${difficultyFilterIconClass}`} aria-hidden />
                <Select
                  value={difficultyFilter && ["easy", "medium", "hard"].includes(difficultyFilter) ? difficultyFilter : "all"}
                  onValueChange={(v) => setDifficultyFilter(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-full sm:w-[min(100%,220px)] bg-[#111827] border-purple-500/30 text-white">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-purple-500/30 text-white">
                    <SelectItem value="all">All difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            {questsInScope.length === 0 ? (
              <Card className="bg-[#111827] border-purple-500/20 p-12 text-center">
                <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {quests.length === 0 ? "No Quests Available" : "No matching quests"}
                </h3>
                <p className="text-gray-400">
                  {quests.length === 0
                    ? "Add goals to generate personalized quests"
                    : "Try changing the goal or difficulty filter."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {questsInScope.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    onOpenDetail={openQuestDetail}
                    highlightQuestId={highlightQuestParam}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            {dailyQuests.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No daily quests in this view.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dailyQuests.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    onOpenDetail={openQuestDetail}
                    highlightQuestId={highlightQuestParam}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            {weeklyQuests.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No weekly quests in this view.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {weeklyQuests.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    onOpenDetail={openQuestDetail}
                    highlightQuestId={highlightQuestParam}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            {monthlyQuests.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No monthly quests in this view.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {monthlyQuests.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    onOpenDetail={openQuestDetail}
                    highlightQuestId={highlightQuestParam}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      <QuestDetailDialog
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailQuestId(null);
        }}
        questId={detailQuestId}
      />
    </div>
  );
}
