import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { DictEntry, StudentRecord } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import {
  BADGES_SORTED,
  TIER_LABEL,
  TRACK_LABEL,
  TRACK_ORDER,
  progressFor,
  derivedUnlocked,
  type BadgeDef,
  type BadgeStats,
} from "@/lib/badges";
import { AREA_BADGES, useOwnedAreaBadges } from "./AreaBadges";

export function BadgeCodexModal({
  student,
  dict,
  onClose,
}: {
  student: StudentRecord;
  dict: DictEntry[];
  onClose: () => void;
}) {
  const engagement = useEngagementStore((s) => s.byStudent[student.id]);
  const syncBadges = useEngagementStore((s) => s.syncBadges);

  const approvedWords = useMemo(
    () => dict.filter((d) => d.suggested_by === student.id && d.status === "approved").length,
    [dict, student.id],
  );
  const stats: BadgeStats = {
    approvedWords,
    totalXP: student.xp,
    votedCount: engagement?.likesGivenCount ?? 0,
    journalStreak: engagement?.streak ?? 0,
  };
  const auto = useMemo(
    () => derivedUnlocked(stats),
    [stats.approvedWords, stats.totalXP, stats.votedCount, stats.journalStreak],
  );
  useEffect(() => {
    if (auto.length) syncBadges(student.id, auto);
  }, [auto, student.id, syncBadges]);

  const ownedArea = useOwnedAreaBadges(student.id, dict);
  const ownedAreaKeys = new Set(ownedArea.map((b) => b.badgeKey));

  const persisted = engagement?.unlockedBadges ?? [];
  const trackUnlocked = new Set<string>([...persisted, ...auto]);
  const trackOwnedCount = BADGES_SORTED.filter((b) => trackUnlocked.has(b.key)).length;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[color:var(--navy)]/55 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="뱃지 도감"
    >
      <div
        className="w-full max-w-2xl my-4 glass-card p-5 sm:p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[color:var(--navy)] truncate">
              🏆 뱃지 도감 · {student.name}
            </h3>
            <div className="text-[11px] font-bold text-muted-foreground mt-0.5">
              영역 칭호 {ownedArea.length} / {AREA_BADGES.length} · 트랙 뱃지 {trackOwnedCount} / {BADGES_SORTED.length}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/60 transition"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 5대 영역 칭호 */}
        <section className="rounded-2xl bg-white/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-[color:var(--navy)]">🎗️ 5대 영역 최고 등급 칭호</div>
            <span className="text-[10px] font-bold text-muted-foreground">
              {ownedArea.length} / {AREA_BADGES.length} 획득
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {AREA_BADGES.map((b) => {
              const done = ownedAreaKeys.has(b.badgeKey);
              return (
                <div
                  key={b.badgeKey}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    done ? "border-white bg-white/95" : "border-dashed border-white/60 bg-white/40"
                  }`}
                  style={done ? { boxShadow: `inset 0 -3px 0 ${b.color}` } : undefined}
                  title={`${b.area} · ${b.desc}`}
                >
                  <div
                    className="text-2xl leading-none"
                    style={{ filter: done ? undefined : "grayscale(1)", opacity: done ? 1 : 0.55 }}
                  >
                    {done ? b.icon : "🔒"}
                  </div>
                  <div
                    className={`mt-1 text-[11px] font-black truncate ${
                      done ? "text-[color:var(--navy)]" : "text-muted-foreground"
                    }`}
                  >
                    {b.name}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground truncate">{b.area}</div>
                  <div className="mt-1 text-[10px] leading-snug text-[color:var(--navy)]/80 line-clamp-2">
                    {b.desc}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
            💡 승인된 내 단어의 영역별 평균이 2.5 이하가 되면 해당 영역 칭호가 해금돼요. 한 번 얻으면 유지됩니다.
          </div>
        </section>

        {/* 12트랙 성장 뱃지 */}
        <section className="mt-4 rounded-2xl bg-white/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-[color:var(--navy)]">🎖️ 12대 성장 트랙 뱃지</div>
            <span className="text-[10px] font-bold text-muted-foreground">
              {trackOwnedCount} / {BADGES_SORTED.length} 획득
            </span>
          </div>
          <div className="space-y-3">
            {TRACK_ORDER.map((track) => {
              const items = BADGES_SORTED.filter((b) => b.track === track);
              return (
                <div key={track}>
                  <div className="text-[10px] font-bold text-[color:var(--mint-deep)] mb-1 uppercase tracking-wider">
                    {TRACK_LABEL[track]}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((b) => (
                      <CodexTile
                        key={b.key}
                        b={b}
                        stats={stats}
                        unlocked={trackUnlocked.has(b.key)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function CodexTile({ b, stats, unlocked }: { b: BadgeDef; stats: BadgeStats; unlocked: boolean }) {
  const p = progressFor(b, stats);
  const done = unlocked || p.done;
  return (
    <div
      className={`rounded-xl p-2 text-center border-2 transition ${
        done ? "border-white bg-white/95" : "border-dashed border-white/60 bg-white/40"
      }`}
      style={done ? { boxShadow: `inset 0 -3px 0 ${b.color}` } : undefined}
      title={`${b.name} · ${b.desc}`}
    >
      <div
        className="text-2xl leading-none"
        style={{ filter: done ? undefined : "grayscale(1)", opacity: done ? 1 : 0.55 }}
      >
        {done ? b.icon : "🔒"}
      </div>
      <div
        className={`mt-1 text-[10px] font-black truncate ${
          done ? "text-[color:var(--navy)]" : "text-muted-foreground"
        }`}
      >
        {b.name}
      </div>
      <div className="text-[9px] font-bold text-muted-foreground">
        Lv.{b.tier} · {TIER_LABEL[b.tier]}
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${p.pct}%`, background: done ? b.color : "#94a3b8" }}
        />
      </div>
      <div className="mt-1 text-[9px] font-mono font-bold" style={{ color: done ? b.color : "#64748b" }}>
        {p.current}/{p.target}{b.unit}
      </div>
    </div>
  );
}