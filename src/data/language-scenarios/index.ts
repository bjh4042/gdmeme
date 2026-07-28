/**
 * Language Scenario Pack (Teaching Engine Part 4-6)
 *
 * NOTE: This module is a pure DATA LAYER.
 *   ❌ No planner / strategy / generator logic.
 *   ❌ Does not modify any Teaching Engine module.
 *   ✅ Provides structured Korean elementary-school communication scenarios.
 *
 * To add a new dataset:
 *   1) drop a JSON file under `./datasets/`
 *   2) register it in `loader.ts` (single line append)
 *   3) search utilities in `search.ts` will pick it up automatically.
 */

export type ScenarioLocation =
  | "school"
  | "classroom"
  | "hallway"
  | "playground"
  | "kakaotalk"
  | "game"
  | "youtube"
  | "sns"
  | "home"
  | string;

export type ScenarioDifficulty = "easy" | "medium" | "hard";

/**
 * Canonical schema for every scenario item.
 * All fields are required; use empty string/array when unknown so that
 * downstream code can rely on the shape without null checks.
 */
export type LanguageScenario = {
  id: string;
  title: string;
  context: string;
  location: ScenarioLocation;
  participants: string[];
  typicalExpressions: string[];
  communicationGoal: string;
  possibleMisunderstandings: string[];
  recommendedTeacherFocus: string;
  recommendedQuestions: string[];
  betterExpressionExamples: string[];
  relatedLanguageCategories: string[];
  difficulty: ScenarioDifficulty | string;
  grade: string[];
};

export * from "./loader";
export * from "./search";