import { useState, useRef, type MouseEvent } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Target, Calendar, Flame, TrendingUp, X, Edit2, Trash2 } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Goal, categoryColors, type GoalRarity, type TrainingUserProfile } from "../utils/goalSystem";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  createGoal,
  deleteGoal,
  getGoals,
  getProfile,
  updateGoal,
  RANK_UPDATED_EVENT,
  GoalTopicMismatchError,
  TierRequiredError,
} from "../utils/api";
import { toast } from "sonner";
import { useEffectiveTier } from "../context/EffectiveTierContext";
import { tierMeetsMinimum, TIER_FOR } from "../utils/tierFeatures";
import { ONBOARDING_GOAL_CREATED } from "../tutorial/tutorialEvents";
import { useEffect } from "react";

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

function mapServerGoals(raw: any[]): Goal[] {
  return (raw || []).map((g: any) => {
    const deadlineRaw = g.deadline;
    let deadline: string | undefined;
    if (deadlineRaw) {
      const d = new Date(deadlineRaw);
      deadline = Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }
    return {
      id: normalizeGoalId(g._id ?? g.id),
      title: g.title,
      category: "Fitness" as Goal["category"],
      rarity: normalizeRarity(g.rarity),
      description: typeof g.description === "string" ? g.description : "",
      deadline,
      userProfile:
        g.userProfile && typeof g.userProfile === "object"
          ? {
              level:
                g.userProfile.level === "intermediate" || g.userProfile.level === "advanced"
                  ? g.userProfile.level
                  : "beginner",
              availableDaysPerWeek:
                typeof g.userProfile.availableDaysPerWeek === "number"
                  ? g.userProfile.availableDaysPerWeek
                  : 3,
              sessionDurationMinutes:
                typeof g.userProfile.sessionDurationMinutes === "number"
                  ? g.userProfile.sessionDurationMinutes
                  : 45,
              equipment: typeof g.userProfile.equipment === "string" ? g.userProfile.equipment : "",
              constraints: typeof g.userProfile.constraints === "string" ? g.userProfile.constraints : "",
            }
          : undefined,
      progress: 0,
      createdAt: g.createdAt,
      color: categoryColors.Fitness,
    };
  });
}

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export default function Goals() {
  const navigate = useNavigate();
  const { effectiveTier, billingResolved } = useEffectiveTier();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [overviewStats, setOverviewStats] = useState<{ questsCompleted: number; streak: number }>({
    questsCompleted: 0,
    streak: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [gRes, pRes] = await Promise.all([getGoals(), getProfile()]);
        if (cancelled) return;
        setGoals(mapServerGoals(gRes.goals));
        setOverviewStats({
          questsCompleted: pRes.quickStats?.questsCompleted ?? 0,
          streak: pRes.user?.streak ?? 0,
        });
      } catch {
        if (!cancelled) {
          setGoals([]);
          setOverviewStats({ questsCompleted: 0, streak: 0 });
        }
      }
    }
    void load();
    const onRank = () => {
      void load();
    };
    window.addEventListener(RANK_UPDATED_EVENT, onRank);
    return () => {
      cancelled = true;
      window.removeEventListener(RANK_UPDATED_EVENT, onRank);
    };
  }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalPendingDelete, setGoalPendingDelete] = useState<Goal | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const pendingDeleteIdRef = useRef<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalTopicError, setGoalTopicError] = useState<{ message: string; suggestions: string[] } | null>(null);
  const defaultUserProfile: TrainingUserProfile = {
    level: "beginner",
    availableDaysPerWeek: 3,
    sessionDurationMinutes: 45,
    equipment: "",
    constraints: "",
  };
  const [formData, setFormData] = useState({
    title: "",
    category: "Fitness" as Goal["category"],
    rarity: "common" as GoalRarity,
    description: "",
    deadline: "",
    userProfile: defaultUserProfile,
  });

  const handleAddGoal = () => {
    setGoalTopicError(null);
    if (
      billingResolved &&
      goals.length >= 1 &&
      !tierMeetsMinimum(effectiveTier, TIER_FOR.secondActiveGoal)
    ) {
      toast.message("Starter and above unlock multiple active training programs.", { duration: 5000 });
      navigate("/pricing?need=starter");
      return;
    }
    setEditingGoal(null);
    setFormData({
      title: "",
      category: "Fitness",
      rarity: "common",
      description: "",
      deadline: "",
      userProfile: defaultUserProfile,
    });
    setDialogOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setGoalTopicError(null);
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      category: goal.category,
      rarity: goal.rarity,
      description: goal.description,
      deadline: goal.deadline || "",
      userProfile: goal.userProfile ?? defaultUserProfile,
    });
    setDialogOpen(true);
  };

  const handleSaveGoal = async () => {
    if (!formData.title) return;

    if (editingGoal) {
      const id = normalizeGoalId(editingGoal.id);
      if (MONGO_OBJECT_ID_RE.test(id)) {
        setGoalTopicError(null);
        try {
          await updateGoal(id, {
            title: formData.title.trim(),
            description: formData.description.trim(),
            deadline: formData.deadline.trim() || undefined,
            rarity: formData.rarity,
            userProfile: formData.userProfile,
          });
          const res = await getGoals();
          setGoals(mapServerGoals(res.goals));
          window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
        } catch (e) {
          if (e instanceof GoalTopicMismatchError) {
            setGoalTopicError({ message: e.message, suggestions: e.suggestions });
            return;
          }
          if (e instanceof TierRequiredError) {
            toast.error(e.message);
            navigate(`/pricing?need=${encodeURIComponent(e.needsTier || "starter")}`);
            return;
          }
          setGoals(
            goals.map((g) =>
              g.id === editingGoal.id
                ? {
                    ...g,
                    ...formData,
                    color: categoryColors[formData.category],
                  }
                : g
            )
          );
        }
      } else {
        setGoals(
          goals.map((g) =>
            g.id === editingGoal.id
              ? {
                  ...g,
                  ...formData,
                  color: categoryColors[formData.category],
                }
              : g
          )
        );
      }
    } else {
      // Create new goal
      setGoalTopicError(null);
      try {
        await createGoal({
          title: formData.title,
          category: formData.category,
          rarity: formData.rarity,
          description: formData.description.trim() || undefined,
          deadline: formData.deadline.trim() || undefined,
          userProfile: formData.userProfile,
        });
        const res = await getGoals();
        setGoals(mapServerGoals(res.goals));
        window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
        window.dispatchEvent(new CustomEvent(ONBOARDING_GOAL_CREATED));
        setDialogOpen(false);
        setFormData({
          title: "",
          category: "Fitness",
          rarity: "common",
          description: "",
          deadline: "",
          userProfile: defaultUserProfile,
        });
        return;
      } catch (e) {
        if (e instanceof GoalTopicMismatchError) {
          setGoalTopicError({ message: e.message, suggestions: e.suggestions });
          return;
        }
        if (e instanceof TierRequiredError) {
          toast.error(e.message);
          navigate(`/pricing?need=${encodeURIComponent(e.needsTier || "starter")}`);
          return;
        }
        // fallback to local add if backend unavailable
        const newGoal: Goal = {
          id: Date.now().toString(),
          ...formData,
          progress: 0,
          createdAt: new Date().toISOString(),
          color: categoryColors[formData.category],
        };
        setGoals([...goals, newGoal]);
        window.dispatchEvent(new CustomEvent(ONBOARDING_GOAL_CREATED));
      }
    }

    setDialogOpen(false);
    setFormData({
      title: "",
      category: "Fitness",
      rarity: "common",
      description: "",
      deadline: "",
      userProfile: defaultUserProfile,
    });
  };

  const performGoalDeletion = async (goalId: string): Promise<boolean> => {
    const id = normalizeGoalId(goalId);
    if (!id) return false;
    if (!MONGO_OBJECT_ID_RE.test(id)) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      return true;
    }
    try {
      await deleteGoal(id);
      const res = await getGoals();
      setGoals(mapServerGoals(res.goals));
      return true;
    } catch {
      return false;
    }
  };

  const handleConfirmDeleteGoal = async (e: MouseEvent<HTMLButtonElement>) => {
    const id = pendingDeleteIdRef.current;
    e.preventDefault();
    if (!id) return;
    setDeleteInProgress(true);
    try {
      const ok = await performGoalDeletion(id);
      if (ok) {
        pendingDeleteIdRef.current = null;
        setGoalPendingDelete(null);
      }
    } finally {
      setDeleteInProgress(false);
    }
  };

  const getDaysUntilDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const multiProgramLocked =
    billingResolved &&
    goals.length >= 1 &&
    !tierMeetsMinimum(effectiveTier, TIER_FOR.secondActiveGoal);

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6" data-tutorial="training-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Training</h1>
          <p className="text-gray-400">
            Build training programs and get daily, weekly, and monthly fitness quests from the program engine
          </p>
        </div>
        <Button
          data-tutorial="add-goal"
          disabled={multiProgramLocked}
          title={multiProgramLocked ? "Upgrade to Starter for a second active program" : undefined}
          onClick={handleAddGoal}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-80"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add program
        </Button>
      </motion.div>

      {multiProgramLocked ? (
        <Card className="bg-amber-500/10 border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-100">
            Your Free plan keeps one active program. Starter unlocks multiple active programs plus deeper quest tools shown on
            Quests.
          </p>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-amber-400/60 text-amber-100 hover:bg-amber-500/15"
            onClick={() => navigate("/pricing?need=starter")}
          >
            View Starter
          </Button>
        </Card>
      ) : null}

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#111827] border-purple-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{goals.length}</p>
                <p className="text-xs text-gray-400">Active programs</p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#111827] border-purple-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {goals.length ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length) : 0}%
                </p>
                <p className="text-xs text-gray-400">Avg Progress</p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#111827] border-purple-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{overviewStats.streak}</p>
                <p className="text-xs text-gray-400">Day Streak</p>
              </div>
            </div>
          </Card>

          <Card className="bg-[#111827] border-purple-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{overviewStats.questsCompleted}</p>
                <p className="text-xs text-gray-400">Quests Done</p>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-[#111827] border-purple-500/20 p-12 text-center">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No programs yet</h3>
            <p className="text-gray-400 mb-6">
              Add a program (strength, conditioning, fat loss, race prep) and the app will seed progressive fitness quests
            </p>
            <Button
              data-tutorial="add-goal"
              onClick={handleAddGoal}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-80"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add your first program
            </Button>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map((goal, index) => {
            const daysLeft = getDaysUntilDeadline(goal.deadline);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 shadow-xl shadow-purple-500/10 overflow-hidden relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${goal.color.from}/10 ${goal.color.to}/10`} />

                  <div className="relative z-10 p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${goal.color.from} ${goal.color.to} flex items-center justify-center shadow-lg ${goal.color.glow} flex-shrink-0`}>
                          <Target className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-white mb-1">{goal.title}</h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={`bg-gradient-to-r ${goal.color.from} ${goal.color.to} text-white border-0`}>
                              {goal.category}
                            </Badge>
                            <Badge variant="outline" className="border-white/20 text-gray-300 capitalize">
                              {goal.rarity}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditGoal(goal)}
                          className="w-8 h-8 text-gray-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            pendingDeleteIdRef.current = normalizeGoalId(goal.id);
                            setGoalPendingDelete(goal);
                          }}
                          className="w-8 h-8 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-400 leading-relaxed">{goal.description}</p>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Program progress</span>
                        <span className="text-white font-medium">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-purple-500/20">
                      {daysLeft !== null ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className={daysLeft < 30 ? "text-orange-400" : "text-gray-400"}>
                            {daysLeft > 0 ? `${daysLeft} days left` : "Deadline passed"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>No deadline</span>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        asChild
                      >
                        <Link to={`/quests?goalId=${goal.id}`}>View quests</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={goalPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGoalPendingDelete(null);
            pendingDeleteIdRef.current = null;
          }
        }}
      >
        <AlertDialogContent className="bg-[#111827] border-purple-500/30 text-white sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this training program?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {goalPendingDelete ? (
                <>
                  <span className="font-medium text-gray-300">"{goalPendingDelete.title}"</span> will be removed from your active programs. You can cancel if you clicked by mistake.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              type="button"
              disabled={deleteInProgress}
              className="border-purple-500/30 bg-transparent text-white hover:bg-white/5 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={deleteInProgress}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 border-0 sm:mt-0"
              onClick={handleConfirmDeleteGoal}
            >
              {deleteInProgress ? "Deleting…" : "Delete program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit training program dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setGoalTopicError(null);
        }}
      >
        <DialogContent
          className="bg-[#111827] border-purple-500/30 text-white max-w-md"
          data-tutorial="program-create-dialog"
        >
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit program" : "New program"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Every program is fitness-only: daily missions, weekly checkpoints, monthly milestones, plus recovery quests
              if you fall behind
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {goalTopicError ? (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm space-y-2"
                role="alert"
              >
                <p className="text-amber-100 font-medium leading-relaxed">{goalTopicError.message}</p>
                <p className="text-xs text-gray-400">This app is built for training and exercise goals. Try one of these instead:</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-300 text-sm pl-0.5">
                  {goalTopicError.suggestions.map((s) => (
                    <li key={s} className="leading-snug">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="title">Program title</Label>
              <Input
                id="title"
                placeholder="e.g., Add 40 lb to squat in 12 weeks"
                value={formData.title}
                onChange={(e) => {
                  setGoalTopicError(null);
                  setFormData({ ...formData, title: e.target.value });
                }}
                className="bg-[#0B0F1A] border-purple-500/30 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                placeholder="Any context that helps: current PRs, schedule constraints, weak points, preferences…"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#0B0F1A] border-purple-500/30 text-white min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                onClick={(e) => {
                  // Ensure clicking anywhere in the field opens the date picker (Chrome/Edge support).
                  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                  el.showPicker?.();
                }}
                onFocus={(e) => {
                  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                  el.showPicker?.();
                }}
                className="bg-[#0B0F1A] border-purple-500/30 text-white"
              />
            </div>

            <div className="pt-2 border-t border-purple-500/15">
              <p className="text-sm font-medium text-white mb-3">User Profile</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={formData.userProfile.level}
                    onValueChange={(v) => {
                      if (v !== "beginner" && v !== "intermediate" && v !== "advanced") return;
                      setFormData({ ...formData, userProfile: { ...formData.userProfile, level: v } });
                    }}
                  >
                    <SelectTrigger className="bg-[#0B0F1A] border-purple-500/30 text-white">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0B0F1A] border-purple-500/30 text-white">
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="daysPerWeek">Available days / week</Label>
                    <Input
                      id="daysPerWeek"
                      type="number"
                      min={1}
                      max={7}
                      value={formData.userProfile.availableDaysPerWeek}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const v = Number.isFinite(n) ? Math.max(1, Math.min(7, Math.round(n))) : 3;
                        setFormData({
                          ...formData,
                          userProfile: { ...formData.userProfile, availableDaysPerWeek: v },
                        });
                      }}
                      className="bg-[#0B0F1A] border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionDuration">Session duration (min)</Label>
                    <Input
                      id="sessionDuration"
                      type="number"
                      min={10}
                      max={240}
                      value={formData.userProfile.sessionDurationMinutes}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const v = Number.isFinite(n) ? Math.max(10, Math.min(240, Math.round(n))) : 45;
                        setFormData({
                          ...formData,
                          userProfile: { ...formData.userProfile, sessionDurationMinutes: v },
                        });
                      }}
                      className="bg-[#0B0F1A] border-purple-500/30 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipment">Equipment</Label>
                  <Input
                    id="equipment"
                    placeholder="e.g., barbell, dumbbells, bench, pull-up bar, treadmill…"
                    value={formData.userProfile.equipment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        userProfile: { ...formData.userProfile, equipment: e.target.value },
                      })
                    }
                    className="bg-[#0B0F1A] border-purple-500/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="constraints">Constraints</Label>
                  <Textarea
                    id="constraints"
                    placeholder="Injuries, limitations, preferences, movements to avoid, schedule constraints…"
                    value={formData.userProfile.constraints}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        userProfile: { ...formData.userProfile, constraints: e.target.value },
                      })
                    }
                    className="bg-[#0B0F1A] border-purple-500/30 text-white min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-purple-500/30 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGoal}
              disabled={!formData.title}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-80"
            >
              {editingGoal ? "Update program" : "Create program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}