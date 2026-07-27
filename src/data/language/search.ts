import type { LanguageEntry } from "./index";
import { getAllEntries } from "./loader";

function norm(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, "").trim();
}

/** Exact/normalized match on `term`. */
export function findByTerm(term: string): LanguageEntry | null {
  const t = norm(term);
  if (!t) return null;
  for (const e of getAllEntries()) {
    if (norm(e.term) === t) return e;
  }
  return null;
}

/** Match on any alias (or the term itself). */
export function findByAlias(alias: string): LanguageEntry[] {
  const a = norm(alias);
  if (!a) return [];
  const out: LanguageEntry[] = [];
  for (const e of getAllEntries()) {
    if (norm(e.term) === a || e.aliases.some((x) => norm(x) === a)) {
      out.push(e);
    }
  }
  return out;
}

/** Match by `category` (case-insensitive). */
export function findByCategory(category: string): LanguageEntry[] {
  const c = norm(category);
  return getAllEntries().filter((e) => norm(e.category) === c);
}

/** Follow `relatedTerms` links from a given term. */
export function findRelated(term: string): LanguageEntry[] {
  const base = findByTerm(term);
  if (!base) return [];
  const out: LanguageEntry[] = [];
  for (const rel of base.relatedTerms) {
    const hit = findByTerm(rel);
    if (hit) out.push(hit);
  }
  return out;
}

/** Return healthy alternative phrasings for a term. */
export function findAlternatives(term: string): string[] {
  const e = findByTerm(term) ?? findByAlias(term)[0];
  return e ? [...e.betterExpressions] : [];
}

/** Return open-ended reflection questions for a term. */
export function findReflectionQuestions(term: string): string[] {
  const e = findByTerm(term) ?? findByAlias(term)[0];
  return e ? [...e.reflectionQuestions] : [];
}
