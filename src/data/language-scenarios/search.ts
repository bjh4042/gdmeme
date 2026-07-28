import type { LanguageScenario, ScenarioLocation } from "./index";
import { getAllScenarios } from "./loader";

function norm(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, "").trim();
}

/** Match scenarios containing a typical expression (normalized). */
export function findByExpression(expression: string): LanguageScenario[] {
  const q = norm(expression);
  if (!q) return [];
  return getAllScenarios().filter((s) =>
    s.typicalExpressions.some((e) => norm(e).includes(q) || q.includes(norm(e))),
  );
}

/** Match scenarios whose context/title contains the keyword. */
export function findByContext(keyword: string): LanguageScenario[] {
  const q = norm(keyword);
  if (!q) return [];
  return getAllScenarios().filter(
    (s) => norm(s.context).includes(q) || norm(s.title).includes(q),
  );
}

/** Match scenarios by location (case-insensitive). */
export function findByLocation(location: ScenarioLocation): LanguageScenario[] {
  const q = norm(String(location));
  if (!q) return [];
  return getAllScenarios().filter((s) => norm(String(s.location)) === q);
}

/**
 * Return scenarios related to a given scenario id by shared language
 * categories or shared location. The source scenario itself is excluded.
 */
export function findRelatedScenarios(id: string): LanguageScenario[] {
  const all = getAllScenarios();
  const base = all.find((s) => s.id === id);
  if (!base) return [];
  const cats = new Set(base.relatedLanguageCategories.map(norm));
  return all.filter((s) => {
    if (s.id === base.id) return false;
    if (norm(String(s.location)) === norm(String(base.location))) return true;
    return s.relatedLanguageCategories.some((c) => cats.has(norm(c)));
  });
}