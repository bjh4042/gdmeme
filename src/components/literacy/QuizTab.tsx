import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Sparkles, Zap, Timer, Trophy, Play } from "lucide-react";
import { QUIZZES, type QuizItem } from "@/lib/literacy-seed";
import type { DictEntry } from "@/lib/literacy-types";
import { useDebouncedAction } from "@/lib/use-debounced-action";
import QUIZ_BANK_50 from "@/lib/quiz-bank-50.json";
import { summarizeQuiz, DOMAIN_LABEL, type QuizDomain } from "@/lib/quiz-feedback";

type BankItem = {
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  domain?: QuizDomain;
};

type Question = {
  kind: "mc";
  q: string;
  choices: string[];
  answerText: string;
  explain: string;
  domain?: QuizDomain;
};

const TIME_LIMIT = 15; // seconds per question

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(_dict: DictEntry[]): Question[] {
  // Fisher-Yates shuffle 전체 50문항 마스터 풀 → 상위 10개 추출
  const picked = shuffle(QUIZ_BANK_50 as BankItem[]).slice(0, 10);
  return picked.map((item) => ({
    kind: "mc" as const,
    q: item.question,
    // 렌더링 직전에도 셔플되지만, 사전에 한 번 더 섞어서 배열 순서 자체를 무작위화
    choices: shuffle(item.options),
    answerText: item.answer,
    explain: item.explanation,
    domain: item.domain,
  }));
}

export function QuizTab({
  dict,
  onXP,
}: {
  dict: DictEntry[];
  onXP: (delta: number, kind: string, note?: string) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [deck, setDeck] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<null | "right" | "wrong" | "timeup">(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [flash, setFlash] = useState<null | "right" | "wrong">(null);
  const [results, setResults] = useState<{ domain?: QuizDomain; correct: boolean }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = deck[idx];

  function start() {
    setDeck(buildDeck(dict));
    setIdx(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setChosen(null);
    setTyped("");
    setResult(null);
    setTimeLeft(TIME_LIMIT);
    setResults([]);
    setPhase("play");
  }

  // Timer
  useEffect(() => {
    if (phase !== "play" || result) return;
    if (timeLeft <= 0) {
      setResult("timeup");
      setCombo(0);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 0.1), 100);
    return () => clearTimeout(t);
  }, [phase, timeLeft, result]);

  // Reset per question
  useEffect(() => {
    if (phase !== "play") return;
    setChosen(null);
    setTyped("");
    setResult(null);
    setTimeLeft(TIME_LIMIT);
  }, [idx, phase, q?.kind]);

  function markResult(ok: boolean) {
    setResult(ok ? "right" : "wrong");
    setFlash(ok ? "right" : "wrong");
    setTimeout(() => setFlash(null), 500);
    setResults((prev) => [...prev, { domain: q?.domain, correct: ok }]);
    if (ok) {
      const bonus = 10 + Math.floor(timeLeft) + combo * 2;
      setScore((s) => s + bonus);
      setCombo((c) => {
        const n = c + 1;
        setMaxCombo((m) => Math.max(m, n));
        return n;
      });
      onXP(10 + Math.floor(timeLeft / 3), "quiz", q?.kind === "mc" ? q.q : q?.q ?? "");
    } else {
      setCombo(0);
    }
  }

  function pickMC(i: number) {
    if (result || q?.kind !== "mc") return;
    setChosen(i);
    // 셔플된 보기여도 텍스트로 정답 매칭 → 안정적 크로스 체크
    const picked = q.choices[i];
    markResult(picked === q.answerText);
  }
  function submitFill() {
    // 50-bank는 전 문항이 4지선다이므로 단답형 경로는 사용하지 않음
    return;
  }

  // 500ms 리딩 엣지 스로틀 → 연타 시 XP 중복/이중 채점 방어
  const pickMCDebounced = useDebouncedAction(pickMC, 500);
  const submitFillDebounced = useDebouncedAction(submitFill, 500);
  function next() {
    if (idx + 1 >= deck.length) {
      setPhase("done");
    } else {
      setIdx((v) => v + 1);
    }
  }

  if (phase === "intro") {
    return (
      <div data-tour="quiz" className="animate-fade-in max-w-2xl mx-auto glass-card p-8 text-center space-y-4">
        <div className="text-6xl">⚡</div>
        <h2 className="text-3xl font-black text-[color:var(--navy)]">스피드 퀴즈</h2>
        <p className="text-sm text-muted-foreground">
          내장 사전과 밈 순화 문제를 무작위로 출제해요. 시간이 흐르기 전 정답을 맞혀 학급 XP를 모아보세요!
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-[color:var(--navy)] max-w-md mx-auto">
          <div className="rounded-xl bg-white/70 p-3"><Timer className="inline text-[color:var(--warn)]" size={16} /><br />15초 타이머</div>
          <div className="rounded-xl bg-white/70 p-3"><Zap className="inline text-[color:var(--mint-deep)]" size={16} /><br />콤보 보너스</div>
          <div className="rounded-xl bg-white/70 p-3"><Trophy className="inline text-[color:var(--warn)]" size={16} /><br />학급 XP 누적</div>
        </div>
        <button
          onClick={start}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-8 py-3 font-black shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition text-lg"
        >
          <Play size={18} /> 우리말 수호 퀴즈 시작!
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const total = deck.length;
    return (
      <div className="animate-scale-in max-w-2xl mx-auto glass-card p-8 text-center space-y-4">
        <div className="text-6xl">🏆</div>
        <h2 className="text-3xl font-black text-[color:var(--navy)]">퀴즈 완료!</h2>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <div className="rounded-2xl bg-white/70 p-4">
            <div className="text-xs text-muted-foreground font-bold">획득 점수</div>
            <div className="text-3xl font-black text-[color:var(--mint-deep)]">{score}</div>
          </div>
          <div className="rounded-2xl bg-white/70 p-4">
            <div className="text-xs text-muted-foreground font-bold">최대 콤보</div>
            <div className="text-3xl font-black text-[color:var(--warn)]">x{maxCombo}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">총 {total}문제 도전 완료. 학급 XP에 반영되었어요.</p>
        <button
          onClick={start}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-6 py-3 font-black shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
        >
          <RefreshCw size={16} /> 다시 도전
        </button>
      </div>
    );
  }

  if (!q) return null;

  const timePct = Math.max(0, (timeLeft / TIME_LIMIT) * 100);
  const timeColor = timeLeft > 8 ? "var(--safe)" : timeLeft > 4 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      {/* HUD */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-soft px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-bold">문제</div>
          <div className="text-lg font-black text-[color:var(--navy)]">{idx + 1}/{deck.length}</div>
        </div>
        <div className="glass-soft px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-bold">점수</div>
          <div className="text-lg font-black text-[color:var(--mint-deep)]">{score}</div>
        </div>
        <div className="glass-soft px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground font-bold">콤보</div>
          <div className="text-lg font-black text-[color:var(--warn)]">x{combo}</div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-3 rounded-full bg-white/60 overflow-hidden shadow-inner">
        <div
          className="h-full transition-all duration-100"
          style={{ width: `${timePct}%`, background: timeColor }}
        />
      </div>

      {/* Question card */}
      <div
        className={`glass-card p-6 space-y-4 transition ${
          flash === "right" ? "ring-4 ring-[color:var(--safe)]" : flash === "wrong" ? "ring-4 ring-[color:var(--danger)]" : ""
        }`}
      >
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[color:var(--mint)]/50 text-[color:var(--mint-deep)]">
          {q.kind === "mc" ? <><Sparkles size={12} /> 뜻 매칭 · 객관식</> : <><Zap size={12} /> 순화어 · 단답형</>}
        </div>
        <h3 className="text-xl font-black text-[color:var(--navy)]">{q.q}</h3>

        {q.kind === "mc" ? (
          <div className="grid gap-2">
            {q.choices.map((c, i) => {
              const isRight = result && c === q.answerText;
              const isWrong = chosen === i && c !== q.answerText;
              const isChosen = chosen === i;
              return (
                <button
                  key={i}
                  onClick={() => pickMCDebounced(i)}
                  disabled={result !== null}
                  aria-pressed={isChosen}
                  className={`text-left px-4 py-3 rounded-2xl border-[3px] font-medium transition inline-flex items-center gap-2 disabled:cursor-not-allowed ${
                    isRight
                      ? "border-[color:var(--safe)] bg-[color:var(--safe)]/20 text-[color:var(--navy)]"
                      : isWrong
                      ? "border-[color:var(--danger)] bg-[color:var(--danger)]/10 text-[color:var(--navy)]"
                      : isChosen
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md scale-[1.01]"
                      : "border-white/70 bg-white/60 hover:border-[color:var(--mint-deep)] hover:bg-white active:border-indigo-600 active:bg-indigo-50"
                  }`}
                >
                  {isRight && <CheckCircle2 size={16} className="text-[color:var(--safe)]" />}
                  {isWrong && <XCircle size={16} className="text-[color:var(--danger)]" />}
                  <span>{i + 1}. {c}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitFillDebounced();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={result !== null}
              placeholder="바른 우리말 순화어를 입력..."
              className="flex-1 rounded-2xl border-2 border-white/70 bg-white/70 px-4 py-3 text-base outline-none focus:border-[color:var(--mint-deep)] transition disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={result !== null}
              className="rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-5 py-3 font-bold disabled:opacity-40"
            >
              제출
            </button>
          </form>
        )}

        {result && (
          <div className="rounded-2xl bg-white/70 p-4 text-sm text-[color:var(--navy)] animate-fade-in">
            <b className={result === "right" ? "text-[color:var(--safe)]" : "text-[color:var(--danger)]"}>
              {result === "right" ? "🎉 정답! +XP" : result === "timeup" ? "⏰ 시간 초과!" : "❌ 아쉬워요"}
            </b>{" "}
            — {q.explain}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={next}
            disabled={!result}
            className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-5 py-2 font-bold disabled:opacity-40 shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
          >
            <RefreshCw size={14} /> {idx + 1 >= deck.length ? "결과 보기" : "다음 문제"}
          </button>
        </div>
      </div>
    </div>
  );
}