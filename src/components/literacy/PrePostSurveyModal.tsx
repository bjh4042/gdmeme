import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SURVEY_ITEMS,
  DOMAIN_META,
  loadAnswer,
  saveAnswer,
  scoreByDomain,
  overallScore,
  type SurveyStage,
  type SurveyDomain,
} from "@/lib/pre-post-survey";

const LIKERT = [
  { v: 1, label: "전혀 아니에요" },
  { v: 2, label: "별로 아니에요" },
  { v: 3, label: "보통이에요" },
  { v: 4, label: "그런 편이에요" },
  { v: 5, label: "정말 그래요" },
];

export function PrePostSurveyModal({
  open,
  stage,
  studentId,
  classCode,
  onClose,
}: {
  open: boolean;
  stage: SurveyStage;
  studentId: string;
  classCode: string;
  onClose: () => void;
}) {
  const prior = useMemo(
    () => (open && studentId ? loadAnswer(classCode, studentId, stage) : undefined),
    [open, classCode, studentId, stage],
  );
  const [answers, setAnswers] = useState<Record<string, number>>(prior?.answers ?? {});

  useEffect(() => {
    if (open) setAnswers(prior?.answers ?? {});
  }, [open, prior]);

  if (!open) return null;

  const done = SURVEY_ITEMS.every((it) => typeof answers[it.id] === "number");
  const progress = SURVEY_ITEMS.filter((it) => typeof answers[it.id] === "number").length;

  const handleSubmit = () => {
    if (!done) {
      toast.warning("아직 답하지 않은 문항이 있어요.");
      return;
    }
    saveAnswer({
      stage,
      studentId,
      classCode,
      answers,
      submittedAt: new Date().toISOString(),
    });
    const dom = scoreByDomain(answers);
    toast.success(`${stage === "pre" ? "사전" : "사후"} 검사 저장 완료! (총점 ${overallScore(answers).toFixed(1)}/20)`, {
      description: (Object.keys(dom) as SurveyDomain[])
        .map((k) => `${DOMAIN_META[k].icon} ${DOMAIN_META[k].label} ${dom[k].toFixed(1)}`)
        .join(" · "),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[color:var(--mint-deep)]">
              {stage === "pre" ? "사전 검사 (Pre)" : "사후 검사 (Post)"}
            </div>
            <h3 className="text-lg font-black text-[color:var(--navy)]">🧭 나의 언어생활 자기 점검</h3>
          </div>
          <div className="text-xs font-bold text-slate-500 tabular-nums">
            {progress}/{SURVEY_ITEMS.length}
          </div>
        </header>

        <div className="px-4 py-3 text-[11px] text-slate-600 leading-relaxed bg-slate-50/60 border-b border-slate-100">
          솔직한 생각을 골라주세요. 정답은 없어요. 응답은 담임 선생님만 볼 수 있고, 이름 없이도 분석돼요.
        </div>

        <ol className="p-4 space-y-3">
          {SURVEY_ITEMS.map((item, i) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-2 mb-2">
                <span
                  className="inline-flex shrink-0 h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ background: DOMAIN_META[item.domain].color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {DOMAIN_META[item.domain].icon} {DOMAIN_META[item.domain].label}
                    {item.reverse ? " · 역채점" : ""}
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-snug">{item.text}</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {LIKERT.map((l) => {
                  const selected = answers[item.id] === l.v;
                  return (
                    <button
                      key={l.v}
                      type="button"
                      onClick={() => setAnswers((s) => ({ ...s, [item.id]: l.v }))}
                      className={`px-1 py-2 rounded-lg text-[11px] font-bold border transition ${
                        selected
                          ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)] border-[color:var(--navy)] scale-[1.02]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[color:var(--navy)]/50"
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="text-base leading-none">{l.v}</div>
                      <div className="mt-0.5 text-[9px] leading-tight">{l.label}</div>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <footer className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg bg-[color:var(--muted)] font-bold text-slate-600"
          >
            나중에 하기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!done}
            className="text-xs px-4 py-2 rounded-lg bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-black disabled:opacity-40"
          >
            {prior ? "다시 저장하기" : "제출하기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
