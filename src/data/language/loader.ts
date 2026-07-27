import type { LanguageEntry } from "./index";

import slang from "./datasets/slang.json";
import newWords from "./datasets/new-words.json";
import abbreviations from "./datasets/abbreviations.json";
import memes from "./datasets/memes.json";
import gameChat from "./datasets/game-chat.json";
import snsChat from "./datasets/sns-chat.json";
import cyberbullying from "./datasets/cyberbullying.json";
import politeExpressions from "./datasets/polite-expressions.json";
import alternativeExpressions from "./datasets/alternative-expressions.json";
import apologyExpressions from "./datasets/apology-expressions.json";
import empathyExpressions from "./datasets/empathy-expressions.json";
import conflictExpressions from "./datasets/conflict-expressions.json";
import blameShifting from "./datasets/blame-shifting.json";
import sarcasm from "./datasets/sarcasm.json";

export type DatasetName =
  | "slang"
  | "new-words"
  | "abbreviations"
  | "memes"
  | "game-chat"
  | "sns-chat"
  | "cyberbullying"
  | "polite-expressions"
  | "alternative-expressions"
  | "apology-expressions"
  | "empathy-expressions"
  | "conflict-expressions"
  | "blame-shifting"
  | "sarcasm"
  | string;

/**
 * Registered datasets. Add a line here to plug in a new JSON file —
 * search utilities read from this map, no other code changes needed.
 */
export const DATASETS: Record<string, LanguageEntry[]> = {
  "slang": slang as LanguageEntry[],
  "new-words": newWords as LanguageEntry[],
  "abbreviations": abbreviations as LanguageEntry[],
  "memes": memes as LanguageEntry[],
  "game-chat": gameChat as LanguageEntry[],
  "sns-chat": snsChat as LanguageEntry[],
  "cyberbullying": cyberbullying as LanguageEntry[],
  "polite-expressions": politeExpressions as LanguageEntry[],
  "alternative-expressions": alternativeExpressions as LanguageEntry[],
  "apology-expressions": apologyExpressions as LanguageEntry[],
  "empathy-expressions": empathyExpressions as LanguageEntry[],
  "conflict-expressions": conflictExpressions as LanguageEntry[],
  "blame-shifting": blameShifting as LanguageEntry[],
  "sarcasm": sarcasm as LanguageEntry[],
};

let _all: LanguageEntry[] | null = null;

/** Return all entries across every registered dataset (memoized). */
export function getAllEntries(): LanguageEntry[] {
  if (_all) return _all;
  const out: LanguageEntry[] = [];
  for (const arr of Object.values(DATASETS)) out.push(...arr);
  _all = out;
  return out;
}

/** Return entries for a single dataset. */
export function getDataset(name: DatasetName): LanguageEntry[] {
  return DATASETS[name] ?? [];
}

/** List registered dataset names. */
export function listDatasets(): string[] {
  return Object.keys(DATASETS);
}