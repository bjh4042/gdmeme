import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import type { DictEntry, StudentRecord, ClassState } from "@/lib/literacy-types";
import { levelOf, weatherOf } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import {
  BADGES_SORTED,
  TIER_LABEL,
  progressFor,
  representativeBadge,
  derivedUnlocked,
  type BadgeDef,
  type BadgeStats,
} from "@/lib/badges";

export function ReportModal({
  student,
  dict,
  classState,
  totalRoleplayScenarios,
  onClose,
}: {
  student: StudentRecord;
  dict: DictEntry[];
  classState: ClassState;
  totalRoleplayScenarios: number;
  onClose: () => void;
}) {
  const engagement = useEngagementStore((s) => s.byStudent[student.id]);
  const syncBadges = useEngagementStore((s) => s.syncBadges);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  const contributed = useMemo(() => dict.filter((d) => d.suggested_by === student.id), [dict, student.id]);
  const approvedCount = contributed.filter((d) => d.status === "approved").length;
  const proposedCount = contributed.length;
  const cleared = engagement?.roleplayCleared.length ?? 0;
  const roleplayRate = totalRoleplayScenarios > 0 ? Math.round((cleared / totalRoleplayScenarios) * 100) : 0;
  const avgClass = useMemo(() => {
    const approved = dict.filter((d) => d.status === "approved");
    if (!approved.length) return 0;
    return Math.round(approved.reduce((s, d) => s + d.total_harmful_score, 0) / approved.length);
  }, [dict]);
  const weather = weatherOf(avgClass);
  const lv = levelOf(student.xp);
  const stats: BadgeStats = {
    approvedWords: approvedCount,
    totalXP: student.xp,
    votedCount: engagement?.likesGivenCount ?? 0,
    journalStreak: engagement?.streak ?? 0,
  };
  const auto = useMemo(() => derivedUnlocked(stats), [stats.approvedWords, stats.totalXP, stats.votedCount, stats.journalStreak]);
  useEffect(() => {
    if (auto.length) syncBadges(student.id, auto);
  }, [auto, student.id, syncBadges]);
  const unlocked = useMemo(() => {
    const persisted = engagement?.unlockedBadges ?? [];
    return Array.from(new Set<string>([...persisted, ...auto]));
  }, [engagement?.unlockedBadges, auto]);
  const rep = representativeBadge(unlocked);

  async function download() {
    if (!cardRef.current) return;
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("이미지 저장 중… 잠시만 기다려 주세요.");
    try {
      // 로딩 오버레이가 먼저 뜨도록 프레임 양보 + 폰트/이모지/이미지 로드 대기.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      try {
        // 웹 폰트가 아직 스왑 중이면 캡처가 fallback으로 렌더되는 문제 방지.
        if (typeof document !== "undefined" && (document as Document).fonts?.ready) {
          await (document as Document).fonts.ready;
        }
      } catch {
        /* 폰트 API 미지원 브라우저는 무시 */
      }
      // 300ms 마이크로 딜레이 — 이모지/이미지 디코드 여유.
      await new Promise((r) => setTimeout(r, 300));
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `언어수호리포트_${student.classCode}반_${student.number}번_${student.name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("이미지 저장 완료! 다운로드 폴더를 확인해 주세요.", { id: toastId });
    } catch (err) {
      console.error("[report] html2canvas failed", err);
      toast.error("이미지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[color:var(--navy)]/60 backdrop-blur-sm flex items-center justify-center p-3 pl-safe pr-safe overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl my-4 relative animate-scale-in">
        {busy && (
          <div
            className="fixed inset-0 z-[80] bg-[color:var(--navy)]/60 backdrop-blur-sm flex items-center justify-center animate-fade-in"
            role="alertdialog"
            aria-modal="true"
            aria-label="이미지 저장 중"
          >
            <div className="rounded-2xl bg-white/95 shadow-2xl px-6 py-5 flex items-center gap-3">
              <Loader2 className="animate-spin text-[color:var(--navy)]" size={22} />
              <div className="min-w-0">
                <div className="text-sm font-black text-[color:var(--navy)]">이미지 저장 중…</div>
                <div className="text-[11px] text-muted-foreground">
                  리포트를 PNG로 렌더링하고 있어요. 잠시만 기다려 주세요.
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-10 h-10 grid place-items-center rounded-full bg-white shadow-lg hover:scale-110 transition"
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        <div
          ref={cardRef}
          className="rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-soft)] border-4 border-double border-[color:var(--navy)]/30"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(232,246,255,0.95) 60%, rgba(255,244,214,0.95))",
          }}
        >
          <div className="text-center">
            <div className="text-xs tracking-[0.35em] font-bold text-[color:var(--mint-deep)]">
              KOREAN LITERACY GUARD
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black text-[color:var(--navy)]">
              🏆 나의 언어 수호 리포트
            </h2>
            <div className="mt-1 text-xs text-muted-foreground">
              발급일 {new Date().toISOString().slice(0, 10)}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-white/70 p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-white/80">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-bold">학생</div>
              <div className="text-xl font-black text-[color:var(--navy)] truncate">
                {student.name}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {student.classCode}반 · {student.number}번
              </div>
              {rep && (
                <div
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full text-white shadow-sm"
                  style={{ background: rep.color }}
                  title={`대표 칭호 · Lv.${rep.tier} ${TIER_LABEL[rep.tier]}`}
                >
                  <span className="text-xs leading-none">{rep.icon}</span> {rep.name} · Lv.{rep.tier}
                </div>
              )}
              {student.group && (
                <div className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--mint)]/50 text-[color:var(--navy)]">
                  {student.group}조
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-muted-foreground font-bold">개인 누적 XP</div>
              <div className="text-3xl font-black text-[color:var(--mint-deep)] font-mono">{student.xp}</div>
              <div className="text-[11px] font-bold text-[color:var(--navy)]">
                Lv.{lv.current.lv} {lv.current.name}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard label="사전 등재 승인" value={`${approvedCount}건`} sub={`제안 총 ${proposedCount}건`} />
            <MetricCard label="역할극 통과율" value={`${roleplayRate}%`} sub={`${cleared} / ${totalRoleplayScenarios} 시나리오`} />
            <MetricCard label="선플 공감" value={`${engagement?.likesGivenCount ?? 0}회`} sub={`받은 공감 ${engagement?.likesReceivedCount ?? 0}회`} />
          </div>

          <div className="mt-4 rounded-2xl bg-white/60 p-4 border border-white/80">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-muted-foreground font-bold">획득 뱃지 도감 · 12대 칭호</div>
              <div className="text-[10px] font-bold text-[color:var(--mint-deep)]">
                {unlocked.filter((k) => BADGES_SORTED.some((b) => b.key === k)).length} / 12
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {BADGES_SORTED.map((b) => (
                <BadgeCell key={b.key} b={b} stats={stats} unlocked={unlocked.includes(b.key)} />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 text-white shadow-[var(--shadow-soft)]"
            style={{
              background:
                weather.tone === "safe"
                  ? "linear-gradient(135deg, oklch(0.85 0.11 180), oklch(0.72 0.14 210))"
                  : weather.tone === "warn"
                  ? "linear-gradient(135deg, oklch(0.88 0.13 85), oklch(0.72 0.14 60))"
                  : "linear-gradient(135deg, oklch(0.55 0.18 260), oklch(0.42 0.22 25))",
            }}
          >
            <div className="text-xs opacity-90 font-bold">최근 우리 반 언어 기상도</div>
            <div className="text-lg font-black">
              {weather.icon} {weather.label} · 평균 유해도 {avgClass}
            </div>
            <div className="text-xs opacity-90">{weather.desc}</div>
            <div className="text-[11px] mt-1 opacity-80">
              학급 공유 경험치 {classState.xp} XP
            </div>
          </div>

          <div className="mt-5 text-center text-[10px] text-muted-foreground">
            ★ 이 리포트는 바른말 수호대 플랫폼에서 자동 생성되었습니다.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/80 hover:bg-white font-bold text-sm transition"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold text-sm shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            💾 부모님께 자랑하기 (이미지 저장)
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 border border-white/80">
      <div className="text-[11px] text-muted-foreground font-bold">{label}</div>
      <div className="text-xl font-black text-[color:var(--navy)] mt-0.5">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function BadgeCell({ b, stats, unlocked }: { b: BadgeDef; stats: BadgeStats; unlocked: boolean }) {
  const p = progressFor(b, stats);
  const done = unlocked || p.done;
  return (
    <div
      className={`rounded-xl p-2 text-center border-2 transition ${
        done ? "border-white bg-white/95" : "border-dashed border-white/60 bg-white/40"
      }`}
      style={done ? { boxShadow: `inset 0 -3px 0 ${b.color}` } : undefined}
      title={`${b.name} · Lv.${b.tier} ${TIER_LABEL[b.tier]}\n${b.desc}\n진척도 ${p.current}/${p.target}${b.unit}`}
    >
      <div
        className="text-xl leading-none"
        style={{ filter: done ? undefined : "grayscale(1) blur(0.4px)", opacity: done ? 1 : 0.55 }}
      >
        {done ? b.icon : "🔒"}
      </div>
      <div className={`mt-0.5 text-[9px] font-black truncate ${done ? "text-[color:var(--navy)]" : "text-muted-foreground"}`}>
        {b.name}
      </div>
      <div className="text-[8px] font-bold text-muted-foreground">Lv.{b.tier}</div>
      <div className="mt-1 h-1 rounded-full bg-white/70 overflow-hidden">
        <div className="h-full" style={{ width: `${p.pct}%`, background: done ? b.color : "#94a3b8" }} />
      </div>
      <div className="mt-0.5 text-[8px] font-mono" style={{ color: done ? b.color : "#64748b" }}>
        {p.current}/{p.target}
      </div>
    </div>
  );
}