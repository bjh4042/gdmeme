import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** 7일 실천 챌린지 저장소 — 학생별 DAY 완료 기록·성찰·교사 피드백. */
export type ChallengeDayRecord = {
  day: number; // 1~7
  completedAt: string; // ISO datetime
  date: string; // ISO date (YYYY-MM-DD)
  reflection: string;
};

export type StudentChallenge = {
  days: ChallengeDayRecord[];
  teacherFeedback?: string;
  teacherFeedbackAt?: string;
};

export const EMPTY_CHALLENGE: StudentChallenge = { days: [] };

type ChallengeState = {
  byStudent: Record<string, StudentChallenge>;
  completeDay: (studentId: string, day: number, reflection: string, date: string) => boolean;
  setTeacherFeedback: (studentId: string, feedback: string) => void;
};

const PERSIST_KEY = "bmsd_challenge7_v1";

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      byStudent: {},
      completeDay: (studentId, day, reflection, date) => {
        if (!studentId || day < 1 || day > 7) return false;
        const cur = get().byStudent[studentId] ?? EMPTY_CHALLENGE;
        if (cur.days.some((d) => d.day === day)) return false; // 완료한 날은 수정 불가
        const next: StudentChallenge = {
          ...cur,
          days: [...cur.days, { day, completedAt: new Date().toISOString(), date, reflection }].sort(
            (a, b) => a.day - b.day,
          ),
        };
        set({ byStudent: { ...get().byStudent, [studentId]: next } });
        return true;
      },
      setTeacherFeedback: (studentId, feedback) => {
        const cur = get().byStudent[studentId] ?? EMPTY_CHALLENGE;
        set({
          byStudent: {
            ...get().byStudent,
            [studentId]: {
              ...cur,
              teacherFeedback: feedback.trim() || undefined,
              teacherFeedbackAt: feedback.trim() ? new Date().toISOString() : undefined,
            },
          },
        });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ byStudent: s.byStudent }),
    },
  ),
);

/** 다음에 수행할 DAY (1~7). 모두 완료했으면 null. */
export function nextDayOf(rec: StudentChallenge): number | null {
  for (let d = 1; d <= 7; d++) if (!rec.days.some((x) => x.day === d)) return d;
  return null;
}

export function progressOf(rec: StudentChallenge): number {
  return Math.round((rec.days.length / 7) * 100);
}