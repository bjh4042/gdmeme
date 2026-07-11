import { useEffect, useMemo, useRef, useState } from "react";
import { Send, ChevronLeft, Menu, Search } from "lucide-react";
import {
  AI_KNOWLEDGE,
  ASSISTANT_GREETING,
  QUICK_REPLIES,
  assistantReplyFor,
  type AssistantPatternTag,
} from "@/lib/ai-assistant-dataset";

type ChatMsg = {
  id: string;
  from: "bot" | "me";
  text: string;
  at: string;
  pattern?: AssistantPatternTag | null;
  category?: string;
};

const STORE_KEY = "wtmeme:assistant:v1";

function stamp() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h < 12 ? "오전" : "오후";
  const hh = ((h + 11) % 12) + 1;
  return `${ap} ${hh}:${m}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const patternBadge: Record<AssistantPatternTag, { label: string; bg: string }> = {
  패턴C: { label: "AI윤리", bg: "bg-red-500/80" },
  패턴A: { label: "어원/비속어", bg: "bg-amber-500/80" },
  패턴B: { label: "사이버괴롭힘", bg: "bg-indigo-500/80" },
  일반: { label: "일반", bg: "bg-slate-500/80" },
};

export function AssistantTab({ onXP }: { onXP?: (delta: number, kind: string, note?: string) => void }) {
  const initialGreeting = useMemo<ChatMsg>(
    () => ({ id: "greet", from: "bot", text: ASSISTANT_GREETING, at: stamp() }),
    [],
  );
  const [msgs, setMsgs] = useState<ChatMsg[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMsg[];
        if (Array.isArray(parsed) && parsed.length > 0) setMsgs(parsed);
      }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-100)));
    } catch {}
  }, [msgs]);

  // Auto-scroll to bottom on new messages / typing
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function send(rawText: string) {
    const text = rawText.trim();
    if (!text || typing) return;
    const me: ChatMsg = { id: makeId(), from: "me", text, at: stamp() };
    setMsgs((prev) => [...prev, me]);
    setInput("");
    setTyping(true);

    // Trigger the data-driven inference engine (with a brief natural delay)
    window.setTimeout(() => {
      const { reply, match } = assistantReplyFor(text, AI_KNOWLEDGE);
      const bot: ChatMsg = {
        id: makeId(),
        from: "bot",
        text: reply,
        at: stamp(),
        pattern: match?.pattern ?? null,
        category: match?.entry.category,
      };
      setMsgs((prev) => [...prev, bot]);
      setTyping(false);
      if (match && onXP) onXP(2, "assistant-hit", match.entry.category);
      inputRef.current?.focus();
    }, 480);
  }

  function reset() {
    if (!confirm("대화 내용을 모두 지우고 다시 시작할까요?")) return;
    setMsgs([{ ...initialGreeting, id: makeId(), at: stamp() }]);
  }

  return (
    <div className="rounded-3xl overflow-hidden border-2 border-[color:var(--navy)]/20 shadow-[var(--shadow-soft)] bg-[#1c1c1e]">
      {/* KakaoTalk-style dark header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#2a2a2c] border-b border-black/40 text-white">
        <button className="p-1 opacity-80 hover:opacity-100" aria-label="뒤로">
          <ChevronLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffe066] to-[#ffb703] grid place-items-center text-lg shadow-inner">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">AI 수호비서</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 국어·도덕 데이터셋 연결됨
          </div>
        </div>
        <button className="p-1 opacity-80 hover:opacity-100" aria-label="검색">
          <Search size={17} />
        </button>
        <button
          onClick={reset}
          className="p-1 opacity-80 hover:opacity-100"
          aria-label="대화 초기화"
          title="대화 초기화"
        >
          <Menu size={17} />
        </button>
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="h-[62vh] min-h-[420px] max-h-[720px] overflow-y-auto scroll-touch px-3 py-4 space-y-2 bg-[#1c1c1e]"
      >
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const showAvatar = m.from === "bot" && (!prev || prev.from !== "bot");
          return m.from === "bot" ? (
            <div key={m.id} className="flex items-end gap-2">
              {showAvatar ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffe066] to-[#ffb703] grid place-items-center text-base shrink-0">
                  🤖
                </div>
              ) : (
                <div className="w-8 h-8 shrink-0" />
              )}
              <div className="max-w-[78%]">
                {showAvatar && <div className="text-[11px] text-white/70 mb-0.5 ml-1">AI 수호비서</div>}
                {m.pattern && (
                  <div className="flex items-center gap-1 mb-1 ml-1">
                    <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${patternBadge[m.pattern].bg}`}>
                      {patternBadge[m.pattern].label}
                    </span>
                    {m.category && (
                      <span className="text-[10px] text-white/50 font-mono">{m.category}</span>
                    )}
                  </div>
                )}
                <div className="inline-block bg-white text-[#1c1c1e] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] shadow-sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.text}
                </div>
                <div className="text-[10px] text-white/40 mt-1 ml-1">{m.at}</div>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2 justify-end">
              <div className="text-[10px] text-white/40 mb-0.5">{m.at}</div>
              <div
                className="max-w-[78%] inline-block bg-[#fee500] text-[#1c1c1e] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13.5px] font-medium shadow-sm"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffe066] to-[#ffb703] grid place-items-center text-base shrink-0">🤖</div>
            <div className="bg-white text-[#1c1c1e] rounded-2xl rounded-tl-md px-3.5 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick-reply guide chips (horizontal scroll) */}
      <div className="bg-[#232325] border-t border-black/40 px-2 py-2">
        <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1" style={{ scrollbarWidth: "none" }}>
          <style>{`.assistant-chips::-webkit-scrollbar{display:none}`}</style>
          {QUICK_REPLIES.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.prompt)}
              disabled={typing}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-white text-[12px] font-bold border border-white/15 hover:bg-white/20 transition disabled:opacity-50"
              title={q.prompt}
            >
              <span>{q.icon}</span>
              <span className="whitespace-nowrap">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 bg-[#2a2a2c] px-3 py-2.5 border-t border-black/40"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="고운 말로 궁금한 유행어를 물어보세요…"
          className="flex-1 resize-none rounded-2xl bg-[#1c1c1e] text-white placeholder:text-white/40 px-3 py-2 text-sm outline-none border border-white/10 focus:border-emerald-400/60 max-h-32"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-[#fee500] text-[#1c1c1e] disabled:opacity-40 hover:scale-[1.05] transition"
          aria-label="전송"
        >
          <Send size={16} />
        </button>
      </form>

      {/* Footer note */}
      <div className="px-3 py-2 bg-[#1c1c1e] border-t border-black/40 text-[10px] text-white/40 text-center">
        데이터 주도형 엔진 · 지식 항목 {AI_KNOWLEDGE.length}개 로드됨 · 교사가 JSON 데이터셋을 확장하면 실시간 반영
      </div>
    </div>
  );
}