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

export type BadgeKey = "empathy" | "recorder" | "lexicographer" | "etiquette";

export const BADGES: {
  key: BadgeKey;
  icon: string;
  name: string;
  desc: string;
  color: string;
}[] = [
  { key: "empathy", icon: "🛡️", name: "공감의 기사", desc: "선플 공감 5회 누적", color: "#ec4899" },
  { key: "recorder", icon: "📔", name: "기록의 달인", desc: "성찰 저널 3일 연속", color: "#f59e0b" },
  { key: "lexicographer", icon: "📖", name: "사전 편찬자", desc: "우리말 사전 최초 등재 승인", color: "#10b981" },
  { key: "etiquette", icon: "🎖️", name: "예절 마스터", desc: "역할극 5스테이지 올클리어", color: "#6366f1" },
];

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

export const useEngagementStore = create<EngagementState>()(
  persist(
    (set, get) => ({
      byStudent: {},
      likesByEntry: {},
      react: ({ entryId, reactorId, reactorClass, authorId, authorClass, authorName, word, kind }) => {
        const st = get();
        const already = st.likesByEntry[entryId]?.[reactorId] ?? [];
        if (already.includes(kind)) return false;

        const entryMap = { ...(st.likesByEntry[entryId] ?? {}) };
        entryMap[reactorId] = [...already, kind];

        const reactorCur = st.byStudent[reactorId] ?? EMPTY_ENGAGEMENT;
        const reactorNext: StudentEngagement = {
          ...reactorCur,
          likesGivenCount: reactorCur.likesGivenCount + 1,
          unlockedBadges:
            reactorCur.likesGivenCount + 1 >= 5
              ? unlockOnce(reactorCur.unlockedBadges, "empathy")
              : reactorCur.unlockedBadges,
        };
        const byStudent = { ...st.byStudent, [reactorId]: reactorNext };
        if (authorId && authorId !== reactorId) {
          const authorCur = st.byStudent[authorId] ?? EMPTY_ENGAGEMENT;
          byStudent[authorId] = {
            ...authorCur,
            likesReceivedCount: authorCur.likesReceivedCount + 1,
          };
        } else if (authorId === reactorId) {
          reactorNext.likesReceivedCount = reactorNext.likesReceivedCount + 1;
        }

        set({
          likesByEntry: { ...st.likesByEntry, [entryId]: entryMap },
          byStudent,
        });

        // XP side-effects — classCode 격리 유지: 각자의 홈 학급에만 가산.
        const roster = useRosterStore.getState();
        const cls = useClassStore.getState();
        roster.addStudentXP(reactorId, 1);
        if (reactorClass) cls.addXP(reactorClass, 1, "선플 공감", "reaction", `${word} · ${kind}`);
        if (authorId && authorId !== reactorId) {
          roster.addStudentXP(authorId, 1);
          if (authorClass) cls.addXP(authorClass, 1, `공감받음 · ${authorName}`, "reaction", word);
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
        if (streak >= 3) unlockedBadges = unlockOnce(unlockedBadges, "recorder");
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
          if (cur.unlockedBadges.includes("lexicographer")) return s;
          return {
            byStudent: {
              ...s.byStudent,
              [authorId]: { ...cur, unlockedBadges: unlockOnce(cur.unlockedBadges, "lexicographer") },
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
          let unlocked = cur.unlockedBadges;
          if (cleared.length >= total && !unlocked.includes("etiquette")) {
            unlocked = [...unlocked, "etiquette"];
            newlyMaster = true;
          }
          return {
            byStudent: {
              ...s.byStudent,
              [studentId]: { ...cur, roleplayCleared: cleared, unlockedBadges: unlocked },
            },
          };
        });
        return newlyMaster;
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