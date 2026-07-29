// 「바른말 수호대」 연구 시연용 데이터 v1.0 — 타입 정의.
// 기존 스토어 스키마는 건드리지 않고, 시연 데이터만 별도 네임스페이스로 보관한다.

import type { DictEntry, StudentRecord } from "@/lib/literacy-types";
import type { StudentEngagement } from "@/stores/engagement";
import type { PracticeState } from "@/lib/practice-storage";
import type { StageKey } from "@/lib/roadmap";

export const DEMO_NAMESPACE = "barunmal_demo_v1";
export const DEMO_VERSION = "1.0.0";
export const DEMO_LABEL = "시연용 예시 데이터";
export const DEMO_CLASS_CODE = "3105";
export const DEMO_STUDENT_COUNT = 17;

export type DemoJudgement = "correct" | "partial" | "incorrect" | "open";
export type DemoStageResult = "advance" | "stay" | "repeat";
export type DemoPersona = "shy" | "confident" | "defensive" | "emotional" | "curious" | "quiet";
export type DemoTrend = "improving" | "stable" | "declining";
export type DemoChallengeStatus =
  | "not_started"
  | "in_progress"
  | "stopped"
  | "recovered"
  | "completed";

/** 학습 단계별 활동 1건. 실제 저장되는 값만 담는다(가짜 집계 금지). */
export type DemoActivityRecord = {
  id: string;
  studentId: string;
  stage: StageKey;
  at: string; // ISO datetime
  durationSec: number;
  /** Language Data Pack 항목 id */
  languageId?: string;
  term?: string;
  category?: string;
  /** Language Scenario Pack 항목 id */
  scenarioId?: string;
  /** 온라인(채팅·댓글·게임) 상황 여부 */
  online: boolean;
  situation: string;
  studentInput: string;
  chosenAnswer?: string;
  judged: DemoJudgement;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  retries: number;
  alternative?: string;
  reflection?: string;
  completed: boolean;
  stageResult: DemoStageResult;
  eklu: {
    intent: string;
    emotion: string;
    intensity: number;
    confidence: number;
    misconception?: string;
    defensiveResponse: boolean;
    clarificationNeeded: boolean;
    repeatedError: boolean;
  };
};

/** 7일 챌린지 참여 기록. */
export type DemoChallengeDay = {
  date: string; // YYYY-MM-DD
  dayIndex: number; // 1..7
  mission: string;
  done: boolean;
  note?: string;
};

export type DemoChallengeRecord = {
  studentId: string;
  startDate: string;
  goal: string;
  promise: string;
  status: DemoChallengeStatus;
  days: DemoChallengeDay[];
  doneCount: number;
  currentStreak: number;
  longestStreak: number;
  completedAt?: string;
};

/** AI 수호비서 대화 1턴 (학생 발화 + 비서 응답). */
export type DemoAssistantTurn = {
  id: string;
  studentId: string;
  at: string;
  languageId?: string;
  scenarioId?: string;
  topic: string;
  studentInput: string;
  intent: string;
  emotion: string;
  misconception?: string;
  clarificationNeeded: boolean;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  strategy: string;
  assistantResponse: string;
  studentFollowUp?: string;
  alternativeAdopted?: string;
  resolved: boolean;
};

export type DemoStudentProfile = {
  studentId: string;
  number: string;
  displayName: string;
  persona: DemoPersona;
  trend: DemoTrend;
  /** 0-100. 활동 기록에서 실제로 산출된 값만 저장. */
  mastery: number;
  participation: "high" | "mid" | "low";
  highestStage: StageKey;
  focusCategories: string[];
  note: string;
};

export type DemoDataset = {
  namespace: string;
  version: string;
  label: string;
  generatedAt: string;
  classCode: string;
  profiles: DemoStudentProfile[];
  students: StudentRecord[];
  engagement: Record<string, StudentEngagement>;
  dict: DictEntry[];
  practice: Record<string, PracticeState>;
  activities: DemoActivityRecord[];
  challenges: DemoChallengeRecord[];
  assistant: DemoAssistantTurn[];
  classXp: number;
};

/** 적용 흔적 — 해제 시 시연 데이터만 정확히 걷어내기 위한 메타. */
export type DemoMeta = {
  namespace: string;
  version: string;
  appliedAt: string;
  classCode: string;
  studentIds: string[];
  dictIds: number[];
  classXp: number;
};