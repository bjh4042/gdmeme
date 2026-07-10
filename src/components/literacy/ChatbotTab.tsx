import { useMemo, useState } from "react";
import { Lightbulb, Send, ChevronLeft, Menu, Search } from "lucide-react";
import {
  SCENARIOS,
  MEME_TRIGGERS,
  MEME_FEEDBACK,
  SHORT_FEEDBACK,
  IMPOLITE_FEEDBACK,
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
  return <Roleplay onXP={onXP} />;
}

/** Per-scenario room state, kept when switching threads (KakaoTalk feel). */
type RoomState = {
  msgs: Msg[];
  stage: number; // current stage index (0..stages.length-1) or stages.length when done
  wrong: number;
  mood: number;
  unread: number;
  done: boolean;
};

function initialRoom(s: Scenario): RoomState {
  return {
    msgs: [{ from: "npc", text: s.stages[0].npc }],
    stage: 0,
    wrong: 0,
    mood: 80,
    unread: 1,
    done: false,
  };
}

function Roleplay({ onXP }: { onXP: (d: number, k: string, n?: string) => void }) {
  const [rooms, setRooms] = useState<Record<string, RoomState>>(() =>
    Object.fromEntries(SCENARIOS.map((s) => [s.id, initialRoom(s)])),
  );
  const [activeId, setActiveId] = useState<string | null>(SCENARIOS[0].id);
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0],
    [activeId],
  );
  const room = rooms[scenario.id];
  const currentStage = scenario.stages[Math.min(room.stage, scenario.stages.length - 1)];
  const guideText = room.done ? "🎉 모든 대화를 완료했어요! 목록에서 다른 인물과 대화해보세요." : currentStage.guide;
  const hintText = room.done ? scenario.completeBadge ?? "예절 배지 획득!" : currentStage.hint;

  function openThread(id: string) {
    setActiveId(id);
    setMobileView("chat");
    setRooms((prev) => ({ ...prev, [id]: { ...prev[id], unread: 0 } }));
  }

  function resetRoom() {
    setRooms((prev) => ({ ...prev, [scenario.id]: initialRoom(scenario) }));
  }

  function pushNpc(text: string, tone?: "safe" | "warn" | "danger") {
    setTimeout(() => {
      setRooms((prev) => ({
        ...prev,
        [scenario.id]: {
          ...prev[scenario.id],
          msgs: [...prev[scenario.id].msgs, { from: "npc", text, tone }],
        },
      }));
    }, 380);
  }
  function pushSys(text: string) {
    setTimeout(() => {
      setRooms((prev) => ({
        ...prev,
        [scenario.id]: {
          ...prev[scenario.id],
          msgs: [...prev[scenario.id].msgs, { from: "sys", text }],
        },
      }));
    }, 700);
  }

  function send() {
    const text = input.trim();
    if (!text || room.done) return;
    setInput("");
    setRooms((prev) => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        msgs: [...prev[scenario.id].msgs, { from: "me", text }],
      },
    }));

    const meme = containsMeme(text);
    const short = text.length < 6;
    const polite = isPolite(text);

    if (polite && !meme) {
      // Advance one stage
      const nextStageIdx = room.stage + 1;
      const isFinal = nextStageIdx >= scenario.stages.length;
      setRooms((prev) => ({
        ...prev,
        [scenario.id]: {
          ...prev[scenario.id],
          stage: nextStageIdx,
          wrong: 0,
          mood: Math.min(100, prev[scenario.id].mood + 15),
          done: isFinal,
        },
      }));
      // Praise for the stage just cleared
      pushNpc(currentStage.praise, "safe");
      if (!isFinal) {
        // Advance NPC to next stage prompt
        const nextPrompt = scenario.stages[nextStageIdx].npc;
        setTimeout(() => {
          setRooms((prev) => ({
            ...prev,
            [scenario.id]: {
              ...prev[scenario.id],
              msgs: [...prev[scenario.id].msgs, { from: "npc", text: nextPrompt }],
            },
          }));
        }, 900);
        pushSys(`✅ ${nextStageIdx}단계 통과! +15 XP`);
        onXP(15, "roleplay", `${scenario.id} · Stg${nextStageIdx}`);
      } else {
        pushSys(`🎖️ ${scenario.completeBadge ?? "완료 배지 획득"} · +30 XP`);
        onXP(30, "roleplay", `${scenario.id} · 완료`);
      }
      return;
    }

    // Wrong path — pick feedback array by cause, index by wrong count
    const idx = Math.min(room.wrong, 2);
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
    setRooms((prev) => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        wrong: prev[scenario.id].wrong + 1,
        mood: Math.max(0, prev[scenario.id].mood + delta),
      },
    }));
    pushNpc(fill(tpl, meme ?? text, currentStage.hint), meme ? "danger" : "warn");
    onXP(0, "chat", `[${scenario.npc}] "${text}" · ${cause} · 오답 ${room.wrong + 1}회`);
  }

  const moodEmoji = room.mood >= 70 ? "😊" : room.mood >= 40 ? "😐" : room.mood >= 20 ? "😢" : "😠";
  const lastPreview = (r: RoomState) => {
    const last = [...r.msgs].reverse().find((m) => m.from !== "sys");
    return last ? last.text.slice(0, 22) : "";
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] animate-fade-in">
      {/* KakaoTalk-style chat list */}
      <aside
        className={`glass-card p-0 overflow-hidden h-fit ${mobileView === "chat" ? "hidden lg:block" : ""}`}
      >
        <div className="px-4 py-3 border-b border-white/60 bg-white/60">
          <div className="text-sm font-black text-[color:var(--navy)]">💬 예절 채팅</div>
          <div className="text-[11px] text-muted-foreground">4명의 인물과 3단계 대화를 완주해 배지를 모아요</div>
        </div>
        <ul className="divide-y divide-white/50">
          {SCENARIOS.map((s) => {
            const r = rooms[s.id];
            const active = scenario.id === s.id;
            return (
              <li key={s.id}>
                <button
                  onClick={() => openThread(s.id)}
                  className={`w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition ${
                    active ? "bg-[color:var(--mint)]/40" : "hover:bg-white/60"
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl grid place-items-center bg-white shadow-sm text-2xl border border-white">
                    {s.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                      <div className="font-bold text-[color:var(--navy)] truncate text-sm">{s.npc}</div>
                      <div className="shrink-0 text-[10px] text-muted-foreground">
                        {r.done ? "완료 🎖️" : `Stg ${Math.min(r.stage + 1, s.stages.length)}/${s.stages.length}`}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{lastPreview(r)}</div>
                  </div>
                  {r.unread > 0 && !active && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black grid place-items-center">
                      {r.unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* KakaoTalk-themed chat room */}
      <div
        className={`rounded-3xl overflow-hidden flex flex-col min-h-[600px] shadow-[var(--shadow-soft)] border border-white/60 ${
          mobileView === "list" ? "hidden lg:flex" : ""
        }`}
        style={{ background: "#B2C7D9" }}
      >
        {/* Top bar (KakaoTalk style) */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 bg-[#A2B8CB] text-[#1a1a1a]">
          <button onClick={() => setMobileView("list")} className="p-1 rounded hover:bg-black/5 lg:opacity-60" aria-label="목록으로">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 text-center">
            <div className="font-bold truncate text-sm">{scenario.npc}</div>
            <div className="text-[10px] opacity-70">
              {room.done
                ? "🎖️ 대화 완료"
                : `Stg ${room.stage + 1}/${scenario.stages.length} · 성취기준 4국01-02`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1" title={`대화 분위기 ${room.mood}점`}>
              <span className="text-lg">{moodEmoji}</span>
              <div className="w-16 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${room.mood}%`, background: room.mood >= 40 ? "#22c55e" : "#ef4444" }}
                />
              </div>
            </div>
            <button className="p-1 rounded hover:bg-black/5 hidden sm:block" aria-label="검색"><Search size={18} /></button>
            <button onClick={resetRoom} className="p-1 rounded hover:bg-black/5" title="대화 초기화" aria-label="메뉴"><Menu size={18} /></button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          <div className="mx-auto w-fit text-[10px] px-3 py-0.5 rounded-full bg-black/15 text-white/95 font-medium">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </div>
          {room.msgs.map((m, i) => (
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
            <b>💡 가이드:</b> {guideText}
            <div className="text-[11px] text-muted-foreground mt-0.5">모범 예시 → "{hintText}"</div>
          </div>
        </div>

        {/* Input bar (KakaoTalk style) */}
        <div className="p-2 bg-white grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-center border-t border-black/5">
          <button className="w-9 h-9 grid place-items-center rounded-full text-xl text-black/40 hover:bg-black/5" aria-label="추가">+</button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={room.done ? "대화가 완료되었어요. 다른 인물과 대화해보세요!" : "바른 말로 답장해 보세요..."}
            disabled={room.done}
            className="min-w-0 rounded-full bg-[#F1F2F4] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)] transition"
          />
          <button
            onClick={send}
            disabled={room.done}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-4 py-2 text-sm font-bold hover:scale-[1.03] active:scale-95 transition disabled:opacity-40"
          >
            <Send size={14} /> 전송
          </button>
        </div>
      </div>
    </div>
  );
}