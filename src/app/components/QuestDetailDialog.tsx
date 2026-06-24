import { useEffect, useState } from "react";
import {
  CircleCheck,
  Loader2,
  ListChecks,
  ListTodo,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import {
  getQuestDetails,
  patchQuestExerciseCheck,
  type QuestDetailsPayload,
  type QuestExerciseItem,
} from "../utils/api";
import { playSound } from "../audio/sounds";
import { formatQuestTitleForDisplay } from "../utils/questDisplay";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questId: string | null;
};

const STAT_LABEL: Record<string, string> = {
  str: "Strength",
  int: "Intelligence",
  agi: "Agility",
  vit: "Vitality",
};

function difficultyBadgeLabel(raw: string | undefined): string | null {
  const s = String(raw ?? "").toLowerCase();
  if (s === "easy") return "Easy";
  if (s === "hard") return "Hard";
  if (s === "medium") return "Medium";
  return null;
}

export function QuestDetailDialog({ open, onOpenChange, questId }: Props) {
  const [data, setData] = useState<QuestDetailsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseRows, setExerciseRows] = useState<QuestExerciseItem[]>([]);
  const [exerciseSavingKey, setExerciseSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !questId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void getQuestDetails(questId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          playSound("notification", 0.55);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load mission briefing. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, questId]);

  useEffect(() => {
    if (data?.exercises && Array.isArray(data.exercises)) {
      setExerciseRows(data.exercises);
    } else {
      setExerciseRows([]);
    }
  }, [data]);

  const d = data?.details;
  const q = data?.quest;
  const g = data?.goal;
  const headerTitle = loading
    ? "Loading quest…"
    : q
      ? formatQuestTitleForDisplay(q.title, g?.title)
      : "Quest";
  const difficultyLabel = q ? difficultyBadgeLabel(q.difficulty) : null;

  const doneExerciseCount = exerciseRows.filter((r) => r.completed).length;
  const exerciseTotal = exerciseRows.length;

  const handleExerciseToggle = async (key: string, checked: boolean) => {
    if (!questId || !q || q.isCompleted) return;
    setExerciseSavingKey(key);
    try {
      const { exercises } = await patchQuestExerciseCheck(questId, key, checked);
      setExerciseRows(exercises);
      if (checked) playSound("xp_gain", 0.7);
    } catch {
      /* keep prior state */
    } finally {
      setExerciseSavingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111827] border-purple-500/30 text-white max-w-lg max-h-[85vh] min-h-0 flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0 min-h-0">
          <div className="flex items-start gap-2 flex-wrap">
            <DialogTitle className="text-xl text-white pr-8">{headerTitle}</DialogTitle>
            {q && (
              <Badge variant="outline" className="border-purple-500/40 text-purple-300 capitalize">
                {q.type}
              </Badge>
            )}
            {difficultyLabel && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-200 capitalize">
                {difficultyLabel}
              </Badge>
            )}
            {data?.isPenaltyActive && (
              <Badge className="bg-teal-500/25 text-teal-100 border-teal-500/40">Recovery</Badge>
            )}
            {d?.source === "gemini" && !data?.isPenaltyActive && (
              <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-500/40 gap-1">
                <Sparkles className="w-3 h-3" />
                Coach engine
              </Badge>
            )}
          </div>
          <DialogDescription className="text-gray-400 text-left space-y-1">
            {data?.isPenaltyActive && data?.originalTitle ? (
              <span className="block text-teal-200/90 text-sm">
                Recovery quest active. Main mission (locked until complete):{" "}
                <span className="text-gray-200">{data.originalTitle}</span>
              </span>
            ) : null}
            {g ? (
              <span className="flex items-center gap-2 mt-1">
                <Target className="w-4 h-4 shrink-0 text-purple-400" />
                <span>
                  Program: <span className="text-gray-200">{g.title}</span>
                  <span className="text-gray-500"> · {g.category}</span>
                </span>
              </span>
            ) : (
              "Full briefing from the program engine"
            )}
          </DialogDescription>
          {q && (
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-indigo-300">
                <Zap className="w-4 h-4" />+{q.xpReward} XP
              </span>
              <span className="text-gray-500">
                Stat:{" "}
                <span className="text-gray-300">{STAT_LABEL[q.statType] ?? q.statType}</span>
              </span>
              {q.isCompleted && (
                <Badge className="bg-green-500/20 text-green-300 border-green-500/40">Completed</Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="relative flex-1 min-h-0 border-t border-purple-500/15 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          <div className="p-6 pt-4 space-y-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading briefing…</span>
              </div>
            )}
            {error && !loading && (
              <p className="text-red-400 text-sm py-4">{error}</p>
            )}
            {!loading && !error && d && (
              <>
                {exerciseTotal > 0 && (
                  <section className="rounded-xl border border-teal-500/25 bg-teal-950/40 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-teal-300 flex items-center gap-2">
                        <ListTodo className="w-4 h-4 shrink-0" />
                        Exercises & tasks
                      </h4>
                      <span className="text-[11px] tabular-nums text-teal-200/90 font-medium">
                        {doneExerciseCount}/{exerciseTotal} done
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {exerciseRows.map((ex) => {
                        const busy = exerciseSavingKey === ex.key;
                        const locked = !!(q?.isCompleted);
                        const fieldId = `qe-${ex.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                        return (
                          <li
                            key={ex.key}
                            className="flex gap-3 items-start rounded-lg border border-white/10 bg-black/20 p-3 text-left"
                          >
                            <Checkbox
                              id={fieldId}
                              checked={ex.completed}
                              disabled={locked || busy}
                              onCheckedChange={(c) => void handleExerciseToggle(ex.key, c === true)}
                              className="mt-0.5 border-teal-500/40 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-500"
                              aria-label={`Mark ${ex.label} ${ex.completed ? "not done" : "done"}`}
                            />
                            <label
                              htmlFor={fieldId}
                              className={`flex-1 min-w-0 space-y-1 ${locked ? "cursor-default" : "cursor-pointer"}`}
                            >
                              <span className="text-sm font-medium text-gray-100 leading-snug block">{ex.label}</span>
                              {ex.meta ? (
                                <span className="text-xs text-gray-500 leading-relaxed block">{ex.meta}</span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {q?.isCompleted ? (
                      <p className="text-[11px] text-gray-500">Quest completed — checklist is view only.</p>
                    ) : null}
                  </section>
                )}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2">
                    Mission summary
                  </h4>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{d.summary}</p>
                </section>
                {d.howTo && String(d.howTo).trim().length > 20 && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2">
                      How to execute
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{d.howTo}</p>
                  </section>
                )}
                {d.whatYouImprove && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 shrink-0" />
                      XP allocation
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {d.whatYouImprove}
                    </p>
                  </section>
                )}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-2 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 shrink-0" />
                    Execution order
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    {d.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed pl-1">
                        <span className="text-gray-200">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
                {(d.doneWhen || d.requirements) && (
                  <section className="rounded-lg bg-slate-800/80 border border-purple-500/20 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-300 mb-2 flex items-center gap-2">
                      <CircleCheck className="w-4 h-4 shrink-0" />
                      Success criterion
                    </h4>
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {d.doneWhen || d.requirements}
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
