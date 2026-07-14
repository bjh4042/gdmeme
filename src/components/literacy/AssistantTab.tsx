import { useEffect, useMemo, useRef, useState } from "react";
import { Send, ChevronLeft, Menu, Search } from "lucide-react";
import {
  AI_KNOWLEDGE,
  pickFallback,
  ASSISTANT_GREETING,
  QUICK_REPLIES,
  type AssistantPatternTag,
} from "@/lib/ai-assistant-dataset";
import { type CyberEthicsSolution } from "@/lib/cyber-ethics-dataset";
import { searchAssistant, getRelatedGuides, type GuideChip } from "@/lib/assistant-search";

type ChatMsg = {
  id: string;
  from: "bot" | "me";
  text: string;
  at: string;
  pattern?: AssistantPatternTag | null;
  category?: string;
  solution?: CyberEthicsSolution | null;
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

export function AssistantTab({
  onXP,
}: {
  onXP?: (delta: number, kind: string, note?: string) => void;
}) {
  const initialGreeting = useMemo<ChatMsg>(
    () => ({ id: "greet", from: "bot", text: ASSISTANT_GREETING, at: stamp() }),
    [],
  );
  const [msgs, setMsgs] = useState<ChatMsg[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [dynamicChips, setDynamicChips] = useState<GuideChip[] | null>(null);
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
    } catch {
      /* storage/parse 실패 무시 */
    }
  }, []);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-100)));
    } catch {
      /* storage/parse 실패 무시 */
    }
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

    // 전역 다중 스코어링 검색 엔진 (사이버 윤리 + 밈/어원 통합)
    window.setTimeout(() => {
      const hit = searchAssistant(text, 1);
      let bot: ChatMsg;
      if (hit && hit.kind === "cyber") {
        bot = {
          id: makeId(),
          from: "bot",
          text: hit.entry.bot_response.title,
          at: stamp(),
          solution: hit.entry.bot_response,
          category: hit.category,
        };
        if (onXP) onXP(2, "assistant-cyber", hit.category);
      } else if (hit && hit.kind === "meme") {
        bot = {
          id: makeId(),
          from: "bot",
          text: hit.entry.bot_reply,
          at: stamp(),
          pattern: hit.pattern,
          category: hit.category,
        };
        if (onXP) onXP(2, "assistant-hit", hit.category);
      } else {
        bot = {
          id: makeId(),
          from: "bot",
          text: pickFallback(),
          at: stamp(),
          pattern: null,
        };
      }
      setMsgs((prev) => [...prev, bot]);
      setTyping(false);
      // 대화 맥락 연동형 가이드 칩 실시간 갱신
      if (hit) {
        const related = getRelatedGuides(hit, 4);
        setDynamicChips(related.length > 0 ? related : null);
      }
      inputRef.current?.focus();
    }, 480);
  }

  function reset() {
    if (!confirm("대화 내용을 모두 지우고 다시 시작할까요?")) return;
    setMsgs([{ ...initialGreeting, id: makeId(), at: stamp() }]);
    setDynamicChips(null);
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
                {showAvatar && (
                  <div className="text-[11px] text-white/70 mb-0.5 ml-1">AI 수호비서</div>
                )}
                {m.solution ? (
                  <div className="inline-block max-w-full bg-white text-[#1c1c1e] rounded-2xl rounded-tl-md shadow-sm overflow-hidden border border-emerald-200">
                    <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-50 to-sky-50 text-[13.5px] font-extrabold border-b border-emerald-100">
                      {m.solution.title}
                    </div>
                    <div
                      className="px-3.5 py-2.5 text-[13px] leading-relaxed"
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {m.solution.context}
                    </div>
                    <div className="mx-3 mb-3 rounded-xl bg-emerald-50/70 border border-emerald-200 px-3 py-2">
                      <div className="text-[12px] font-bold text-emerald-700 mb-1">
                        💡 바른말 실천 방법
                      </div>
                      <div
                        className="text-[12.5px] text-slate-700 leading-relaxed"
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {m.solution.action_guide}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="inline-block bg-white text-[#1c1c1e] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] shadow-sm"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {m.text}
                  </div>
                )}
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffe066] to-[#ffb703] grid place-items-center text-base shrink-0">
              🤖
            </div>
            <div className="bg-white text-[#1c1c1e] rounded-2xl rounded-tl-md px-3.5 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "240ms" }}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 대화 맥락 연동형 가이드 칩 (첫 대화 전: 기본 4종, 이후: 실시간 추천) */}
      <div className="bg-[#232325] border-t border-black/40 px-2 py-2">
        <div className="text-[10px] text-white/50 font-bold mb-1 ml-1">
          {dynamicChips ? "💡 이 주제와 관련된 추천 질문" : "💡 가이드 질문"}
        </div>
        <div
          className="flex flex-nowrap overflow-x-auto gap-2 pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          <style>{`.assistant-chips::-webkit-scrollbar{display:none}`}</style>
          {(dynamicChips ?? QUICK_REPLIES).map((q, i) => (
            <button
              key={`${q.label}-${i}`}
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
        데이터 주도형 엔진 · 지식 항목 {AI_KNOWLEDGE.length}개 로드됨 · 교사가 JSON 데이터셋을
        확장하면 실시간 반영
      </div>
    </div>
  );
}
