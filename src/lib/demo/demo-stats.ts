// 시연 데이터 집계 — 저장된 레코드에서만 계산한다(가짜 통계 금지).

import type { DemoDataset } from "./demo-types";
import { STAGE_ORDER, STAGE_LABEL } from "./demo-generator";

export type DemoSummary = {
  studentCount: number;
  activityCount: number;
  /** 단계별 활동 수 · 완료 학생 수 */
  stages: { key: string; label: string; activities: number; students: number }[];
  /** 학생 1인당 평균 활동 수 */
  avgActivitiesPerStudent: number;
  onlineRatio: number; // 0-1
  /** 표현 카테고리별 다룬 횟수 상위 */
  topCategories: { category: string; count: number }[];
  /** 자주 관찰된 오개념 */
  topMisconceptions: { text: string; count: number }[];
  challenge: {
    participants: number;
    completed: number;
    stopped: number;
    avgDoneDays: number;
    dayCompletion: number[]; // 1~7일차별 체크 인원
  };
  assistant: {
    turns: number;
    students: number;
    resolved: number;
    avgHintLevel: number;
    adoptedAlternatives: number;
  };
  dict: { total: number; approved: number; pending: number };
  masteryAvg: number;
  trend: { improving: number; stable: number; declining: number };
};

function round(n: number, digits = 1) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function topOf(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function summarizeDemo(data: DemoDataset): DemoSummary {
  const acts = data.activities;

  const stages = STAGE_ORDER.map((key) => {
    const list = acts.filter((a) => a.stage === key);
    return {
      key,
      label: STAGE_LABEL[key],
      activities: list.length,
      students: new Set(list.map((a) => a.studentId)).size,
    };
  });

  const categories = new Map<string, number>();
  const misconceptions = new Map<string, number>();
  for (const a of acts) {
    if (a.category) categories.set(a.category, (categories.get(a.category) ?? 0) + 1);
    if (a.eklu.misconception)
      misconceptions.set(a.eklu.misconception, (misconceptions.get(a.eklu.misconception) ?? 0) + 1);
  }

  const dayCompletion = Array.from({ length: 7 }, (_, i) =>
    data.challenges.reduce((s, c) => s + (c.days[i]?.done ? 1 : 0), 0),
  );
  const participants = data.challenges.filter((c) => c.doneCount > 0).length;

  const asst = data.assistant;

  return {
    studentCount: data.students.length,
    activityCount: acts.length,
    stages,
    avgActivitiesPerStudent: data.students.length
      ? round(acts.length / data.students.length)
      : 0,
    onlineRatio: acts.length ? round(acts.filter((a) => a.online).length / acts.length, 2) : 0,
    topCategories: topOf(categories, 6).map(([category, count]) => ({ category, count })),
    topMisconceptions: topOf(misconceptions, 5).map(([text, count]) => ({ text, count })),
    challenge: {
      participants,
      completed: data.challenges.filter((c) => c.status === "completed").length,
      stopped: data.challenges.filter((c) => c.status === "stopped").length,
      avgDoneDays: data.challenges.length
        ? round(data.challenges.reduce((s, c) => s + c.doneCount, 0) / data.challenges.length)
        : 0,
      dayCompletion,
    },
    assistant: {
      turns: asst.length,
      students: new Set(asst.map((a) => a.studentId)).size,
      resolved: asst.filter((a) => a.resolved).length,
      avgHintLevel: asst.length
        ? round(asst.reduce((s, a) => s + a.hintLevel, 0) / asst.length)
        : 0,
      adoptedAlternatives: asst.filter((a) => a.alternativeAdopted).length,
    },
    dict: {
      total: data.dict.length,
      approved: data.dict.filter((d) => d.status === "approved").length,
      pending: data.dict.filter((d) => d.status === "pending").length,
    },
    masteryAvg: data.profiles.length
      ? Math.round(data.profiles.reduce((s, p) => s + p.mastery, 0) / data.profiles.length)
      : 0,
    trend: {
      improving: data.profiles.filter((p) => p.trend === "improving").length,
      stable: data.profiles.filter((p) => p.trend === "stable").length,
      declining: data.profiles.filter((p) => p.trend === "declining").length,
    },
  };
}