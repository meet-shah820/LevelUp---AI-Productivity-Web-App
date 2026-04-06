import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Lock, Check, Zap } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { getSkills } from "../utils/api";

type Skill = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  category: string;
  unlockLevel?: number;
};

export default function Skills() {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [summary, setSummary] = useState<{ category: string; unlocked: number; total: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await getSkills();
        setSkills(res.all || []);
        setSummary(res.summary || []);
      } catch {
        setSkills([]);
        setSummary([]);
      }
    })();
  }, []);

  const categoryColors: Record<string, { from: string; to: string; glow: string }> = {
    Fitness: { from: "from-red-500", to: "to-orange-500", glow: "shadow-red-500/50" },
    Learning: { from: "from-blue-500", to: "to-cyan-500", glow: "shadow-blue-500/50" },
    Productivity: { from: "from-purple-500", to: "to-pink-500", glow: "shadow-purple-500/50" },
    Business: { from: "from-green-500", to: "to-emerald-500", glow: "shadow-green-500/50" },
  };

  const rows = useMemo(() => {
    // deterministic order by category then unlockLevel, include ALL skills by chunking into rows of 4
    const order = ["Fitness", "Learning", "Productivity", "Business"];
    const pool = selectedCategory ? skills.filter((s) => s.category === selectedCategory) : skills;
    const sorted = [...pool].sort((a, b) => {
      const ca = order.indexOf(a.category);
      const cb = order.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return (a.unlockLevel || 0) - (b.unlockLevel || 0);
    });
    const chunks: Skill[][] = [];
    for (let i = 0; i < sorted.length; i += 4) {
      chunks.push(sorted.slice(i, i + 4));
    }
    return chunks;
  }, [skills, selectedCategory]);

  const handleSkillClick = (skill: Skill) => {
    setSelectedSkill(skill);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Skill Tree</h1>
        <p className="text-gray-400">Unlock and upgrade skills to enhance your abilities</p>
      </motion.div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(categoryColors).map(([category, colors]) => {
            const s = summary.find((x) => x.category === category);
            const unlockedCount = s?.unlocked ?? 0;
            const total = s?.total ?? skills.filter((x) => x.category === category).length;

            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setSelectedCategory((prev) => (prev === category ? null : category))
                }
                className={`text-left rounded-xl transition-colors ${
                  selectedCategory === category
                    ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0B0F1A]"
                    : ""
                }`}
              >
                <Card className="bg-[#111827] border-purple-500/20 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-3 h-3 rounded-full bg-gradient-to-r ${colors.from} ${colors.to}`}
                    />
                    <h3 className="font-medium text-white">{category}</h3>
                    {selectedCategory === category && (
                      <span className="ml-auto text-xs text-indigo-300">Selected</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {unlockedCount}/{total}
                  </p>
                  <p className="text-xs text-gray-400">
                    {selectedCategory === category ? "Click to clear filter" : "Skills Unlocked"}
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
        {/* Clear filter control for small screens */}
        {selectedCategory && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Show all categories
            </button>
          </div>
        )}
      </motion.div>

      {/* Skill Tree Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-[#111827] border-purple-500/20 p-6 lg:p-8">
          <div className="space-y-8">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {row.map((skill, index) => {
                const colors = categoryColors[skill.category];

                return (
                  <motion.button
                    key={skill.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + (rowIndex * 0.2) + index * 0.05, type: "spring" }}
                    onClick={() => handleSkillClick(skill)}
                    className="group relative"
                  >
                    <Card
                      className={`relative overflow-hidden transition-all ${
                        skill.unlocked
                          ? `bg-gradient-to-br ${colors.from} ${colors.to} border-transparent shadow-xl ${colors.glow} group-hover:scale-105`
                          : "bg-[#1F2937] border-purple-500/30 group-hover:border-purple-500/50"
                      }`}
                    >
                      {/* Background glow effect */}
                      {skill.unlocked && (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}

                      <div className="relative z-10 p-6 space-y-3">
                        {/* Icon and Status */}
                        <div className="flex items-start justify-between mb-2">
                          {skill.unlocked ? (
                            <Zap className="w-8 h-8 text-white" />
                          ) : (
                            <Lock className="w-8 h-8 text-gray-500" />
                          )}
                          {skill.unlocked && skill.level === skill.maxLevel && (
                            <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                          )}
                        </div>

                        {/* Level Badge */}
                        {skill.unlocked && (
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-black/30 backdrop-blur-sm">
                            <span className="text-sm font-bold text-white">
                              Lv.{skill.level}
                            </span>
                          </div>
                        )}

                        {/* Name */}
                        <h3
                          className={`text-sm font-bold leading-tight min-h-[2.5rem] ${
                            skill.unlocked ? "text-white" : "text-gray-500"
                          }`}
                        >
                          {skill.name}
                        </h3>

                        {/* Level Progress */}
                        {skill.unlocked && skill.level < skill.maxLevel && (
                          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-white/80 rounded-full`}
                              style={{ width: `${(skill.level / skill.maxLevel) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.button>
                );
              })}
            </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Skill Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111827] border-purple-500/30 text-white max-w-md">
          {selectedSkill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedSkill.unlocked ? (
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                        categoryColors[selectedSkill.category].from
                      } ${
                        categoryColors[selectedSkill.category].to
                      } flex items-center justify-center shadow-lg`}
                    >
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#1F2937] border-2 border-purple-500/30 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{selectedSkill.name}</h3>
                    <p className="text-sm text-gray-400">{selectedSkill.category}</p>
                  </div>
                </DialogTitle>
                <DialogDescription className="text-gray-400 pt-4">
                  {selectedSkill.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Level Progress */}
                {selectedSkill.unlocked && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Level</span>
                      <span className="text-white font-medium">
                        {selectedSkill.level} / {selectedSkill.maxLevel}
                      </span>
                    </div>
                    <Progress
                      value={(selectedSkill.level / selectedSkill.maxLevel) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {!selectedSkill.unlocked && (
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <p className="text-sm text-gray-400 mb-1">Unlocks at level</p>
                    <p className="text-2xl font-bold text-indigo-400">
                      {selectedSkill.unlockLevel}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                {selectedSkill.unlocked && selectedSkill.level < selectedSkill.maxLevel && (
                  <Button
                    disabled
                    className={`w-full bg-gradient-to-r ${
                      categoryColors[selectedSkill.category].from
                    } ${categoryColors[selectedSkill.category].to} hover:opacity-80 text-white opacity-60`}
                  >
                    Progresses automatically with level
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
