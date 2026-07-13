import { useEffect, useMemo, useState } from "react";
import { X, Info, Lock, CheckCircle2 } from "lucide-react";
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

  // 영역별 승인 단어 평균(잠금 진행률 계산용).
  const areaAvg = useMemo(() => {
    const mine = dict.filter((d) => d.suggested_by === student.id && d.status === "approved");
    const out: Record<string, { avg: number; count: number }> = {};
    for (const b of AREA_BADGES) {
      if (mine.length === 0) {
        out[b.badgeKey] = { avg: 5, count: 0 };
        continue;
      }
      const vals = mine.map((d) => d.evaluations?.[b.key] ?? 5);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      out[b.badgeKey] = { avg, count: mine.length };
    }
    return out;
  }, [dict, student.id]);

  type AreaItem = { kind: "area"; badge: (typeof AREA_BADGES)[number]; done: boolean; pct: number };
  type TrackItem = { kind: "track"; badge: BadgeDef; done: boolean; pct: number };
  type Item = AreaItem | TrackItem;

  const items: Item[] = [
    ...AREA_BADGES.map<AreaItem>((b) => {
      const done = ownedAreaKeys.has(b.badgeKey);
      const a = areaAvg[b.badgeKey];
      // 5.0(최악) → 0%, 2.5(해금선) → 100%
      const raw = a && a.count > 0 ? ((5 - a.avg) / (5 - 2.5)) * 100 : 0;
      const pct = done ? 100 : Math.max(0, Math.min(100, Math.round(raw)));
      return { kind: "area", badge: b, done, pct };
    }),
    ...BADGES_SORTED.map<TrackItem>((b) => {
      const p = progressFor(b, stats);
      const done = trackUnlocked.has(b.key) || p.done;
      return { kind: "track", badge: b, done, pct: done ? 100 : p.pct };
    }),
  ];
  const owned = items.filter((i) => i.done);
  const locked = items.filter((i) => !i.done);
  const totalCount = items.length;
  const ownedCount = owned.length;
  const overallPct = Math.round((ownedCount / totalCount) * 100);

  const [selected, setSelected] = useState<Item | null>(null);

  return (
    <div
      className="fixed inset-0 z-[70] bg-[color:var(--navy)]/55 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="뱃지 도감"
    >
      <div
        className="w-full max-w-3xl my-4 glass-card p-5 sm:p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[color:var(--navy)] truncate">
              🏆 뱃지 도감 · {student.name}
            </h3>
            <div className="text-[11px] font-bold text-muted-foreground mt-0.5">
              총 {ownedCount} / {totalCount} 획득 · 영역 {ownedArea.length}/{AREA_BADGES.length} · 트랙 {trackOwnedCount}/{BADGES_SORTED.length}
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

        {/* 전체 진행률 */}
        <div className="mb-4 rounded-2xl bg-white/70 p-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[color:var(--navy)] mb-1">
            <span>전체 도감 진행률</span>
            <span>{overallPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white overflow-hidden">
            <div
              className="h-full transition-all"
              style={{ width: `${overallPct}%`, background: "linear-gradient(90deg,#38bdf8,#a78bfa)" }}
            />
          </div>
        </div>

        {/* ✅ 획득한 뱃지 */}
        <section className="rounded-2xl bg-white/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-[color:var(--navy)] flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" />
              획득한 뱃지
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">
              {ownedCount} 개
            </span>
          </div>
          {owned.length === 0 ? (
            <div className="text-[11px] text-muted-foreground py-4 text-center">
              아직 획득한 뱃지가 없어요. 아래 잠긴 뱃지를 눌러 조건을 확인해 보세요!
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {owned.map((it) => (
                <CodexCard
                  key={itemKey(it)}
                  item={it}
                  onClick={() => setSelected(it)}
                  active={selected ? itemKey(selected) === itemKey(it) : false}
                />
              ))}
            </div>
          )}
        </section>

        {/* 🔒 잠긴 뱃지 */}
        <section className="mt-4 rounded-2xl bg-white/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-[color:var(--navy)] flex items-center gap-1.5">
              <Lock size={16} className="text-slate-500" />
              잠긴 뱃지
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">
              {locked.length} 개 · 뱃지를 눌러 조건 확인
            </span>
          </div>
          {locked.length === 0 ? (
            <div className="text-[11px] text-muted-foreground py-4 text-center">
              🎉 모든 뱃지를 획득했어요!
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {locked.map((it) => (
                <CodexCard
                  key={itemKey(it)}
                  item={it}
                  onClick={() => setSelected(it)}
                  active={selected ? itemKey(selected) === itemKey(it) : false}
                />
              ))}
            </div>
          )}
        </section>

        {/* ℹ️ 인포 패널 (선택된 뱃지) */}
        {selected && (
          <InfoPanel item={selected} areaAvg={areaAvg} stats={stats} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

function itemKey(it: { kind: string; badge: { key?: string; badgeKey?: string } & Record<string, unknown> }) {
  return it.kind + ":" + (it.badge.key ?? it.badge.badgeKey);
}

type AnyItem =
  | { kind: "area"; badge: (typeof AREA_BADGES)[number]; done: boolean; pct: number }
  | { kind: "track"; badge: BadgeDef; done: boolean; pct: number };

function CodexCard({
  item,
  onClick,
  active,
}: {
  item: AnyItem;
  onClick: () => void;
  active: boolean;
}) {
  const { done, pct } = item;
  const color = item.badge.color;
  const icon = item.badge.icon;
  const name = item.badge.name;
  const sub =
    item.kind === "area" ? item.badge.area : `Lv.${item.badge.tier} · ${TIER_LABEL[item.badge.tier]}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-xl p-2 border-2 transition hover:scale-[1.02] active:scale-95 ${
        done ? "border-white bg-white/95" : "border-dashed border-white/60 bg-white/40"
      } ${active ? "ring-2 ring-[color:var(--navy)]/60" : ""}`}
      style={done ? { boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
      title={done ? name : `${name} · 잠금 · 눌러서 조건 보기`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="text-xl leading-none"
          style={{ filter: done ? undefined : "grayscale(1)", opacity: done ? 1 : 0.55 }}
        >
          {done ? icon : "🔒"}
        </span>
        <span
          className={`text-[11px] font-black truncate ${
            done ? "text-[color:var(--navy)]" : "text-muted-foreground"
          }`}
        >
          {name}
        </span>
      </div>
      <div className="mt-0.5 text-[9px] font-bold text-muted-foreground truncate">{sub}</div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: done ? color : "#94a3b8" }}
        />
      </div>
      <div className="mt-0.5 text-[9px] font-mono font-bold text-right" style={{ color: done ? color : "#64748b" }}>
        {pct}%
      </div>
    </button>
  );
}

function InfoPanel({
  item,
  areaAvg,
  stats,
  onClose,
}: {
  item: AnyItem;
  areaAvg: Record<string, { avg: number; count: number }>;
  stats: BadgeStats;
  onClose: () => void;
}) {
  const color = item.badge.color;

  let condition = "";
  let progressLine = "";
  let hint = "";

  if (item.kind === "area") {
    const a = areaAvg[item.badge.badgeKey];
    condition = `승인된 내 단어의 "${item.badge.area}" 평균 점수를 2.5 이하로 낮추기 (5점: 최악 · 1점: 최상)`;
    progressLine =
      a.count === 0
        ? "아직 승인된 내 단어가 없어요. 사전 탭에서 순화어를 제안해 보세요!"
        : `현재 평균 ${a.avg.toFixed(2)} · 승인 단어 ${a.count}개 · 목표 ≤ 2.50`;
    hint = "💡 순화도 높은 단어를 여러 개 등재할수록 평균이 내려가요.";
  } else {
    const b = item.badge;
    const p = progressFor(b, stats);
    condition = `${TRACK_LABEL[b.track]} — ${b.desc}`;
    progressLine = `현재 ${p.current}${b.unit} / 목표 ${p.target}${b.unit} · ${p.pct}%`;
    hint =
      b.track === "dictionary"
        ? "💡 사전 탭에서 순화어를 제안하고 선생님의 승인을 받아 보세요."
        : b.track === "xp"
        ? "💡 활동 전반(사전 · 저널 · 공감)으로 누적 XP가 올라가요."
        : b.track === "reactions"
        ? "💡 친구들의 바른말 카드에 공감 버튼을 눌러 응원해 보세요."
        : "💡 매일 성찰 저널을 이어 쓰면 연속 일수가 늘어나요.";
  }

  return (
    <div
      className="mt-4 rounded-2xl border-2 p-4 relative"
      style={{ borderColor: color, background: `linear-gradient(180deg, ${color}14, #ffffff)` }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="인포 닫기"
        className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full hover:bg-white/70"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl leading-none" style={{ filter: item.done ? undefined : "grayscale(0.2)" }}>
          {item.done ? item.badge.icon : "🔒"}
        </span>
        <div className="min-w-0">
          <div className="font-black text-[color:var(--navy)] truncate">{item.badge.name}</div>
          <div className="text-[10px] font-bold text-muted-foreground">
            {item.kind === "area"
              ? `5대 영역 칭호 · ${item.badge.area}`
              : `${TRACK_LABEL[item.badge.track]} · Lv.${item.badge.tier} ${TIER_LABEL[item.badge.tier]}`}
          </div>
        </div>
        <span
          className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full text-white"
          style={{ background: item.done ? color : "#94a3b8" }}
        >
          {item.done ? "획득 완료" : "잠금"}
        </span>
      </div>
      <div className="text-[12px] leading-snug text-[color:var(--navy)] mb-2">
        <div className="flex items-start gap-1.5">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color }} />
          <span>
            <b>해금 조건 · </b>
            {condition}
          </span>
        </div>
      </div>
      <div className="rounded-xl bg-white/70 p-2 text-[11px] font-mono font-bold text-[color:var(--navy)]">
        {progressLine}
      </div>
      <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${item.pct}%`, background: item.done ? color : "#94a3b8" }}
        />
      </div>
      <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{hint}</div>
    </div>
  );
}