import { useMemo, useState } from "react";
import { Lightbulb, Send, Sparkles, Zap, Theater, RefreshCw, CheckCircle2, XCircle, ChevronLeft, Menu, Search } from "lucide-react";
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
      } else {
        onXP(0, "chat", `[${scenario.npc}] 정중한 답변 "${text}"`);
      }
      return;
    }

    // Wrong path — pick feedback array by cause, index by wrongCount
    const idx = Math.min(wrongCount, 2);
    let tpl: string;
    let delta = 0;
    let cause = "부적절";
    if (meme) {
      tpl = MEME_FEEDBACK[idx];
      delta = -25;
      cause = `밈/비속어(${meme})`;
    } else if (short) {
      tpl = SHORT_FEEDBACK[idx];
      delta = -8;
      cause = "너무 짧음";
    } else {
      tpl = IMPOLITE_FEEDBACK[idx];
      delta = -12;
      cause = "예절 미흡";
    }
    setMood((v) => Math.max(0, v + delta));
    const nextWrong = wrongCount + 1;
    setWrongCount(nextWrong);
    pushNpc(fill(tpl, meme ?? text, scenario.goodExampleHint), meme ? "danger" : "warn");
    onXP(
      0,
      "chat",
      `[${scenario.npc}] "${text}" · ${cause} · 오답 ${nextWrong}회`,
    );
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

      {/* KakaoTalk-themed chat room */}
      <div className="rounded-3xl overflow-hidden flex flex-col min-h-[600px] shadow-[var(--shadow-soft)] border border-white/60" style={{ background: "#B2C7D9" }}>
        {/* Top bar (KakaoTalk style) */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 bg-[#A2B8CB] text-[#1a1a1a]">
          <button className="p-1 rounded hover:bg-black/5" aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 text-center">
            <div className="font-bold truncate text-sm">{scenario.npc}</div>
            <div className="text-[10px] opacity-70">성취기준 4국01-02 · 대화 예절</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1" title={`대화 분위기 ${mood}점`}>
              <span className="text-lg">{moodEmoji}</span>
              <div className="w-16 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${mood}%`, background: mood >= 40 ? "#22c55e" : "#ef4444" }}
                />
              </div>
            </div>
            <button className="p-1 rounded hover:bg-black/5" aria-label="검색"><Search size={18} /></button>
            <button className="p-1 rounded hover:bg-black/5" aria-label="메뉴"><Menu size={18} /></button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          <div className="mx-auto w-fit text-[10px] px-3 py-0.5 rounded-full bg-black/15 text-white/95 font-medium">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </div>
          {msgs.map((m, i) => (
            <div key={i} className={`flex animate-fade-in ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              {m.from === "sys" ? (
                <div className="mx-auto text-[11px] px-3 py-1 rounded-full bg-white/85 text-[color:var(--navy)] font-bold shadow-sm">
                  {m.text}
                </div>
              ) : m.from === "npc" ? (
                <div className="flex items-end gap-1.5 max-w-[80%]">
                  <div className="w-9 h-9 shrink-0 rounded-2xl bg-white grid place-items-center text-lg shadow-sm border border-white">
                    {scenario.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-black/70 mb-0.5 ml-1">{scenario.npc}</div>
                    <div
                      className={`px-3 py-2 rounded-2xl rounded-tl-md text-sm shadow-sm break-words ${
                        m.tone === "danger"
                          ? "bg-red-100 text-[color:var(--navy)] border border-red-300"
                          : m.tone === "warn"
                          ? "bg-amber-100 text-[color:var(--navy)] border border-amber-300"
                          : "bg-white text-[#111]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tr-md text-sm shadow-sm break-words text-[#111]"
                  style={{ background: "#FEE500" }}
                >
                  {m.text}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Guide (always visible above input) */}
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-2xl bg-white/95 border border-white px-3 py-2 text-xs text-[color:var(--navy)] shadow-sm">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-[color:var(--warn)]" />
          <div className="min-w-0">
            <b>💡 가이드:</b> {scenario.guide}
            <div className="text-[11px] text-muted-foreground mt-0.5">예시 → "{scenario.goodExampleHint}"</div>
          </div>
        </div>

        {/* Input bar (KakaoTalk style) */}
        <div className="p-2 bg-white grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-center border-t border-black/5">
          <button className="w-9 h-9 grid place-items-center rounded-full text-xl text-black/40 hover:bg-black/5" aria-label="추가">+</button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="바른 말로 답장해 보세요..."
            className="min-w-0 rounded-full bg-[#F1F2F4] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)] transition"
          />
          <button
            onClick={send}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-4 py-2 text-sm font-bold hover:scale-[1.03] active:scale-95 transition"
          >
            <Send size={14} /> 전송
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