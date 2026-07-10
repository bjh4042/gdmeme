import { useMemo, useState } from "react";
import { SCENARIOS, QUIZZES, MEME_TRIGGERS, type Scenario } from "@/lib/literacy-seed";

type Msg = { from: "npc" | "me" | "sys"; text: string };

function containsMeme(text: string) {
  return MEME_TRIGGERS.find((m) => text.includes(m));
}

function passesPoliteCheck(text: string) {
  const t = text.trim();
  if (t.length < 6) return false;
  if (containsMeme(t)) return false;
  // simple heuristic: contains a polite ending
  return /(요\.?|니다\.?|습니다|하겠습니다|드릴게요|감사합니다|죄송합니다|반가워|안녕하)/.test(t);
}

export function ChatbotTab({ onXP }: { onXP: (delta: number, kind: string, note?: string) => void }) {
  const [mode, setMode] = useState<"roleplay" | "quiz">("roleplay");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 rounded-2xl bg-[color:var(--muted)] w-fit mx-auto">
        <button
          onClick={() => setMode("roleplay")}
          className={`px-5 py-2 rounded-xl font-bold text-sm transition ${mode === "roleplay" ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]" : "text-[color:var(--navy)]"}`}
        >
          🎭 상황별 역할극
        </button>
        <button
          onClick={() => setMode("quiz")}
          className={`px-5 py-2 rounded-xl font-bold text-sm transition ${mode === "quiz" ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]" : "text-[color:var(--navy)]"}`}
        >
          ⚡ 밈 스피드 퀴즈
        </button>
      </div>
      {mode === "roleplay" ? <Roleplay onXP={onXP} /> : <Quiz onXP={onXP} />}
    </div>
  );
}

function Roleplay({ onXP }: { onXP: (d: number, k: string, n?: string) => void }) {
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "npc", text: SCENARIOS[0].opening }]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState(80); // 0~100
  const [cleared, setCleared] = useState(false);

  function pickScenario(s: Scenario) {
    setScenario(s);
    setMsgs([{ from: "npc", text: s.opening }]);
    setMood(80);
    setCleared(false);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [...m, { from: "me", text }]);
    const meme = containsMeme(text);
    if (meme) {
      const newMood = Math.max(0, mood - 25);
      setMood(newMood);
      setTimeout(() => {
        setMsgs((m) => [
          ...m,
          {
            from: "npc",
            text: `"${meme}" 라는 표현은 상황과 상대방의 예절에 어긋나서 속상해. 상대방을 배려하는 바른 표준어 문장으로 고쳐서 다시 말해볼래?`,
          },
        ]);
      }, 400);
      return;
    }
    if (passesPoliteCheck(text)) {
      setMood((v) => Math.min(100, v + 15));
      setTimeout(() => {
        setMsgs((m) => [
          ...m,
          { from: "npc", text: "고마워! 그렇게 예의 바르게 말해줘서 마음이 따뜻해졌어. ✨" },
          { from: "sys", text: "✅ 대화 예절 통과! +15 XP" },
        ]);
        if (!cleared) {
          onXP(15, "roleplay", scenario.id);
          setCleared(true);
        }
      }, 400);
    } else {
      setTimeout(() => {
        setMsgs((m) => [
          ...m,
          {
            from: "npc",
            text: `조금 짧거나 예의를 담은 문장이 아닌 것 같아. 예시: "${scenario.goodExampleHint}"`,
          },
        ]);
      }, 400);
    }
  }

  const moodEmoji = mood >= 70 ? "😊" : mood >= 40 ? "😐" : mood >= 20 ? "😢" : "😠";

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl bg-card border-2 border-[color:var(--border)] p-3 space-y-2">
        <div className="text-xs font-bold text-muted-foreground px-2">상황 고르기</div>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => pickScenario(s)}
            className={`w-full text-left px-3 py-2 rounded-xl font-medium text-sm transition ${scenario.id === s.id ? "bg-[color:var(--mint)] text-[color:var(--navy)]" : "hover:bg-[color:var(--muted)]"}`}
          >
            <span className="mr-2">{s.emoji}</span>
            {s.npc}
          </button>
        ))}
      </aside>
      <div className="rounded-2xl bg-card border-2 border-[color:var(--border)] overflow-hidden flex flex-col min-h-[520px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 border-b bg-[color:var(--muted)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-4xl shrink-0">{scenario.emoji}</div>
            <div className="min-w-0">
              <div className="font-bold text-[color:var(--navy)] truncate">{scenario.npc}</div>
              <div className="text-xs text-muted-foreground">성취기준 4국01-02 · 대화 예절</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl">{moodEmoji}</div>
            <div className="w-24 h-2 rounded-full bg-white overflow-hidden mt-1">
              <div
                className="h-full transition-all"
                style={{ width: `${mood}%`, background: mood >= 40 ? "var(--safe)" : "var(--danger)" }}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              {m.from === "sys" ? (
                <div className="mx-auto text-xs px-3 py-1 rounded-full bg-[color:var(--safe)]/20 text-[color:var(--navy)]">
                  {m.text}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    m.from === "me"
                      ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)] rounded-br-sm"
                      : "bg-[color:var(--muted)] text-[color:var(--navy)] rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-3 border-t bg-white grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="바른 말로 답장해 보세요..."
            className="min-w-0 rounded-xl border-2 border-[color:var(--border)] px-4 py-3 outline-none focus:border-[color:var(--mint-deep)]"
          />
          <button
            onClick={send}
            className="shrink-0 rounded-xl bg-[color:var(--mint-deep)] text-white px-5 font-bold"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function Quiz({ onXP }: { onXP: (d: number, k: string, n?: string) => void }) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = useMemo(() => QUIZZES[idx % QUIZZES.length], [idx]);

  function pick(i: number) {
    if (chosen !== null) return;
    setChosen(i);
    if (i === q.answer) {
      setScore((s) => s + 1);
      onXP(10, "quiz", q.q);
    }
  }
  function next() {
    setChosen(null);
    setIdx((v) => v + 1);
  }

  return (
    <div className="max-w-2xl mx-auto rounded-2xl bg-card border-2 border-[color:var(--border)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-muted-foreground">문제 {idx + 1}</div>
        <div className="text-sm font-bold text-[color:var(--mint-deep)]">✨ 맞힌 개수 {score}</div>
      </div>
      <h3 className="text-xl font-bold text-[color:var(--navy)]">{q.q}</h3>
      <div className="grid gap-2">
        {q.choices.map((c, i) => {
          const isRight = chosen !== null && i === q.answer;
          const isWrong = chosen === i && i !== q.answer;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className={`text-left px-4 py-3 rounded-xl border-2 font-medium transition ${
                isRight
                  ? "border-[color:var(--safe)] bg-[color:var(--safe)]/20"
                  : isWrong
                  ? "border-[color:var(--danger)] bg-[color:var(--danger)]/10"
                  : "border-[color:var(--border)] hover:border-[color:var(--mint-deep)]"
              }`}
            >
              {i + 1}. {c}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className="rounded-xl bg-[color:var(--muted)] p-4 text-sm text-[color:var(--navy)]">
          <b>{chosen === q.answer ? "정답! +10 XP" : "아쉬워요"}</b> — {q.explain}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={next}
          disabled={chosen === null}
          className="rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-5 py-2 font-bold disabled:opacity-40"
        >
          다음 문제 →
        </button>
      </div>
    </div>
  );
}