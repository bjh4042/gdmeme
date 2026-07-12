import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Student } from "@/lib/literacy-types";

// 세션을 LocalStorage 에 저장 → 다음 접속 시 입력 없이 자동 복원.
// 유효성이 깨진 잔재(예: 예전 스키마)는 rehydrate 단계에서 폐기.
type AuthState = {
  student: Student | null;
  setStudent: (s: Student | null) => void;
};

function isValidStudent(s: unknown): s is Student {
  if (!s || typeof s !== "object") return false;
  const v = s as Partial<Student>;
  return (
    typeof v.classCode === "string" &&
    /^\d{4}$/.test(v.classCode) &&
    typeof v.number === "string" &&
    /^\d{1,3}$/.test(v.number) &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    v.name.trim().length <= 20
  );
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      student: null,
      setStudent: (student) => set({ student }),
    }),
    {
      name: "wtmeme:store:auth:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ student: s.student }),
      onRehydrateStorage: () => (state) => {
        if (state && !isValidStudent(state.student)) state.student = null;
      },
    },
  ),
);

// 이전(비-persist) 버전 잔재 청소.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("wtmeme:student:v1");
  } catch {}
}