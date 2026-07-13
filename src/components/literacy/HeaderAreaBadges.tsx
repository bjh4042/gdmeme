import { useEffect, useRef, useState } from "react";
import { AREA_BADGES } from "./AreaBadges";

// 헤더 GNB 전용: 5대 영역 최고 등급 칭호를 항상 표시하는 소형 칩.
export function HeaderAreaBadges() {
  return (
    <div className="flex items-center gap-2">
      {AREA_BADGES.map((b) => (
        <HeaderChip key={b.key} badge={b} />
      ))}
    </div>
  );
}

function HeaderChip({ badge }: { badge: (typeof AREA_BADGES)[number] }) {
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