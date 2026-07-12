import { create } from "zustand";
import type { Student } from "@/lib/literacy-types";

// 세션은 의도적으로 persist 하지 않는다 — 새로고침/재방문 시 재로그인.
type AuthState = {
  student: Student | null;
  setStudent: (s: Student | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  student: null,
  setStudent: (student) => {
    set({ student });
    if (!student && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("wtmeme:student:v1");
      } catch {}
    }
  },
}));

// 이전 버전 잔재를 청소(모듈 로드 시 1회).
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("wtmeme:student:v1");
  } catch {}
}