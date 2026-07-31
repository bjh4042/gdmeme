import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lock, Sparkles, Trophy } from "lucide-react";
import {
  CHALLENGE_MISSIONS,
  formatIsoDate,
  missionOf,
  todayIsoDate,
} from "@/lib/challenge-7day";
import {
  EMPTY_CHALLENGE,
  nextDayOf,
  progressOf,
  useChallengeStore,
} from "@/stores/challenge";

type Props = {
  studentId: string;
  studentName?: string;
  onXP?: (delta: number, kind: string, note?: string) => void;
};

/** 7일 실천 챌린지 — 하루 1미션 실천 · 한 줄 성찰 · 완료 기록. */
export function ChallengeTab({ studentId }: Props) {
  const rec = useChallengeStore((s) => s.byStudent[studentId] ?? EMPTY_CHALLENGE);
  const completeDay = useChallengeStore((s) => s.completeDay);

  const [checked, setChecked] = useState(false);
  const [reflection, setReflection] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  const day = nextDayOf(rec);
  const pct = progressOf(rec);
  const doneMap = useMemo(() => new Map(rec.days.map((d) => [d.day, d])), [rec.days]);
  const today = todayIsoDate();
  const doneToday = rec.days.some((d) => d.date === today);

  function handleComplete() {
    if (day == null) return;
    if (doneToday) return toast.error("오늘의 실천은 이미 완료했어요. 내일 다시 만나요!");
    if (!checked) return toast.error("실천 체크를 먼저 눌러 주세요.");
    if (!reflection.trim()) return toast.error("한 줄 성찰을 적어 주세요.");
    const ok = completeDay(studentId, day, reflection.trim(), today);
    if (!ok) return;
    setChecked(false);
    setReflection("");
    setCelebrate(true);
    window.setTimeout(() => setCelebrate(false), 1600);
    toast.success(`DAY${day} 실천 완료! 정말 잘했어요.`);
  }

  return (
    <section className="space-y-4">
      {/* 안내 */}
      <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-bold tracking-wide">7일 실천 챌린지</span>
        </div>
        <h2 className="mt-1 text-lg font-black text-[color:var(--navy)]">
          하루에 하나씩, 7일 동안 실천해요
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          오늘의 미션을 실천하고, 한 줄 성찰을 남기면 DAY가 완료돼요. 완료한 날은 다시 고칠 수
          없으니 천천히 생각하고 적어요.
        </p>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--muted)]">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={rec.days.length}
              aria-valuemin={0}
              aria-valuemax={7}
            />
          </div>
          <div className="mt-1 text-right text-[11px] font-bold text-muted-foreground">
            {rec.days.length} / 7 완료 ({pct}%)
          </div>
        </div>
      </div>

      {/* 오늘 미션 */}
      {day != null && doneToday ? (
        <div className="rounded-2xl border-2 border-primary/40 bg-white p-5 text-center shadow-[var(--shadow-soft)]">
          <CheckCircle2 className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <div className="mt-2 text-base font-black text-[color:var(--navy)]">
            오늘의 실천을 완료했어요!
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            내일 DAY {day} 미션이 열려요. 하루에 한 번씩 천천히 실천해요.
          </p>
        </div>
      ) : day != null ? (
        <div
          className={`rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)] ${celebrate ? "animate-scale-in" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
              DAY {day}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">오늘의 미션</span>
          </div>
          <div className="mt-2 text-base font-black text-[color:var(--navy)] leading-snug">
            {missionOf(day).emoji} {missionOf(day).title}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {missionOf(day).hint}
          </p>

          <button
            type="button"
            onClick={() => setChecked((v) => !v)}
            aria-pressed={checked}
            className={`mt-3 w-full flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold transition min-h-[48px] ${
              checked
                ? "border-primary bg-primary/10 text-primary"
                : "border-[color:var(--border)] bg-white text-foreground/80 hover:border-primary/50"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" strokeWidth={checked ? 2.6 : 2} />
            오늘 미션을 실천했어요
          </button>

          <label className="mt-3 block text-xs font-bold text-[color:var(--navy)]">
            한 줄 성찰
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value.slice(0, 100))}
            rows={3}
            maxLength={100}
            placeholder="예) 친구에게 ‘고마워’라고 말했더니 기분이 좋아졌어요."
            className="mt-1.5 w-full resize-none rounded-xl border-2 border-[color:var(--border)] bg-white px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-[color:var(--navy)]"
            aria-label="한 줄 성찰"
          />
          <div className="mt-1 flex justify-end text-[11px] text-muted-foreground" aria-live="polite">
            {reflection.length} / 100
          </div>

          <button
            type="button"
            onClick={handleComplete}
            className="mt-2 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-[var(--shadow-pop)] transition hover:opacity-90"
          >
            DAY {day} 완료하기
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-primary/40 bg-white p-5 text-center shadow-[var(--shadow-soft)] animate-scale-in">
          <Trophy className="mx-auto h-10 w-10 text-[color:var(--amber,#f59e0b)]" aria-hidden />
          <div className="mt-2 text-lg font-black text-[color:var(--navy)]">
            🎉 7일 실천을 모두 마쳤어요!
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            일주일 동안 바른 말을 실천한 나를 칭찬해 주세요.
          </p>
        </div>
      )}

      {/* DAY 목록 */}
      <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-black text-[color:var(--navy)]">나의 7일 기록</h3>
        <ul className="mt-3 space-y-2">
          {CHALLENGE_MISSIONS.map((m) => {
            const d = doneMap.get(m.day);
            const isToday = day === m.day;
            return (
              <li
                key={m.day}
                className={`rounded-xl border-2 px-3 py-2.5 ${
                  d
                    ? "border-primary/40 bg-primary/5"
                    : isToday
                      ? "border-[color:var(--border)] bg-white"
                      : "border-[color:var(--border)] bg-[color:var(--muted)]/40 opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-primary">DAY {m.day}</span>
                  {d ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <CheckCircle2 className="h-3 w-3" /> 완료 · {formatIsoDate(d.date)}{" "}
                      {new Date(d.completedAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    !isToday && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        <Lock className="h-3 w-3" /> 아직
                      </span>
                    )
                  )}
                </div>
                <div className="mt-0.5 text-sm font-bold text-foreground/90 leading-snug">
                  {m.emoji} {m.title}
                </div>
                {d?.reflection && (
                  <p className="mt-1 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 leading-relaxed border border-[color:var(--border)]">
                    💭 {d.reflection}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 교사 피드백 */}
      {rec.teacherFeedback && (
        <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-black text-[color:var(--navy)]">🧑‍🏫 선생님의 피드백</h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {rec.teacherFeedback}
          </p>
        </div>
      )}
    </section>
  );
}