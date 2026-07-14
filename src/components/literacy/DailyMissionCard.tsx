import { useMemo, useState } from "react";
import { Target, CheckCircle2, RefreshCw } from "lucide-react";
import {
  completeMission,
  getTodayMission,
  saveMissionAnswer,
  type DailyMission,
  type DailyMissionState,
} from "@/lib/daily-mission";

type Props = {
  activeId: string;
  onXP?: (delta: number, kind: string, note?: string) => void;
};

export function DailyMissionCard({ activeId, onXP }: Props) {
  // 마운트 시점 1회 계산 (같은 날 재렌더에도 동일 미션 유지).
  const initial = useMemo(() => {
    if (!activeId) return null;
    return getTodayMission(activeId);
  }, [activeId]);

  const [mission] = useState<DailyMission | null>(initial?.mission ?? null);
  const [state, setState] = useState<DailyMissionState | null>(initial?.state ?? null);
  const [open, setOpen] = useState<boolean>(!!initial && !initial.state.done);
  const [answer, setAnswer] = useState<string>(initial?.state.answer ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [showAgain, setShowAgain] = useState<boolean>(false);

  if (!activeId || !mission || !state) return null;

  const done = state.done;
  const trimmed = answer.trim();
  const missionRef = mission;

  function handleSubmit() {
    if (submitting) return;
    if (trimmed.length === 0) return;
    setSubmitting(true);
    const { xpJustAwarded, state: next } = completeMission(activeId, trimmed);
    setState(next);
    setOpen(true);
    setShowAgain(true);
    if (xpJustAwarded && onXP) onXP(3, "daily-mission", missionRef.areaLabel);
    setSubmitting(false);
  }

  function handleDraftChange(v: string) {
    setAnswer(v);
    if (!done) saveMissionAnswer(activeId, v);
  }

  return (
    <section
      aria-label="오늘의 상황 미션"
      className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 sm:p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 text-white text-[11px] font-black px-2.5 py-1">
          <Target className="h-3.5 w-3.5" />
          오늘의 상황 미션
        </span>
        <span className="inline-flex items-center rounded-full bg-white/80 border border-rose-200 text-rose-700 text-[11px] font-bold px-2 py-0.5">
          {mission.areaLabel}
        </span>
        {done && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> 오늘의 미션 완료
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="text-[13px] text-slate-500 font-bold">오늘의 상황</div>
        <div className="mt-1 text-sm sm:text-base font-black text-[color:var(--navy)] leading-snug">
          “{mission.situation}”
        </div>
        <div className="mt-2 text-[13px] text-slate-700">이 상황에서 어떻게 말하면 좋을까요?</div>
      </div>

      {!done && !open && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl bg-rose-500 text-white font-bold text-sm px-4 py-2.5 hover:bg-rose-600 transition"
          >
            미션 도전하기
          </button>
        </div>
      )}

      {!done && open && (
        <div className="mt-4 space-y-2">
          <label className="block text-[12px] font-bold text-slate-600">
            상대의 기분을 생각하며 내가 실제로 할 말을 적어 보세요.
          </label>
          <textarea
            value={answer}
            onChange={(e) => handleDraftChange(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="예) 미안해, 다음에는 …"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400">{trimmed.length}자 작성</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs px-3 py-2 hover:bg-slate-50"
              >
                나중에
              </button>
              <button
                type="button"
                disabled={trimmed.length === 0 || submitting}
                onClick={handleSubmit}
                className="rounded-xl bg-rose-500 text-white font-bold text-xs px-4 py-2 disabled:opacity-50 hover:bg-rose-600 transition"
              >
                제출하고 피드백 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="text-[11px] font-bold text-slate-500 mb-1">내가 쓴 답변</div>
            <div
              className="text-[13px] text-slate-800 leading-relaxed"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {state.answer || "(작성한 답변이 없어요)"}
            </div>
          </div>

          {showAgain || !state.completedAt ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3 py-3">
              <div className="text-[11px] font-black text-emerald-700 mb-1">💡 바른말 피드백</div>
              <div
                className="text-[13px] text-slate-800 leading-relaxed"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {mission.entry.bot_reply}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAgain(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs px-3 py-2 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 피드백 다시 보기
            </button>
          )}

          <div className="text-[11px] text-slate-500">내일 새로운 미션이 열려요.</div>
        </div>
      )}
    </section>
  );
}
