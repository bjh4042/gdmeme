import { useMemo, useState } from "react";
import { X, BookHeart, Sparkles, FileText } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import type { DictEntry, StudentRecord, ClassState } from "@/lib/literacy-types";
import { BADGES, useEngagementStore } from "@/stores/engagement";
import { ReportModal } from "./ReportModal";

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
  const today = new Date().toISOString().slice(0, 10);
  const wroteToday = engagement?.lastJournalDate === today;
  const [text, setText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const unlocked = engagement?.unlockedBadges ?? [];
  const recentJournals = useMemo(
    () => (engagement?.journals ?? []).slice(-5).reverse(),
    [engagement?.journals],
  );

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
        description: "꾸준함이 곧 실력입니다.",
      });
    } else {
      toast.success("성찰 저널 저장 완료! +2 XP");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-3 pl-safe pr-safe overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg my-4 glass-card p-5 sm:p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[color:var(--navy)] flex items-center gap-2">
            👤 내 프로필 · {student.name}
          </h3>
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
              ✅ 오늘의 성찰은 이미 작성했어요. 내일 다시 만나요! 3일 연속 달성 시 폭죽과 함께 +10 XP 보너스가 지급돼요.
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="오늘 내가 지킨 바른 말 한 줄을 남겨보아요. (하루 1회 · +2 XP)"
                className="w-full rounded-xl border-2 border-white/70 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] transition wt-text"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{text.length}/300</span>
                <button
                  type="button"
                  onClick={submit}
                  className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-4 py-2 text-sm font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
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
          <div className="font-black text-[color:var(--navy)] mb-2">🎖️ 뱃지 도감</div>
          <div className="grid grid-cols-4 gap-2">
            {BADGES.map((b) => {
              const on = unlocked.includes(b.key);
              return (
                <div
                  key={b.key}
                  className={`rounded-xl p-2 text-center border-2 transition ${
                    on ? "border-white bg-white/90 hover:-translate-y-0.5" : "border-dashed border-white/60 bg-white/40"
                  }`}
                  style={on ? { boxShadow: `inset 0 -3px 0 ${b.color}` } : undefined}
                  title={b.desc}
                >
                  <div
                    className="text-2xl leading-none"
                    style={{
                      imageRendering: "pixelated",
                      filter: on ? undefined : "grayscale(1) blur(0.6px)",
                      opacity: on ? 1 : 0.55,
                    }}
                  >
                    {on ? b.icon : "🔒"}
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-black truncate ${
                      on ? "text-[color:var(--navy)]" : "text-muted-foreground"
                    }`}
                  >
                    {b.name}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            조건: 공감 5회 / 저널 3일 연속 / 사전 1회 승인 / 역할극 {totalRoleplayScenarios}스테이지 올클리어
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