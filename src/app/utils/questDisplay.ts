function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove redundant "Goal name: …" prefix when the parent goal title is known */
export function stripGoalPrefixFromTitle(title: string, goalTitle: string | undefined): string {
  if (!goalTitle?.trim() || !title?.trim()) return title;
  const t = title.trim();
  const g = goalTitle.trim();
  const re = new RegExp(`^${escapeRegExp(g)}\\s*:\\s*`, "i");
  let out = t.replace(re, "").trim();
  if (out.length < 2) out = t;
  return out;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Removes goal text embedded in quest titles (quoted echoes, "toward …", etc.).
 * The goal is already shown on the card under "Contributing to".
 */
export function stripGoalEchoFromTitle(title: string, goalTitle: string | undefined): string {
  if (!title?.trim()) return title;
  let t = title.trim();
  const g = goalTitle?.trim();
  if (!g || g.length < 6) return t;

  const gn = normalizeSpaces(g);
  const escaped = escapeRegExp(gn);

  t = t.replace(new RegExp(`\\s+toward\\s+['"]${escaped}['"]\\.?`, "gi"), "");
  t = t.replace(new RegExp(`\\s+for\\s+['"]${escaped}['"]`, "gi"), "");
  t = t.replace(new RegExp(`\\s+labeled\\s+for\\s+['"]${escaped}['"]`, "gi"), "");
  t = t.replace(new RegExp(`['"]${escaped}['"]`, "gi"), "");
  if (gn.length >= 10) {
    const lowerT = t.toLowerCase();
    const lowerG = gn.toLowerCase();
    if (lowerT.includes(lowerG)) {
      t = t.replace(new RegExp(escapeRegExp(gn), "gi"), " ");
    } else {
      const head = gn.slice(0, Math.min(48, gn.length));
      if (head.length >= 14 && lowerT.includes(head.toLowerCase())) {
        t = t.replace(new RegExp(escapeRegExp(head), "gi"), " ");
      }
    }
  }

  t = normalizeSpaces(t.replace(/\s+toward\s*$/i, "").replace(/\s+for\s*$/i, ""));
  t = t.replace(/\s+step\s*$/i, "").trim();
  t = t.replace(/^[,.\s]+|[,.]\s*$/g, "").trim();

  return t.length >= 4 ? t : title.trim();
}

/** Card + dialog: short quest line without repeating the parent goal. */
export function formatQuestTitleForDisplay(title: string, goalTitle: string | undefined): string {
  return stripGoalEchoFromTitle(stripGoalPrefixFromTitle(title, goalTitle), goalTitle);
}
