import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DictEntry, Evaluation } from "@/lib/literacy-types";
import { computeTotal, gradeOf } from "@/lib/literacy-types";
import { SEED_DICT } from "@/lib/literacy-seed";

const PERSIST_KEY = "wtmeme:store:dict:v1";
const LEGACY_KEY = "wtmeme:dict:v5";

// 최초 진입 시 레거시 raw 배열을 zustand persist 포맷으로 승계.
if (typeof window !== "undefined") {
  try {
    if (!window.localStorage.getItem(PERSIST_KEY)) {
      const raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as DictEntry[];
        const migrated = Array.isArray(arr)
          ? arr.map((d) => (d?.source && d.source.trim() ? d : { ...d, source: "출처 미상" }))
          : SEED_DICT;
        window.localStorage.setItem(
          PERSIST_KEY,
          JSON.stringify({ state: { entries: migrated }, version: 0 }),
        );
        window.localStorage.removeItem(LEGACY_KEY);
      }
    }
  } catch {}
}

type DictState = {
  entries: DictEntry[];
  addProposal: (p: {
    word: string;
    student_definition: string;
    alternatives: string[];
    evaluations: Evaluation;
    suggested_by: string;
    source?: string;
    context_note?: string;
    listener_effect?: string;
  }) => void;
  setStatus: (id: number, status: "approved" | "rejected") => void;
  updateEntry: (
    id: number,
    patch: {
      word?: string;
      student_definition?: string;
      evaluations?: Evaluation;
      alternatives?: string[];
      source?: string;
    },
  ) => void;
  resetSeed: () => void;
  persist: (next: DictEntry[]) => void;
};

export const useDictStore = create<DictState>()(
  persist(
    (set) => ({
      entries: SEED_DICT,
      addProposal: (payload) =>
        set((s) => {
          const prev = s.entries;
          const existingIdx = prev.findIndex((d) => d.word.trim() === payload.word.trim());
          if (existingIdx >= 0) {
            const existing = prev[existingIdx];
            const vc = (existing.vote_count ?? 1) + 1;
            const base = existing.sum_eval ?? existing.evaluations;
            const sum: Evaluation = {
              aggression: base.aggression + payload.evaluations.aggression,
              bullying: base.bullying + payload.evaluations.bullying,
              discrimination: base.discrimination + payload.evaluations.discrimination,
              violence: base.violence + payload.evaluations.violence,
              grammar_destruction:
                base.grammar_destruction + payload.evaluations.grammar_destruction,
            };
            const avg: Evaluation = {
              aggression: sum.aggression / vc,
              bullying: sum.bullying / vc,
              discrimination: sum.discrimination / vc,
              violence: sum.violence / vc,
              grammar_destruction: sum.grammar_destruction / vc,
            };
            const total = Math.round(computeTotal(avg));
            const updated: DictEntry = {
              ...existing,
              evaluations: avg,
              total_harmful_score: total,
              grade: gradeOf(total).label,
              alternatives: Array.from(
                new Set([...existing.alternatives, ...payload.alternatives]),
              ).slice(0, 6),
              source: existing.source || payload.source,
              context_note: existing.context_note || payload.context_note,
              listener_effect: existing.listener_effect || payload.listener_effect,
              vote_count: vc,
              sum_eval: sum,
              timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            };
            const next = [...prev];
            next[existingIdx] = updated;
            return { entries: next };
          }
          const total = computeTotal(payload.evaluations);
          const entry: DictEntry = {
            id: Date.now(),
            word: payload.word.trim(),
            student_definition: payload.student_definition,
            suggested_by: payload.suggested_by,
            source: payload.source,
            context_note: payload.context_note?.trim() || undefined,
            listener_effect: payload.listener_effect?.trim() || undefined,
            evaluations: payload.evaluations,
            total_harmful_score: total,
            status: "pending",
            grade: gradeOf(total).label,
            alternatives: payload.alternatives,
            curriculum_code: "4국01-02",
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            vote_count: 1,
            sum_eval: payload.evaluations,
          };
          return { entries: [entry, ...prev] };
        }),
      setStatus: (id, status) =>
        set((s) => ({ entries: s.entries.map((d) => (d.id === id ? { ...d, status } : d)) })),
      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((d) => {
            if (d.id !== id) return d;
            const evaluations = patch.evaluations ?? d.evaluations;
            const total = Math.round(computeTotal(evaluations));
            return {
              ...d,
              ...patch,
              evaluations,
              total_harmful_score: total,
              grade: gradeOf(total).label,
              timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            };
          }),
        })),
      resetSeed: () => set({ entries: SEED_DICT }),
      persist: (next) => set({ entries: next }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);
