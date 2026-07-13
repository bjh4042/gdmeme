import { useEffect, useRef, useState } from "react";
import type { DictEntry, Evaluation } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";

// 5대 영역별 최고 등급 칭호 매핑.
export const AREA_BADGES: {
  key: keyof Evaluation;
  badgeKey: string; // engagement 저장용 안정 키
  icon: string;
  name: string;
  area: string;
  desc: string;
  color: string;
}[] = [
  { key: "aggression", badgeKey: "area_aggression", icon: "🛡️", name: "평화의 방패", area: "공격성 제어",
    desc: "거친 공격성 말을 멋지게 참아낸 학생", color: "#38bdf8" },
  { key: "bullying", badgeKey: "area_bullying", icon: "🤝", name: "포용의 악수", area: "따돌림 예방",
    desc: "친구를 소외시키지 않고 모두를 감싸안은 학생", color: "#f472b6" },
  { key: "discrimination", badgeKey: "area_discrimination", icon: "🧡", name: "존중의 물결", area: "혐오성 제어",
    desc: "차별과 혐오 단어 대신 평등의 가치를 실천한 학생", color: "#fb923c" },
  { key: "violence", badgeKey: "area_violence", icon: "🕊️", name: "화해의 비둘기", area: "폭력성 제어",
    desc: "사이버 언어폭력을 예방하고 평화를 수호한 학생", color: "#10b981" },
  { key: "grammar_destruction", badgeKey: "area_grammar_destruction", icon: "✍️", name: "우리말 지킴이", area: "문법파괴 순화",
    desc: "파괴된 외계어 밈 대신 고운 표준어를 솔선수범해 쓴 학생", color: "#a78bfa" },
];

export const AREA_BADGE_KEYS = AREA_BADGES.map((b) => b.badgeKey);

// Stable empty reference so the selector below never returns a fresh array.
const EMPTY_KEYS: string[] = [];

// 승인된 제안 중 해당 영역 평균이 2.5 이하이면 그 영역 칭호 해금.
export function unlockedAreaBadges(dict: DictEntry[], suggestedBy: string) {
  const mine = dict.filter((d) => d.suggested_by === suggestedBy && d.status === "approved");
  if (mine.length === 0) return [] as typeof AREA_BADGES;
  return AREA_BADGES.filter((b) => {
    const vals = mine.map((d) => d.evaluations?.[b.key] ?? 5);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return avg <= 2.5;
  });
}

// 파생된 area 뱃지 + engagement 에 이미 저장된 area 뱃지(래칫) 합집합.
// 한 번 획득하면 새로 등재된 단어로 평균이 올라가더라도 유지된다.
export function useOwnedAreaBadges(suggestedBy: string, dict: DictEntry[]) {
  // Return the stored reference (or undefined) — never `?? []` inside the
  // selector, which creates a fresh array each render and trips Zustand's
  // "getSnapshot should be cached" infinite-loop guard.
  const persistedRaw = useEngagementStore((s) => s.byStudent[suggestedBy]?.unlockedBadges);
  const persisted = persistedRaw ?? EMPTY_KEYS;
  const syncBadges = useEngagementStore((s) => s.syncBadges);
  const derived = unlockedAreaBadges(dict, suggestedBy);
  useEffect(() => {
    if (!suggestedBy) return;
    const keys = derived.map((b) => b.badgeKey);
    if (keys.length) syncBadges(suggestedBy, keys);
  }, [suggestedBy, derived.map((b) => b.badgeKey).join(","), syncBadges]);
  const own = new Set<string>([
    ...derived.map((b) => b.badgeKey),
    ...persisted.filter((k) => AREA_BADGE_KEYS.includes(k)),
  ]);
  return AREA_BADGES.filter((b) => own.has(b.badgeKey));
}

export function AreaBadgeChips({
  suggestedBy,
  dict,
  size = "sm",
}: {
  suggestedBy: string;
  dict: DictEntry[];
  size?: "sm" | "md";
}) {
  const owned = useOwnedAreaBadges(suggestedBy, dict);
  if (owned.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {owned.map((b) => (
        <BadgeChip key={b.key} badge={b} size={size} />
      ))}
    </span>
  );
}

function BadgeChip({
  badge,
  size,
}: {
  badge: (typeof AREA_BADGES)[number];
  size: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const dim = size === "md" ? "text-sm px-2 py-1" : "text-[10px] px-1.5 py-0.5";
  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`${badge.name} 칭호 설명 보기`}
        className={`inline-flex items-center gap-1 rounded-full font-black leading-none text-white shadow-sm hover:scale-105 active:scale-95 transition ${dim}`}
        style={{ background: badge.color }}
      >
        <span>{badge.icon}</span>
        <span className="whitespace-nowrap">{badge.name}</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-xl bg-[color:var(--navy)] text-white text-[11px] leading-snug shadow-xl p-3 pointer-events-none"
        >
          <span className="block font-black text-sm mb-0.5">
            {badge.icon} {badge.name}
          </span>
          <span className="block opacity-80 mb-1">영역 · {badge.area}</span>
          <span className="block">{badge.desc}</span>
        </span>
      )}
    </span>
  );
}