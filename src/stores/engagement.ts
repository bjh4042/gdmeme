import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useRosterStore } from "./roster";
import { useClassStore } from "./class";

export type ReactionKind = "bravo" | "learned" | "cheer";

export const REACTIONS: { key: ReactionKind; icon: string; label: string; color: string }[] = [
  { key: "bravo", icon: "👍", label: "바른말 최고야", color: "#10b981" },
  { key: "learned", icon: "💡", label: "덕분에 배웠어", color: "#f59e0b" },
  { key: "cheer", icon: "👏", label: "실천을 응원해", color: "#ec4899" },
];

// 뱃지 키는 문자열(신규 12트랙 · 구 키는 하위 호환용으로만 허용)
export type BadgeKey = string;
// 레거시 재수출 — 구 컴포넌트가 참조해도 빈 배열로 안전 분해.
export const BADGES: { key: BadgeKey; icon: string; name: string; desc: string; color: string }[] = [];

export type JournalEntry = { date: string; text: string };

export type StudentEngagement = {
  likesGivenCount: number;
  likesReceivedCount: number;
  journals: JournalEntry[];
  streak: number;
  lastJournalDate?: string;
  unlockedBadges: BadgeKey[];
  roleplayCleared: string[];
};

export const EMPTY_ENGAGEMENT: StudentEngagement = {
  likesGivenCount: 0,
  likesReceivedCount: 0,
  journals: [],
  streak: 0,
  unlockedBadges: [],
  roleplayCleared: [],
};

type ReactArgs = {
  entryId: number;
  reactorId: string;
  reactorClass: string;
  authorId: string;
  authorClass: string;
  authorName: string;
  word: string;
  kind: ReactionKind;
};

type EngagementState = {
  byStudent: Record<string, StudentEngagement>;
  likesByEntry: Record<number, Record<string, ReactionKind[]>>;
  react: (a: ReactArgs) => boolean;
  writeJournal: (
    studentId: string,
    classCode: string,
    text: string,
  ) => { ok: boolean; reason?: "empty" | "already"; streakBonus: boolean; streak: number };
  markLexicographer: (authorId: string) => void;
  reportRoleplayClear: (studentId: string, scenarioId: string, total: number) => boolean;
  syncBadges: (studentId: string, keys: string[]) => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function unlockOnce(cur: BadgeKey[], key: BadgeKey): BadgeKey[] {
  return cur.includes(key) ? cur : [...cur, key];
}
function ratchetKeys(cur: BadgeKey[], keys: string[]): BadgeKey[] {
  let out = cur;
  for (const k of keys) if (!out.includes(k)) out = [...out, k];
  return out;
}

export const useEngagementStore = create<EngagementState>()(
  persist(
    (set, get) => ({
      byStudent: {},
      likesByEntry: {},
      react: ({ entryId, reactorId, reactorClass, authorId, authorClass, authorName, word, kind }) => {
        const st = get();
        const already = st.likesByEntry[entryId]?.[reactorId] ?? [];
        const isToggleOff = already.includes(kind);
        const delta = isToggleOff ? -1 : 1;

        const entryMap = { ...(st.likesByEntry[entryId] ?? {}) };
        const nextList = isToggleOff ? already.filter((k) => k !== kind) : [...already, kind];
        if (nextList.length === 0) delete entryMap[reactorId];
        else entryMap[reactorId] = nextList;

        const reactorCur = st.byStudent[reactorId] ?? EMPTY_ENGAGEMENT;
        // 뱃지는 회수하지 않음 (하위 등급 강제 재잠금 금지)
        const nextGiven = Math.max(0, reactorCur.likesGivenCount + delta);
        const reactionUnlocks: string[] = [];
        if (!isToggleOff) {
          if (reactorCur.likesGivenCount + 1 >= 5) reactionUnlocks.push("reactions_1");
          if (reactorCur.likesGivenCount + 1 >= 20) reactionUnlocks.push("reactions_2");
          if (reactorCur.likesGivenCount + 1 >= 50) reactionUnlocks.push("reactions_3");
        }
        const reactorNext: StudentEngagement = {
          ...reactorCur,
          likesGivenCount: nextGiven,
          unlockedBadges: ratchetKeys(reactorCur.unlockedBadges, reactionUnlocks),
        };
        const byStudent = { ...st.byStudent, [reactorId]: reactorNext };
        if (authorId && authorId !== reactorId) {
          const authorCur = st.byStudent[authorId] ?? EMPTY_ENGAGEMENT;
          byStudent[authorId] = {
            ...authorCur,
            likesReceivedCount: Math.max(0, authorCur.likesReceivedCount + delta),
          };
        } else if (authorId === reactorId) {
          reactorNext.likesReceivedCount = Math.max(0, reactorNext.likesReceivedCount + delta);
        }

        set({
          likesByEntry: { ...st.likesByEntry, [entryId]: entryMap },
          byStudent,
        });

        // XP side-effects — classCode 격리 유지: 각자의 홈 학급에만 가감.
        const roster = useRosterStore.getState();
        const cls = useClassStore.getState();
        const noteSuffix = isToggleOff ? "취소" : "";
        roster.addStudentXP(reactorId, delta);
        if (reactorClass)
          cls.addXP(reactorClass, delta, isToggleOff ? "선플 공감 취소" : "선플 공감", "reaction", `${word} · ${kind}${noteSuffix ? " · " + noteSuffix : ""}`);
        if (authorId && authorId !== reactorId) {
          roster.addStudentXP(authorId, delta);
          if (authorClass)
            cls.addXP(authorClass, delta, isToggleOff ? `공감취소 · ${authorName}` : `공감받음 · ${authorName}`, "reaction", word);
        }
        return true;
      },
      writeJournal: (studentId, classCode, text) => {
        const t = text.trim();
        if (!t) return { ok: false, reason: "empty", streakBonus: false, streak: 0 };
        const st = get();
        const cur = st.byStudent[studentId] ?? EMPTY_ENGAGEMENT;
        const td = today();
        if (cur.lastJournalDate === td)
          return { ok: false, reason: "already", streakBonus: false, streak: cur.streak };
        const yd = yesterday();
        const streak = cur.lastJournalDate === yd ? cur.streak + 1 : 1;
        const journals = [...cur.journals, { date: td, text: t.slice(0, 300) }].slice(-90);
        let unlockedBadges = cur.unlockedBadges;
        const journalUnlocks: string[] = [];
        if (streak >= 3) journalUnlocks.push("journal_1");
        if (streak >= 7) journalUnlocks.push("journal_2");
        if (streak >= 14) journalUnlocks.push("journal_3");
        unlockedBadges = ratchetKeys(unlockedBadges, journalUnlocks);
        const next: StudentEngagement = {
          ...cur,
          journals,
          streak,
          lastJournalDate: td,
          unlockedBadges,
        };
        set({ byStudent: { ...st.byStudent, [studentId]: next } });

        const roster = useRosterStore.getState();
        const cls = useClassStore.getState();
        roster.addStudentXP(studentId, 2);
        if (classCode) cls.addXP(classCode, 2, "성찰 저널", "journal");
        const streakBonus = streak > 0 && streak % 3 === 0;
        if (streakBonus) {
          roster.addStudentXP(studentId, 10);
          if (classCode) cls.addXP(classCode, 10, "저널 3일 연속!", "journal-streak");
        }
        return { ok: true, streakBonus, streak };
      },
      markLexicographer: (authorId) => {
        if (!authorId) return;
        set((s) => {
          const cur = s.byStudent[authorId] ?? EMPTY_ENGAGEMENT;
          if (cur.unlockedBadges.includes("dictionary_1")) return s;
          return {
            byStudent: {
              ...s.byStudent,
              [authorId]: { ...cur, unlockedBadges: unlockOnce(cur.unlockedBadges, "dictionary_1") },
            },
          };
        });
      },
      reportRoleplayClear: (studentId, scenarioId, total) => {
        if (!studentId || !scenarioId) return false;
        let newlyMaster = false;
        set((s) => {
          const cur = s.byStudent[studentId] ?? EMPTY_ENGAGEMENT;
          if (cur.roleplayCleared.includes(scenarioId)) return s;
          const cleared = [...cur.roleplayCleared, scenarioId];
          const unlocked = cur.unlockedBadges;
          if (cleared.length >= total) newlyMaster = true;
          return {
            byStudent: {
              ...s.byStudent,
              [studentId]: { ...cur, roleplayCleared: cleared, unlockedBadges: unlocked },
            },
          };
        });
        return newlyMaster;
      },
      syncBadges: (studentId, keys) => {
        if (!studentId || !keys?.length) return;
        set((s) => {
          const cur = s.byStudent[studentId] ?? EMPTY_ENGAGEMENT;
          const merged = ratchetKeys(cur.unlockedBadges, keys);
          if (merged.length === cur.unlockedBadges.length) return s;
          return { byStudent: { ...s.byStudent, [studentId]: { ...cur, unlockedBadges: merged } } };
        });
      },
    }),
    {
      name: "wtmeme:store:engagement:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ byStudent: s.byStudent, likesByEntry: s.likesByEntry }),
    },
  ),
);

export function reactionCountsFor(
  entryId: number,
  byEntry: EngagementState["likesByEntry"],
): Record<ReactionKind, number> {
  const out: Record<ReactionKind, number> = { bravo: 0, learned: 0, cheer: 0 };
  const m = byEntry[entryId];
  if (!m) return out;
  for (const arr of Object.values(m)) for (const k of arr) out[k]++;
  return out;
}

export function myReactionsFor(
  entryId: number,
  studentId: string | undefined,
  byEntry: EngagementState["likesByEntry"],
): ReactionKind[] {
  if (!studentId) return [];
  return byEntry[entryId]?.[studentId] ?? [];
}