import { useEffect, useMemo, useState } from "react";
import { X, BookHeart, Sparkles, FileText } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import type { DictEntry, StudentRecord, ClassState } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import {
  BADGES_SORTED,
  TIER_LABEL,
  TRACK_LABEL,
  TRACK_ORDER,
  progressFor,
  representativeBadge,
  derivedUnlocked,
  type BadgeDef,
  type BadgeStats,
} from "@/lib/badges";
import { ReportModal } from "./ReportModal";
import {
  todaysReflectionPrompt,
  REFLECTION_AFTER_SAVE,
  REFLECTION_PROMPTS,
} from "@/lib/reflection-prompts";

export function ProfileModal({
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
  const writeJournal = useEngagementStore((s) => s.writeJournal);
  const syncBadges = useEngagementStore((s) => s.syncBadges);
  const today = new Date().toISOString().slice(0, 10);
  const wroteToday = engagement?.lastJournalDate === today;
  const [text, setText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const prompt = todaysReflectionPrompt();
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
  const unlocked = useMemo(() => {
    const persisted = engagement?.unlockedBadges ?? [];
    const merged = new Set<string>([...persisted, ...auto]);
    return Array.from(merged);
  }, [engagement?.unlockedBadges, auto]);
  const rep = representativeBadge(unlocked);
  const recentJournals = useMemo(
    () => (engagement?.journals ?? []).slice(-5).reverse(),
    [engagement?.journals],
  );
  const [openBadge, setOpenBadge] = useState<string | null>(null);

  function submit() {
    const res = writeJournal(student.id, student.classCode, text);
    if (!res.ok) {
      if (res.reason === "already") toast.info("오늘의 저널은 이미 작성했어요. 내일 또 만나요!");
      else toast.warning("성찰 내용을 한 줄 이상 적어주세요.");
      return;
    }
    setText("");
    if (res.streakBonus) {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 } });
      toast.success(`🎆 ${res.streak}일 연속 달성! 보너스 +10 XP`, {
        description: `꾸준함이 곧 실력입니다. ${REFLECTION_AFTER_SAVE}`,
      });
    } else {
      toast.success("성찰 저널 저장 완료! +2 XP", { description: REFLECTION_AFTER_SAVE });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-3 pl-safe pr-safe overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg my-4 glass-card p-5 sm:p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[color:var(--navy)] flex items-center gap-2 truncate">
              👤 내 프로필 · {student.name}
            </h3>
            {rep && (
              <div
                className="mt-2 inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-md ring-1 ring-white/70 animate-scale-in max-w-full"
                style={{ background: `linear-gradient(135deg, ${rep.color}, ${rep.color}cc)` }}
                title={`대표 칭호 · ${TIER_LABEL[rep.tier]}`}
              >
                {rep.image ? (
                  <img
                    src={rep.image}
                    alt={rep.name}
                    className="h-8 w-8 object-contain drop-shadow shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xl leading-none" aria-hidden>
                    {rep.icon}
                  </span>
                )}
                <span className="flex flex-col leading-tight min-w-0">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
                    대표 칭호
                  </span>
                  <span className="text-[12px] font-black text-white truncate">
                    {rep.name}
                    <span
                      className="ml-1 font-mono text-white/90"
                      aria-label={`레벨 ${rep.tier}`}
                    >
                      {"★".repeat(rep.tier)}
                    </span>
                  </span>
                </span>
              </div>
            )}
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

        {/* Journal */}
        <section className="rounded-2xl bg-white/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookHeart size={18} className="text-[color:var(--mint-deep)]" />
            <div className="font-black text-[color:var(--navy)]">오늘의 우리말 성찰</div>
            <span className="ml-auto text-[11px] font-bold text-muted-foreground">
              {engagement?.streak ?? 0}일 연속 · 총 {engagement?.journals.length ?? 0}편
            </span>
          </div>
          {wroteToday ? (
            <div className="text-sm text-muted-foreground rounded-xl bg-white/50 p-3 wt-text">
              ✅ 오늘의 성찰은 이미 작성했어요. 내일 다시 만나요! 3일 연속 달성 시 폭죽과 함께 +10
              XP 보너스가 지급돼요.
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={`오늘의 질문 · ${prompt.label} — ${prompt.hint}`}
                className="w-full rounded-xl border-2 border-white/70 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] transition wt-text"
              />
              <ul className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                {REFLECTION_PROMPTS.map((p) => (
                  <li key={p.key}>· {p.label}</li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{text.length}/300</span>
                <button
                  type="button"
                  onClick={submit}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
                >
                  <Sparkles size={14} /> 저장 (+2 XP)
                </button>
              </div>
            </>
          )}
          {recentJournals.length > 0 && (
            <ul className="mt-3 space-y-1">
              {recentJournals.map((j) => (
                <li key={j.date} className="text-xs text-[color:var(--navy)] wt-text">
                  <b className="font-mono text-[10px] text-muted-foreground mr-2">{j.date}</b>
                  {j.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Badges */}
        <section className="mt-4 rounded-2xl bg-white/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-[color:var(--navy)]">🎖️ 뱃지 도감 · 12대 칭호</div>
            <span className="text-[10px] font-bold text-muted-foreground">
              {unlocked.filter((k) => BADGES_SORTED.some((b) => b.key === k)).length} / 12 획득
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
                      <BadgeTile
                        key={b.key}
                        b={b}
                        stats={stats}
                        unlocked={unlocked.includes(b.key)}
                        open={openBadge === b.key}
                        onToggle={() => setOpenBadge((k) => (k === b.key ? null : b.key))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
            💡 뱃지 아이콘을 눌러 미션 조건과 진척도를 확인해요. 한 번 얻은 칭호는 XP가 줄어도
            유지됩니다.
          </div>
        </section>

        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--mint-deep)] to-[color:var(--navy)] text-white px-4 py-3 font-black shadow-[var(--shadow-soft)] hover:scale-[1.02] active:scale-95 transition"
        >
          <FileText size={18} /> 📄 나의 언어 수호 리포트 보기
        </button>
      </div>

      {showReport && (
        <ReportModal
          student={student}
          dict={dict}
          classState={classState}
          totalRoleplayScenarios={totalRoleplayScenarios}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function BadgeTile({
  b,
  stats,
  unlocked,
  open,
  onToggle,
}: {
  b: BadgeDef;
  stats: BadgeStats;
  unlocked: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const p = progressFor(b, stats);
  const done = unlocked || p.done;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${b.name} · ${TIER_LABEL[b.tier]} · ${done ? "획득 완료" : "잠금"} · ${p.current}/${p.target}${b.unit}`}
        className={`w-full rounded-xl p-2 text-center border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)] ${
          done
            ? "border-white bg-white/95 hover:-translate-y-0.5 hover:shadow-md"
            : "border-dashed border-slate-300 bg-white/40 hover:-translate-y-0.5 hover:bg-white/60"
        } ${open ? "ring-2 ring-[color:var(--mint-deep)]" : ""}`}
        style={done ? { boxShadow: `inset 0 -3px 0 ${b.color}` } : undefined}
      >
        <div className="grid place-items-center h-12">
          {b.image ? (
            <img
              src={b.image}
              alt={done ? b.name : `${b.name} (잠금)`}
              className="h-12 w-12 object-contain transition"
              style={{
                filter: done ? undefined : "grayscale(1)",
                opacity: done ? 1 : 0.4,
              }}
              loading="lazy"
            />
          ) : (
            <span
              className="text-2xl leading-none"
              style={{ filter: done ? undefined : "grayscale(1)", opacity: done ? 1 : 0.4 }}
              aria-hidden
            >
              {done ? b.icon : "🔒"}
            </span>
          )}
        </div>
        <div
          className={`mt-1 text-[10px] font-black truncate ${done ? "text-[color:var(--navy)]" : "text-muted-foreground"}`}
        >
          {b.name}
        </div>
        <div className="mt-1 text-[9px] font-bold text-muted-foreground">
          <span aria-label={`레벨 ${b.tier}`} style={{ color: done ? b.color : undefined }}>
            {"★".repeat(b.tier)}
          </span>{" "}
          · {TIER_LABEL[b.tier]}
        </div>
        {/* progress */}
        <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${p.pct}%`, background: done ? b.color : "#94a3b8" }}
          />
        </div>
        <div
          className="mt-1 text-[9px] font-mono font-bold"
          style={{ color: done ? b.color : "#64748b" }}
        >
          {p.current}/{p.target}
          {b.unit}
        </div>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-56 max-w-[80vw] rounded-2xl bg-[color:var(--navy)] text-white p-3 shadow-xl text-left animate-scale-in"
        >
          <div className="text-[11px] font-bold opacity-80">
            {TRACK_LABEL[b.track]} · {TIER_LABEL[b.tier]}
          </div>
          <div className="text-sm font-black flex items-center gap-1.5">
            {b.image ? (
              <img src={b.image} alt="" className="h-5 w-5 object-contain" loading="lazy" />
            ) : (
              <span className="text-lg leading-none">{b.icon}</span>
            )}{" "}
            {b.name}
          </div>
          <div className="mt-1 text-[11px] opacity-90 leading-snug">{b.desc}</div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
            <span>진척도</span>
            <span className="font-mono">
              {p.current} / {p.target} {b.unit}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${p.pct}%`, background: done ? b.color : "#fbbf24" }}
            />
          </div>
          <div className="mt-1.5 text-[10px] opacity-80">
            {done
              ? "✅ 미션 완수! 대표 칭호 후보로 자동 반영돼요."
              : `앞으로 ${Math.max(0, p.target - p.current)}${b.unit} 더 하면 해금!`}
          </div>
        </div>
      )}
    </div>
  );
}
