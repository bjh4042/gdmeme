/**
 * Language Data Pack (Teaching Engine Part 4-5)
 *
 * NOTE: This module is a pure DATA LAYER.
 *   ❌ No planner / strategy / generator logic.
 *   ❌ Does not modify any Teaching Engine module.
 *   ✅ Provides structured Korean-language knowledge for reference.
 *
 * To add a new dataset:
 *   1) drop a JSON file under `./datasets/`
 *   2) register it in `loader.ts` (single line append)
 *   3) search utilities in `search.ts` will pick it up automatically.
 */
export type Appropriateness =
  | "ALWAYS_OK"
  | "USUALLY_OK"
  | "DEPENDS_ON_CONTEXT"
  | "NOT_RECOMMENDED"
  | "NEVER_OK";

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export type LanguageContext =
  | "school"
  | "friend"
  | "game"
  | "discord"
  | "kakaotalk"
  | "sns"
  | "youtube"
  | "community"
  | "family"
  | string;

/**
 * Canonical entry schema for every dataset item.
 * All fields are required; use empty string/array when unknown so that
 * downstream code can rely on the shape without null checks.
 */
export type LanguageEntry = {
  id: string;
  term: string;
  aliases: string[];
  category: string;
  meaning: string;
  contexts: LanguageContext[];
  appropriateness: Appropriateness;
  riskLevel: RiskLevel;
  emotionImpact: string[];
  possibleMisunderstanding: string;
  betterExpressions: string[];
  teacherTip: string;
  reflectionQuestions: string[];
  relatedTerms: string[];
  grade: string[];
  updatedAt: string;
};

export * from "./loader";
export * from "./search";