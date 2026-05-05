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

function categoryLabel(cat: string): string {
  return cat;
}

export default function Skills() {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [skills, setSkills] = useState<Skill[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await getSkills();
        setSkills(res.all || []);
      } catch {
        setSkills([]);
      }
    })();
  }, []);

  const categoryColors: Record<string, { from: string; to: string; glow: string }> = {
    Fitness: { from: "from-red-500", to: "to-orange-500", glow: "shadow-red-500/50" },
  };

  const rows = useMemo(() => {
    // deterministic order by unlockLevel, chunk into rows of 4
    const sorted = [...skills].sort((a, b) => {
      return (a.unlockLevel || 0) - (b.unlockLevel || 0);
    });
    const chunks: Skill[][] = [];
    for (let i = 0; i < sorted.length; i += 4) {
      chunks.push(sorted.slice(i, i + 4));
    }
    return chunks;
  }, [skills]);

  const handleSkillClick = (skill: Skill) => {
    setSelectedSkill(skill);
    setDialogOpen(true);
  };

  const totalSkills = skills.length;
  const unlockedCount = skills.filter((s) => s.unlocked).length;
  const pct = totalSkills > 0 ? (unlockedCount / totalSkills) * 100 : 0;

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <h1 className="text-3xl font-bold text-white">Skill tree</h1>
        <p className="text-gray-400">Unlock perks across strength, conditioning, and training habits</p>
        <div className="max-w-xl">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-400">Unlocked</span>
            <span className="text-sm font-semibold text-white tabular-nums">
              {unlockedCount}/{totalSkills}
            </span>
          </div>
          <Progress value={pct} className="h-2 mt-2" />
        </div>
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
                const colors = categoryColors[skill.category] || categoryColors.Fitness;

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
                        (categoryColors[selectedSkill.category] || categoryColors.Fitness).from
                      } ${
                        (categoryColors[selectedSkill.category] || categoryColors.Fitness).to
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
                    <p className="text-sm text-gray-400">{categoryLabel(selectedSkill.category)}</p>
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
                      (categoryColors[selectedSkill.category] || categoryColors.Fitness).from
                    } ${(categoryColors[selectedSkill.category] || categoryColors.Fitness).to} hover:opacity-80 text-white opacity-60`}
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
