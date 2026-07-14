import { useMemo, useState } from "react";
import type { DictEntry } from "@/lib/literacy-types";
import { submitAnswer } from "@/lib/weekly-survey";

/**
 * 주간 언어생활 성찰 팝업 설문 (월/금 자동 트리거).
 * "들었어요?" → 예/아니오 → 세부 응답 → 학급 언어 기상도에 즉시 반영.
 */
export function WeeklySurveyModal({
  classCode,
  studentId,
  studentName,
  dict,
  onClose,
}: {
  classCode: string;
  studentId: string;
  studentName: string;
  dict: DictEntry[];
  onClose: () => void;
}) {
  const [heard, setHeard] = useState<null | boolean>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [count, setCount] = useState<string>("");
  const [done, setDone] = useState(false);

  const options = useMemo(() => {
    const approved = dict
      .filter((d) => d.status === "approved")
      .sort((a, b) => (b.total_harmful_score ?? 0) - (a.total_harmful_score ?? 0))
      .slice(0, 12);
    return approved.map((d) => d.word);
  }, [dict]);

  function toggle(word: string) {
    setSelected((s) => (s.includes(word) ? s.filter((w) => w !== word) : [...s, word]));
  }

  function handleSubmit() {
    if (heard === null) return;
    const words = [
      ...selected,
      ...freeText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ];
    const n = Number(count);
    submitAnswer(classCode, studentId, {
      heard,
      words: heard ? words : undefined,
      count: heard ? (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0) : undefined,
    });
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="이번 주 우리 반 언어생활 성찰 설문"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-white/60 p-6 animate-scale-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-[color:var(--mint-deep)] uppercase">
              주간 성찰 설문
            </div>
            <h2 className="text-lg font-black text-[color:var(--navy)] mt-1">
              🗓️ 이번 주 우리 반 언어생활 성찰
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              {studentName} 학생의 응답은 <b>익명 통계</b>로 우리 반 언어 기상도에 반영돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-slate-100 text-slate-500"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-2">🌤️</div>
            <div className="text-sm font-bold text-[color:var(--navy)]">
              응답이 반영되었어요. 고마워요!
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-bold text-[color:var(--navy)] mb-3">
                이번 주 교실에서 밈이나 신조어, 나쁜 말을 들은 적이 있나요?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHeard(false)}
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition ${
                    heard === false
                      ? "bg-emerald-500 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-emerald-400"
                  }`}
                >
                  🙅 아니오, 못 들었어요
                </button>
                <button
                  type="button"
                  onClick={() => setHeard(true)}
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition ${
                    heard === true
                      ? "bg-amber-500 border-amber-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-amber-400"
                  }`}
                >
                  🙋 예, 들었어요
                </button>
              </div>
            </div>

            {heard === true && (
              <div className="mt-3 space-y-3 animate-fade-in">
                <div className="rounded-2xl bg-white border border-slate-200 p-3">
                  <div className="text-xs font-bold text-[color:var(--navy)] mb-2">
                    어떤 말을 들었나요?
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {options.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        등록된 단어가 아직 없어요.
                      </span>
                    )}
                    {options.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => toggle(w)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                          selected.includes(w)
                            ? "bg-[color:var(--navy)] text-white border-[color:var(--navy)]"
                            : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <input
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder="직접 입력 (쉼표로 구분)"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[color:var(--navy)]"
                  />
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-3">
                  <label className="text-xs font-bold text-[color:var(--navy)] block mb-1">
                    몇 번 정도 들었나요? (숫자)
                  </label>
                  <input
                    inputMode="numeric"
                    value={count}
                    onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="예: 3"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-[color:var(--navy)]"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={heard === null}
              className="mt-4 w-full py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-lg disabled:opacity-40 hover:opacity-90 transition"
            >
              응답 제출하기
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              응답은 이번 주 한 번만 반영됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
