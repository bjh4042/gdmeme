// 12대 뱃지 도감 (4트랙 × 3티어).
// 통계 값에서 즉시 파생하되, 상위에서 ratchet(누적 잠금 유지)로 관리.

import dictionary_1 from "@/assets/badges/dictionary_1.png.asset.json";
import dictionary_2 from "@/assets/badges/dictionary_2.png.asset.json";
import dictionary_3 from "@/assets/badges/dictionary_3.png.asset.json";
import xp_1 from "@/assets/badges/xp_1.png.asset.json";
import xp_2 from "@/assets/badges/xp_2.png.asset.json";
import xp_3 from "@/assets/badges/xp_3.png.asset.json";
import reactions_1 from "@/assets/badges/reactions_1.png.asset.json";
import reactions_2 from "@/assets/badges/reactions_2.png.asset.json";
import reactions_3 from "@/assets/badges/reactions_3.png.asset.json";
import journal_1 from "@/assets/badges/journal_1.png.asset.json";
import journal_2 from "@/assets/badges/journal_2.png.asset.json";
import journal_3 from "@/assets/badges/journal_3.png.asset.json";

export type BadgeTrack = "dictionary" | "xp" | "reactions" | "journal";
export type BadgeTier = 1 | 2 | 3;

export type BadgeDef = {
  key: string; // e.g. "dictionary_1"
  track: BadgeTrack;
  tier: BadgeTier;
  name: string;
  icon: string;
  color: string; // accent
  desc: string; // 미션 설명
  metricLabel: string;
  unit: string;
  threshold: number;
  image?: string; // CDN URL for badge illustration (optional; icon emoji is fallback)
};

export type BadgeStats = {
  approvedWords: number;
  totalXP: number;
  votedCount: number;
  journalStreak: number;
};

export const TIER_LABEL: Record<BadgeTier, string> = { 1: "기초", 2: "심화", 3: "마스터" };

export const BADGE_TRACKS: BadgeDef[] = [
  // ── 사전 등재 ──────────────────────────────
  {
    key: "dictionary_1",
    track: "dictionary",
    tier: 1,
    name: "사전 편찬자",
    icon: "📖",
    color: "#10b981",
    desc: "우리말 사전에 단어 1개 이상 정식 등재",
    metricLabel: "승인 등재",
    unit: "개",
    threshold: 1,
  },
  {
    key: "dictionary_2",
    track: "dictionary",
    tier: 2,
    name: "말모이 박사",
    icon: "📚",
    color: "#059669",
    desc: "우리말 사전에 단어 5개 이상 정식 등재",
    metricLabel: "승인 등재",
    unit: "개",
    threshold: 5,
  },
  {
    key: "dictionary_3",
    track: "dictionary",
    tier: 3,
    name: "현대판 주시경",
    icon: "🏛️",
    color: "#065f46",
    desc: "우리말 사전에 단어 10개 이상 정식 등재",
    metricLabel: "승인 등재",
    unit: "개",
    threshold: 10,
  },
  // ── 누적 XP ────────────────────────────────
  {
    key: "xp_1",
    track: "xp",
    tier: 1,
    name: "바른말 훈련병",
    icon: "🎯",
    color: "#38bdf8",
    desc: "누적 개인 경험치 100 XP 이상 달성",
    metricLabel: "누적 XP",
    unit: "XP",
    threshold: 100,
  },
  {
    key: "xp_2",
    track: "xp",
    tier: 2,
    name: "수호대 정예병",
    icon: "🛡️",
    color: "#2563eb",
    desc: "누적 개인 경험치 400 XP 이상 달성",
    metricLabel: "누적 XP",
    unit: "XP",
    threshold: 400,
  },
  {
    key: "xp_3",
    track: "xp",
    tier: 3,
    name: "바른말 최고 사령관",
    icon: "👑",
    color: "#1e40af",
    desc: "누적 개인 경험치 700 XP 이상 달성",
    metricLabel: "누적 XP",
    unit: "XP",
    threshold: 700,
  },
  // ── 선플 공감 ──────────────────────────────
  {
    key: "reactions_1",
    track: "reactions",
    tier: 1,
    name: "공감의 기사",
    icon: "🤝",
    color: "#f472b6",
    desc: "친구의 바른말 카드에 공감 5회 이상 누르기",
    metricLabel: "누른 공감",
    unit: "회",
    threshold: 5,
  },
  {
    key: "reactions_2",
    track: "reactions",
    tier: 2,
    name: "따뜻한 격려가",
    icon: "💗",
    color: "#ec4899",
    desc: "친구의 바른말 카드에 공감 20회 이상 누르기",
    metricLabel: "누른 공감",
    unit: "회",
    threshold: 20,
  },
  {
    key: "reactions_3",
    track: "reactions",
    tier: 3,
    name: "언어 평화주의자",
    icon: "🕊️",
    color: "#be185d",
    desc: "친구의 바른말 카드에 공감 50회 이상 누르기",
    metricLabel: "누른 공감",
    unit: "회",
    threshold: 50,
  },
  // ── 성찰 저널 ──────────────────────────────
  {
    key: "journal_1",
    track: "journal",
    tier: 1,
    name: "기록의 달인",
    icon: "📔",
    color: "#fbbf24",
    desc: "성찰 저널 3일 연속 작성",
    metricLabel: "연속 작성",
    unit: "일",
    threshold: 3,
  },
  {
    key: "journal_2",
    track: "journal",
    tier: 2,
    name: "바른 언어 관찰자",
    icon: "🔍",
    color: "#f59e0b",
    desc: "성찰 저널 7일 연속 작성",
    metricLabel: "연속 작성",
    unit: "일",
    threshold: 7,
  },
  {
    key: "journal_3",
    track: "journal",
    tier: 3,
    name: "언어 수호의 구도자",
    icon: "🕯️",
    color: "#b45309",
    desc: "성찰 저널 14일 연속 작성",
    metricLabel: "연속 작성",
    unit: "일",
    threshold: 14,
  },
];

export const TRACK_LABEL: Record<BadgeTrack, string> = {
  dictionary: "우리말 사전 기여",
  xp: "누적 경험치 성장",
  reactions: "선플 공감 실천",
  journal: "성찰 저널 꾸준함",
};

export function statValueFor(track: BadgeTrack, s: BadgeStats): number {
  switch (track) {
    case "dictionary":
      return s.approvedWords;
    case "xp":
      return s.totalXP;
    case "reactions":
      return s.votedCount;
    case "journal":
      return s.journalStreak;
  }
}

export function progressFor(def: BadgeDef, s: BadgeStats) {
  const current = statValueFor(def.track, s);
  const pct = Math.min(100, Math.round((current / def.threshold) * 100));
  return { current, target: def.threshold, pct, done: current >= def.threshold };
}

export function derivedUnlocked(s: BadgeStats): string[] {
  return BADGE_TRACKS.filter((b) => progressFor(b, s).done).map((b) => b.key);
}

// 대표 칭호(자동 장착): 유효 잠금 집합에서 최고 티어, 동률이면 threshold 큰 쪽.
export function representativeBadge(unlockedKeys: string[]): BadgeDef | null {
  const owned = BADGE_TRACKS.filter((b) => unlockedKeys.includes(b.key));
  if (owned.length === 0) return null;
  return owned.reduce((best, cur) => {
    if (cur.tier > best.tier) return cur;
    if (cur.tier === best.tier && cur.threshold > best.threshold) return cur;
    return best;
  });
}

// 표시 순서 정렬: track 순 → tier 오름차순
export const TRACK_ORDER: BadgeTrack[] = ["dictionary", "xp", "reactions", "journal"];
export const BADGES_SORTED: BadgeDef[] = [...BADGE_TRACKS].sort((a, b) => {
  const t = TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track);
  return t !== 0 ? t : a.tier - b.tier;
});
