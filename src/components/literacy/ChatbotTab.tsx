import { useMemo, useState } from "react";
import { Lightbulb, Send, Sparkles, Zap, Theater, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import {
  SCENARIOS,
  QUIZZES,
  MEME_TRIGGERS,
  MEME_FEEDBACK,
  SHORT_FEEDBACK,
  IMPOLITE_FEEDBACK,
  PRAISE_FEEDBACK,
  type Scenario,
} from "@/lib/literacy-seed";

type Msg = { from: "npc" | "me" | "sys"; text: string; tone?: "safe" | "warn" | "danger" };

function containsMeme(text: string) {
  return MEME_TRIGGERS.find((m) => text.includes(m));
}
function isPolite(text: string) {
  const t = text.trim();
  if (t.length < 6) return false;
  if (containsMeme(t)) return false;
  return /(요\.?|니다\.?|습니다|하겠습니다|드릴게요|감사합니다|죄송합니다|반가워|안녕하)/.test(t);
}
function fill(tpl: string, word: string, hint: string) {
  return tpl.replace("{word}", word).replace("{hint}", hint);
}

export function ChatbotTab({ onXP }: { onXP: (delta: number, kind: string, note?: string) => void }) {
  const [mode, setMode] = useState<"roleplay" | "quiz">("roleplay");
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-soft p-1.5 flex gap-1 w-fit mx-auto">
        {[
          { id: "roleplay", icon: <Theater size={16} />, label: "상황별 역할극" },
          { id: "quiz", icon: <Zap size={16} />, label: "밈 스피드 퀴즈" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id as "roleplay" | "quiz")}
            className={`px-5 py-2 rounded-2xl font-bold text-sm inline-flex items-center gap-2 transition ${
              mode === t.id
                ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)] shadow-[var(--shadow-soft)]"
                : "text-[color:var(--navy)] hover:bg-white/60"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {mode === "roleplay" ? <Roleplay onXP={onXP} /> : <Quiz onXP={onXP} />}
    </div>
  );
}

function Roleplay({ onXP }: { onXP: (d: number, k: string, n?: string) => void }) {
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "npc", text: SCENARIOS[0].opening }]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState(80);
  const [wrongCount, setWrongCount] = useState(0);
  const [cleared, setCleared] = useState(false);

  function pickScenario(s: Scenario) {
    setScenario(s);
    setMsgs([{ from: "npc", text: s.opening }]);
    setMood(80);
    setWrongCount(0);
    setCleared(false);
  }

  function pushNpc(text: string, tone?: "safe" | "warn" | "danger") {
    setTimeout(() => setMsgs((m) => [...m, { from: "npc", text, tone }]), 380);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [...m, { from: "me", text }]);

    const meme = containsMeme(text);
    const short = text.length < 6;
    const polite = isPolite(text);

    if (polite && !meme) {
      setMood((v) => Math.min(100, v + 15));
      setWrongCount(0);
      const praise = PRAISE_FEEDBACK[Math.floor(Math.random() * PRAISE_FEEDBACK.length)];
      pushNpc(praise, "safe");
      setTimeout(() => setMsgs((m) => [...m, { from: "sys", text: "✅ 대화 예절 통과! +15 XP" }]), 800);
      if (!cleared) {
        onXP(15, "roleplay", scenario.id);
        setCleared(true);
      }
      return;
    }

    // Wrong path — pick feedback array by cause, index by wrongCount
    const idx = Math.min(wrongCount, 2);
    let tpl: string;
    let delta = 0;
    if (meme) {
      tpl = MEME_FEEDBACK[idx];
      delta = -25;
    } else if (short) {
      tpl = SHORT_FEEDBACK[idx];
      delta = -8;
    } else {
      tpl = IMPOLITE_FEEDBACK[idx];
      delta = -12;
    }
    setMood((v) => Math.max(0, v + delta));
    setWrongCount((c) => c + 1);
    pushNpc(fill(tpl, meme ?? text, scenario.goodExampleHint), meme ? "danger" : "warn");
  }

  const moodEmoji = mood >= 70 ? "😊" : mood >= 40 ? "😐" : mood >= 20 ? "😢" : "😠";

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="glass-card p-3 space-y-2 h-fit">
        <div className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
          <Theater size={12} /> 상황 고르기
        </div>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => pickScenario(s)}
            className={`w-full text-left px-3 py-2.5 rounded-2xl font-medium text-sm transition ${
              scenario.id === s.id
                ? "bg-gradient-to-r from-[color:var(--mint)] to-[color:var(--accent)] text-[color:var(--navy)] shadow-[var(--shadow-soft)]"
                : "hover:bg-white/60"
            }`}
          >
            <span className="mr-2 text-lg">{s.emoji}</span>
            {s.npc}
          </button>
        ))}
      </aside>

      <div className="glass-card overflow-hidden flex flex-col min-h-[560px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 border-b border-white/60 bg-white/40">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-4xl shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--mint)] to-[color:var(--accent)]">
              {scenario.emoji}
            </div>
            <div className="min-w-0">
              <div className="font-black text-[color:var(--navy)] truncate">{scenario.npc}</div>
              <div className="text-xs text-muted-foreground">성취기준 4국01-02 · 대화 예절</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl">{moodEmoji}</div>
            <div className="w-28 h-2 rounded-full bg-white/70 overflow-hidden mt-1">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${mood}%`, background: mood >= 40 ? "var(--safe)" : "var(--danger)" }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`flex animate-fade-in ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              {m.from === "sys" ? (
                <div className="mx-auto text-xs px-3 py-1.5 rounded-full bg-[color:var(--safe)]/25 text-[color:var(--navy)] font-bold">
                  {m.text}
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    m.from === "me"
                      ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)] rounded-br-md"
                      : m.tone === "danger"
                      ? "bg-[color:var(--danger)]/15 text-[color:var(--navy)] rounded-bl-md border border-[color:var(--danger)]/30"
                      : m.tone === "warn"
                      ? "bg-[color:var(--warn)]/25 text-[color:var(--navy)] rounded-bl-md border border-[color:var(--warn)]/40"
                      : "bg-white/80 text-[color:var(--navy)] rounded-bl-md border border-white/60"
                  }`}
                >
                  {m.text}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Guide */}
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--mint)]/60 to-[color:var(--accent)]/50 border border-white/60 px-3 py-2 text-xs text-[color:var(--navy)]">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-[color:var(--mint-deep)]" />
          <div className="min-w-0">
            <b>가이드:</b> {scenario.guide}
            <div className="text-[11px] text-muted-foreground mt-0.5">예시 → "{scenario.goodExampleHint}"</div>
          </div>
        </div>

        <div className="p-3 border-t border-white/60 bg-white/50 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="바른 말로 답장해 보세요..."
            className="min-w-0 rounded-2xl border-2 border-white/70 bg-white/80 px-4 py-3 outline-none focus:border-[color:var(--mint-deep)] transition"
          />
          <button
            onClick={send}
            className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--mint-deep)] text-white px-5 font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
          >
            <Send size={16} /> 전송
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
    <div className="max-w-2xl mx-auto glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-muted-foreground inline-flex items-center gap-1">
          <Zap size={14} className="text-[color:var(--mint-deep)]" /> 문제 {idx + 1}
        </div>
        <div className="text-sm font-bold text-[color:var(--mint-deep)] inline-flex items-center gap-1">
          <Sparkles size={14} /> 맞힌 개수 {score}
        </div>
      </div>
      <h3 className="text-xl font-black text-[color:var(--navy)]">{q.q}</h3>
      <div className="grid gap-2">
        {q.choices.map((c, i) => {
          const isRight = chosen !== null && i === q.answer;
          const isWrong = chosen === i && i !== q.answer;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className={`text-left px-4 py-3 rounded-2xl border-2 font-medium transition inline-flex items-center gap-2 ${
                isRight
                  ? "border-[color:var(--safe)] bg-[color:var(--safe)]/20"
                  : isWrong
                  ? "border-[color:var(--danger)] bg-[color:var(--danger)]/10"
                  : "border-white/70 bg-white/60 hover:border-[color:var(--mint-deep)] hover:bg-white"
              }`}
            >
              {isRight && <CheckCircle2 size={16} className="text-[color:var(--safe)]" />}
              {isWrong && <XCircle size={16} className="text-[color:var(--danger)]" />}
              <span>{i + 1}. {c}</span>
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className="rounded-2xl bg-white/60 backdrop-blur p-4 text-sm text-[color:var(--navy)] animate-fade-in">
          <b>{chosen === q.answer ? "정답! +10 XP" : "아쉬워요"}</b> — {q.explain}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={next}
          disabled={chosen === null}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-5 py-2 font-bold disabled:opacity-40 shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
        >
          <RefreshCw size={14} /> 다음 문제
        </button>
      </div>
    </div>
  );
}