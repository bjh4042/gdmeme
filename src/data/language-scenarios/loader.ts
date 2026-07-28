import type { LanguageScenario } from "./index";

import school from "./datasets/school.json";
import classroom from "./datasets/classroom.json";
import playground from "./datasets/playground.json";
import kakaotalk from "./datasets/kakaotalk.json";
import gameChat from "./datasets/game-chat.json";
import youtubeComments from "./datasets/youtube-comments.json";
import sns from "./datasets/sns.json";
import friendship from "./datasets/friendship.json";
import conflict from "./datasets/conflict.json";
import apology from "./datasets/apology.json";

export type ScenarioDatasetName =
  | "school"
  | "classroom"
  | "playground"
  | "kakaotalk"
  | "game-chat"
  | "youtube-comments"
  | "sns"
  | "friendship"
  | "conflict"
  | "apology"
  | string;

/**
 * Registered scenario datasets. Add a line here to plug in a new JSON
 * file — search utilities read from this map, no other code changes needed.
 */
export const SCENARIO_DATASETS: Record<string, LanguageScenario[]> = {
  "school": school as LanguageScenario[],
  "classroom": classroom as LanguageScenario[],
  "playground": playground as LanguageScenario[],
  "kakaotalk": kakaotalk as LanguageScenario[],
  "game-chat": gameChat as LanguageScenario[],
  "youtube-comments": youtubeComments as LanguageScenario[],
  "sns": sns as LanguageScenario[],
  "friendship": friendship as LanguageScenario[],
  "conflict": conflict as LanguageScenario[],
  "apology": apology as LanguageScenario[],
};

let _all: LanguageScenario[] | null = null;

/** Return all scenarios across every registered dataset (memoized). */
export function getAllScenarios(): LanguageScenario[] {
  if (_all) return _all;
  const out: LanguageScenario[] = [];
  for (const arr of Object.values(SCENARIO_DATASETS)) out.push(...arr);
  _all = out;
  return out;
}

/** Return scenarios for a single dataset. */
export function getScenarioDataset(name: ScenarioDatasetName): LanguageScenario[] {
  return SCENARIO_DATASETS[name] ?? [];
}

/** List registered scenario dataset names. */
export function listScenarioDatasets(): string[] {
  return Object.keys(SCENARIO_DATASETS);
}