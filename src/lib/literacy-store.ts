// ⚠️ 얇은 어댑터 파일입니다.
// 실제 상태는 src/stores/{auth,dict,class,roster}.ts 의 Zustand 스토어가 소유합니다.
// 기존 컴포넌트 API를 깨지 않기 위해 동일한 훅 이름을 유지합니다.

import { useEffect, useMemo, useState } from "react";
import type { ClassState } from "./literacy-types";
import { useAuthStore } from "@/stores/auth";
import { useDictStore } from "@/stores/dict";
import { EMPTY_CLASS, useClassStore } from "@/stores/class";
import { studentId, useRosterStore } from "@/stores/roster";

export { studentId };

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useStudent() {
  const student = useAuthStore((s) => s.student);
  const setStudent = useAuthStore((s) => s.setStudent);
  return { student, setStudent };
}

export function useDictionary() {
  const dict = useDictStore((s) => s.entries);
  const addProposal = useDictStore((s) => s.addProposal);
  const setStatus = useDictStore((s) => s.setStatus);
  const updateEntry = useDictStore((s) => s.updateEntry);
  const resetSeed = useDictStore((s) => s.resetSeed);
  const persist = useDictStore((s) => s.persist);
  return { dict, addProposal, setStatus, updateEntry, resetSeed, persist };
}

export function useClassState(classCode: string | undefined) {
  // selector: 이 학급만 구독 → 다른 학급 XP 변경 시 리렌더 없음.
  const stateForClass = useClassStore((s) => (classCode ? s.byClass[classCode] : undefined));
  const addXPRaw = useClassStore((s) => s.addXP);
  const setXPRaw = useClassStore((s) => s.setXP);
  const state: ClassState = stateForClass ?? EMPTY_CLASS;
  return useMemo(
    () => ({
      state,
      addXP: (delta: number, who: string, kind: string, note?: string) => {
        if (!classCode) return;
        addXPRaw(classCode, delta, who, kind, note);
      },
      setXP: (nextXp: number, who: string, note?: string) => {
        if (!classCode) return;
        setXPRaw(classCode, nextXp, who, note);
      },
    }),
    [state, classCode, addXPRaw, setXPRaw],
  );
}

export function useStudents() {
  const students = useRosterStore((s) => s.students);
  const upsertActive = useRosterStore((s) => s.upsertActive);
  const addStudentXP = useRosterStore((s) => s.addStudentXP);
  const updateStudent = useRosterStore((s) => s.updateStudent);
  const removeStudent = useRosterStore((s) => s.removeStudent);
  const importStudents = useRosterStore((s) => s.importStudents);
  const write = useRosterStore((s) => s.write);
  return { students, upsertActive, addStudentXP, updateStudent, removeStudent, importStudents, write };
}

/**
 * Direct credit to a specific class's XP pool — 컴포넌트 밖에서 액션을 호출할 때 사용.
 * 예: 교사가 다른 학급 학생의 단어를 승인해 그 학생의 홈 학급 XP를 올리는 경우.
 */
export function addClassXPFor(
  classCode: string,
  delta: number,
  who: string,
  kind: string,
  note?: string,
) {
  if (!classCode || !delta) return;
  useClassStore.getState().addXP(classCode, delta, who, kind, note);
}