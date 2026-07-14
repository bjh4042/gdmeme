import { useEffect, useRef, useState } from "react";
import { useOwnedAreaBadges } from "./AreaBadges";
import { useDictStore } from "@/stores/dict";
import { useAuthStore } from "@/stores/auth";
import { studentId, useRosterStore } from "@/stores/roster";
import { useEngagementStore } from "@/stores/engagement";
import {
  BADGES_SORTED,
  TIER_LABEL,
  derivedUnlocked,
  type BadgeDef,
  type BadgeStats,
} from "@/lib/badges";

type HeaderBadge = {
  key: string;
  icon: string;
  name: string;
  area: string;
  desc: string;
  color: string;
  tierLabel?: string;
};

// 헤더 GNB 전용: 5대 영역 최고 등급 칭호를 항상 표시하는 소형 칩.
export function HeaderAreaBadges() {
  const dict = useDictStore((s) => s.entries);
  const student = useAuthStore((s) => s.student);
  const sid = student ? studentId(student.classCode, student.number) : "";
  const owned = useOwnedAreaBadges(sid, dict);
  const rec = useRosterStore((s) => s.students.find((r) => r.id === sid));
  const engagement = useEngagementStore((s) => s.byStudent[sid]);
  const syncBadges = useEngagementStore((s) => s.syncBadges);

  const stats: BadgeStats = {
    approvedWords: dict.filter((d) => d.suggested_by === sid && d.status === "approved").length,
    totalXP: rec?.xp ?? 0,
    votedCount: engagement?.likesGivenCount ?? 0,
    journalStreak: engagement?.streak ?? 0,
  };
  const autoTrack = derivedUnlocked(stats);
  useEffect(() => {
    if (sid && autoTrack.length) syncBadges(sid, autoTrack);
  }, [sid, autoTrack.join(","), syncBadges]);

  if (!student) return null;

  const persisted = engagement?.unlockedBadges ?? [];
  const trackUnlockedKeys = new Set<string>([...persisted, ...autoTrack]);
  const ownedTracks: BadgeDef[] = BADGES_SORTED.filter((b) => trackUnlockedKeys.has(b.key));

  const chips: HeaderBadge[] = [
    ...owned.map((b) => ({
      key: b.badgeKey,
      icon: b.icon,
      name: b.name,
      area: b.area,
      desc: b.desc,
      color: b.color,
    })),
    ...ownedTracks.map((b) => ({
      key: b.key,
      icon: b.icon,
      name: b.name,
      area: `${TIER_LABEL[b.tier]} · Lv.${b.tier}`,
      desc: b.desc,
      color: b.color,
      tierLabel: `Lv.${b.tier}`,
    })),
  ];
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-row flex-wrap items-center gap-1.5">
      {chips.map((b) => (
        <HeaderChip key={b.key} badge={b} />
      ))}
    </div>
  );
}

function HeaderChip({ badge }: { badge: HeaderBadge }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`${badge.name} · ${badge.desc}`}
        title={`${badge.name} · ${badge.area}`}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-white leading-none shadow-sm hover:scale-105 active:scale-95 transition whitespace-nowrap"
        style={{ background: badge.color }}
      >
        <span>{badge.icon}</span>
        <span className="hidden md:inline">{badge.name}</span>
        {badge.tierLabel && (
          <span className="hidden md:inline font-mono opacity-80">· {badge.tierLabel}</span>
        )}
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-[60] left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-xl bg-[color:var(--navy)] text-white text-[11px] leading-snug shadow-2xl p-3 pointer-events-none"
        >
          <div className="font-black text-sm mb-0.5">
            {badge.icon} {badge.name}
          </div>
          <div className="opacity-80 mb-1">영역 · {badge.area}</div>
          <div>{badge.desc}</div>
        </div>
      )}
    </div>
  );
}
