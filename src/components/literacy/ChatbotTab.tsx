import { useEffect, useMemo, useState } from "react";
import { Lightbulb, Send, ChevronLeft, Menu, Search, Lock, MessageSquarePlus, Music2, Settings, Users, MessagesSquare, Radio, ShoppingBag, MoreHorizontal, Plus } from "lucide-react";
import {
  SCENARIOS,
  MEME_TRIGGERS,
  type Scenario,
} from "@/lib/literacy-seed";
import { evaluateReply, rejectionLine, xpForStageClear, reasonLabel } from "@/lib/literacy-evaluator";

type Msg = { from: "npc" | "me" | "sys"; text: string; tone?: "safe" | "warn" | "danger"; at?: string };

function containsMeme(text: string) {
  return MEME_TRIGGERS.find((m) => text.includes(m));
}
function findAllMemes(text: string) {
  return MEME_TRIGGERS.filter((m) => text.includes(m));
}
function fmtStamp(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h < 12 ? "오전" : "오후";
  const hh = ((h + 11) % 12) + 1;
  return `${ap} ${hh}:${m}`;
}
function nowStamp() {
  return fmtStamp(new Date());
}

// Yesterday at a specific H/M
function yesterdayAt(h: number, m: number) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(h, m, 0, 0);
  return d;
}

// 5 unique random times yesterday between 17:00 and 21:00, sorted DESC (newest first).
function makeYesterdayTimes(count: number): Date[] {
  const pool = new Set<number>();
  while (pool.size < count) {
    // minutes since 17:00, range 0..240
    pool.add(Math.floor(Math.random() * 241));
  }
  return [...pool]
    .sort((a, b) => b - a)
    .map((mins) => yesterdayAt(17 + Math.floor(mins / 60), mins % 60));
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

type RoomState = {
  msgs: Msg[];
  stage: number;
  wrong: number;
  mood: number;
  unread: number;
  done: boolean;
};

function initialRoom(s: Scenario): RoomState {
  return {
    msgs: [{ from: "npc", text: s.stages[0].npc, at: nowStamp() }],
    stage: 0,
    wrong: 0,
    mood: 80,
    unread: 1,
    done: false,
  };
}

const STORE_KEY = "wtmeme:rooms:v2";

export function ChatbotTab({ onXP, classLevel }: { onXP: (delta: number, kind: string, note?: string) => void; classLevel: number }) {
  const [rooms, setRooms] = useState<Record<string, RoomState>>(() =>
    Object.fromEntries(SCENARIOS.map((s) => [s.id, initialRoom(s)])),
  );
  const [hydrated, setHydrated] = useState(false);

  // Assign a random yesterday-evening timestamp to each scenario (top = newest).
  const scenarioTimes = useMemo(() => {
    const times = makeYesterdayTimes(SCENARIOS.length);
    const map: Record<string, Date> = {};
    SCENARIOS.forEach((s, i) => (map[s.id] = times[i]));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backfill the initial NPC message's timestamp with the assigned yesterday time.
  useEffect(() => {
    setRooms((prev) => {
      const next = { ...prev };
      for (const s of SCENARIOS) {
        const r = next[s.id];
        if (!r || r.msgs.length === 0) continue;
        const first = r.msgs[0];
        if (first.from === "npc" && r.stage === 0 && !r.done) {
          const at = fmtStamp(scenarioTimes[s.id]);
          if (first.at !== at) {
            next[s.id] = { ...r, msgs: [{ ...first, at }, ...r.msgs.slice(1)] };
          }
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Hydrate rooms from localStorage after mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, RoomState>;
        setRooms((prev) => {
          const next: Record<string, RoomState> = { ...prev };
          for (const s of SCENARIOS) {
            if (parsed[s.id]) next[s.id] = parsed[s.id];
          }
          return next;
        });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(rooms));
    } catch {}
  }, [rooms, hydrated]);

  const unlockedIds = useMemo(
    () => SCENARIOS.filter((s) => classLevel >= s.unlockLevel).map((s) => s.id),
    [classLevel],
  );

  const firstUnlocked = unlockedIds[0] ?? SCENARIOS[0].id;
  const [activeId, setActiveId] = useState<string>(firstUnlocked);
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // If active room becomes locked (level drop) → snap back to list.
  useEffect(() => {
    if (!unlockedIds.includes(activeId)) {
      setActiveId(firstUnlocked);
      setMobileView("list");
    }
  }, [unlockedIds, activeId, firstUnlocked]);

  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0], [activeId]);
  const isLocked = !unlockedIds.includes(scenario.id);
  const room = rooms[scenario.id];
  const currentStage = scenario.stages[Math.min(room.stage, scenario.stages.length - 1)];
  const guideText = room.done ? "🎉 모든 대화를 완료했어요! 목록에서 다른 인물과 대화해보세요." : currentStage.guide;
  const hintText = room.done ? scenario.completeBadge ?? "예절 배지 획득!" : currentStage.hint;

  function openThread(id: string) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    if (classLevel < s.unlockLevel) return;
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
          msgs: [...prev[scenario.id].msgs, { from: "npc", text, tone, at: nowStamp() }],
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
    if (!text || room.done || isLocked) return;
    setInput("");
    setRooms((prev) => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        msgs: [...prev[scenario.id].msgs, { from: "me", text, at: nowStamp() }],
      },
    }));

    // 3중 시맨틱 예절 평가 매트릭스 통과 여부
    const result = evaluateReply({
      text,
      scenarioId: scenario.id,
      stageIdx: room.stage,
      correctionMode: !!scenario.correctionMode,
    });

    if (result.pass) {
      const wrongBefore = room.wrong;
      const xp = xpForStageClear(wrongBefore);
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
      pushNpc(currentStage.praise, "safe");
      if (!isFinal) {
        const nextPrompt = scenario.stages[nextStageIdx].npc;
        setTimeout(() => {
          setRooms((prev) => ({
            ...prev,
            [scenario.id]: {
              ...prev[scenario.id],
              msgs: [...prev[scenario.id].msgs, { from: "npc", text: nextPrompt, at: nowStamp() }],
            },
          }));
        }, 900);
        pushSys(`✅ ${nextStageIdx}단계 통과! +${xp} XP${wrongBefore > 0 ? ` (반려 ${wrongBefore}회 후 통과)` : ""}`);
        onXP(xp, "roleplay", `${scenario.id} · Stg${nextStageIdx} · 반려${wrongBefore}회`);
      } else {
        const bonus = scenario.correctionMode ? 40 : 20;
        const totalXp = xp + bonus;
        pushSys(`🎖️ ${scenario.completeBadge ?? "완료 배지 획득"} · +${totalXp} XP`);
        onXP(totalXp, "roleplay", `${scenario.id} · 완료 · 반려${wrongBefore}회`);
      }
      return;
    }

    // 실패: stage 고정, wrong 증가, NPC 반려 대사 렌더
    const nextWrong = room.wrong + 1;
    const delta =
      result.reason === "slang"
        ? scenario.correctionMode ? -10 : -25
        : result.reason === "sarcastic-mockery"
        ? -20
        : result.reason === "evasive-question"
        ? -12
        : result.reason === "low-effort" || result.reason === "too-short"
        ? -8
        : -10;
    setRooms((prev) => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        wrong: nextWrong,
        mood: Math.max(0, prev[scenario.id].mood + delta),
      },
    }));
    const line = rejectionLine(scenario.id, nextWrong);
    const tone: "warn" | "danger" =
      result.reason === "slang" || result.reason === "sarcastic-mockery" ? "danger" : "warn";
    pushNpc(line, tone);
    onXP(
      0,
      "chat",
      `[${scenario.npc}] "${text}" · ${reasonLabel(result.reason)}${
        result.detail ? `(${result.detail})` : ""
      } · 반려 ${nextWrong}회`,
    );
  }

  const moodEmoji = room.mood >= 70 ? "😊" : room.mood >= 40 ? "😐" : room.mood >= 20 ? "😢" : "😠";
  const lastPreview = (r: RoomState) => {
    const last = [...r.msgs].reverse().find((m) => m.from !== "sys");
    return last ? last.text.slice(0, 26) : "";
  };

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);
  const yesterdayWeekday = `${WEEKDAY_KO[yesterday.getDay()]}요일`;

  // Detected slang triggers in the current NPC line (for correction-mode guide)
  const npcMemes = scenario.correctionMode ? findAllMemes(currentStage.npc) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] animate-fade-in">
      {/* KakaoTalk mobile-style dark chat list */}
      <aside
        className={`rounded-3xl overflow-hidden shadow-[var(--shadow-soft)] border border-black/40 flex flex-col ${
          mobileView === "chat" ? "hidden lg:flex" : "flex"
        }`}
        style={{ background: "#1c1c1e", minHeight: 640 }}
      >
        {/* Top header */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="text-white font-black text-[22px] tracking-tight">채팅</div>
          <div className="flex items-center gap-3 text-white/85">
            <Search size={19} />
            <MessageSquarePlus size={19} />
            <Music2 size={19} />
            <Settings size={19} />
          </div>
        </div>

        {/* Chat list */}
        <ul className="flex-1 overflow-y-auto">
          {SCENARIOS.map((s) => {
            const r = rooms[s.id];
            const locked = classLevel < s.unlockLevel;
            const active = scenario.id === s.id && !locked;
            return (
              <li key={s.id}>
                <button
                  onClick={() => openThread(s.id)}
                  disabled={locked}
                  className={`w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition ${
                    active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                  } ${locked ? "cursor-not-allowed" : ""}`}
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-2xl grid place-items-center text-2xl border border-white/10 ${
                        locked ? "bg-white/5" : "bg-[#2a2a2c]"
                      }`}
                      style={locked ? { filter: "blur(3px)" } : undefined}
                    >
                      {s.emoji}
                    </div>
                    {locked && (
                      <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40">
                        <Lock size={16} className="text-white/90" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                      <div className={`font-bold truncate text-[15px] ${locked ? "text-white/40" : "text-white"}`}>
                        {s.npc}
                      </div>
                      <div className="shrink-0 text-[10px] text-white/40">
                        {locked ? "" : r.done ? "완료" : yesterdayWeekday}
                      </div>
                    </div>
                    <div className={`text-[12px] truncate ${locked ? "text-white/35" : "text-white/55"}`}>
                      {locked ? `🔒 학급 레벨 ${s.unlockLevel} 달성 시 오픈` : lastPreview(r) || s.subtitle}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-white/40">{r.msgs[r.msgs.length - 1]?.at ?? ""}</span>
                    {!locked && r.unread > 0 && !active && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black grid place-items-center">
                        {r.unread}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Bottom KakaoTalk nav */}
        <div className="grid grid-cols-5 border-t border-white/10 bg-[#1c1c1e]">
          {[
            { icon: Users, label: "친구" },
            { icon: MessagesSquare, label: "채팅", active: true },
            { icon: Radio, label: "오픈채팅" },
            { icon: ShoppingBag, label: "쇼핑" },
            { icon: MoreHorizontal, label: "더보기" },
          ].map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.label} className={`flex flex-col items-center gap-0.5 py-2 ${n.active ? "text-white" : "text-white/45"}`}>
                <Icon size={18} />
                <span className="text-[10px]">{n.label}</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* KakaoTalk chat room (dark) */}
      <div
        className={`rounded-3xl overflow-hidden flex-col min-h-[640px] shadow-[var(--shadow-soft)] border border-black/40 ${
          mobileView === "list" ? "hidden lg:flex" : "flex"
        }`}
        style={{ background: "#1a1a1a" }}
      >
        {/* Top bar */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 bg-[#111] text-white border-b border-white/5">
          <button onClick={() => setMobileView("list")} className="p-1 rounded hover:bg-white/5 lg:opacity-70" aria-label="목록으로">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 text-center">
            <div className="font-bold truncate text-[15px]">{scenario.npc}</div>
            <div className="text-[10px] opacity-60">
              {isLocked
                ? `🔒 학급 레벨 ${scenario.unlockLevel} 달성 시 오픈`
                : room.done
                ? "🎖️ 대화 완료"
                : `Stg ${room.stage + 1}/${scenario.stages.length}`}
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <div className="flex items-center gap-1" title={`대화 분위기 ${room.mood}점`}>
              <span className="text-base">{moodEmoji}</span>
              <div className="w-14 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${room.mood}%`, background: room.mood >= 40 ? "#22c55e" : "#ef4444" }}
                />
              </div>
            </div>
            <button className="p-1 rounded hover:bg-white/5 hidden sm:block" aria-label="검색"><Search size={18} /></button>
            <button onClick={resetRoom} className="p-1 rounded hover:bg-white/5" title="대화 초기화" aria-label="메뉴"><Menu size={18} /></button>
          </div>
        </div>

        {/* Locked overlay */}
        {isLocked ? (
          <div className="flex-1 grid place-items-center text-center px-8 py-12">
            <div className="space-y-3">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-white/5 grid place-items-center text-3xl border border-white/10">
                <Lock className="text-white/70" />
              </div>
              <div className="text-white font-bold text-lg">🔒 잠긴 채팅방</div>
              <div className="text-white/60 text-sm max-w-xs">
                <b className="text-white/85">{scenario.npc}</b>과의 대화는
                <br />학급 공동 레벨 <b className="text-white/85">Lv.{scenario.unlockLevel}</b> 달성 시 열려요.
              </div>
              <div className="text-white/45 text-xs">
                우리 반이 함께 XP를 모으면 다음 채팅방이 열립니다.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat area */}
            <div className="flex-1 min-h-0 p-3 space-y-2 overflow-y-auto scroll-touch">
              <div className="mx-auto w-fit text-[10px] px-3 py-1 rounded-full bg-[#FEE500] text-black font-bold shadow-sm">
                {yesterday.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
              </div>
              {room.msgs.map((m, i) => (
                <div key={i} className={`flex animate-fade-in ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  {m.from === "sys" ? (
                    <div className="mx-auto text-[11px] px-3 py-1 rounded-full bg-white/10 text-white/80 font-bold">
                      {m.text}
                    </div>
                  ) : m.from === "npc" ? (
                    <div className="flex items-end gap-1.5 max-w-[80%]">
                      <div className="w-9 h-9 shrink-0 rounded-2xl bg-[#2a2a2c] grid place-items-center text-lg border border-white/10">
                        {scenario.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-white/60 mb-0.5 ml-1">{scenario.npc}</div>
                        <div className="flex items-end gap-1">
                          <div
                            className={`px-3 py-2 rounded-2xl rounded-tl-md text-sm shadow-sm break-words ${
                              m.tone === "danger"
                                ? "bg-red-500/25 text-white border border-red-400/40"
                                : m.tone === "warn"
                                ? "bg-amber-400/25 text-white border border-amber-300/40"
                                : "bg-white text-[#111]"
                            }`}
                          >
                            {m.text}
                          </div>
                          <span className="text-[10px] text-white/40 whitespace-nowrap mb-0.5">{m.at}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1 max-w-[80%]">
                      <span className="text-[10px] text-white/40 whitespace-nowrap mb-0.5">{m.at}</span>
                      <div
                        className="px-3 py-2 rounded-2xl rounded-tr-md text-sm shadow-sm break-words text-[#111]"
                        style={{ background: "#FEE500" }}
                      >
                        {m.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Guide */}
            <div className="shrink-0 mx-3 mb-2 flex items-start gap-2 rounded-2xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2 text-xs text-white shadow-sm animate-fade-in max-h-[30vh] overflow-y-auto scroll-touch" key={`g-${scenario.id}-${room.stage}-${room.done}`}>
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-[#FEE500]" />
              <div className="min-w-0">
                <b>💡 가이드:</b> {guideText}
                <div className="text-[11px] text-white/70 mt-0.5">모범 예시 → "{hintText}"</div>
                {npcMemes.length > 0 && !room.done && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {npcMemes.map((w) => (
                      <span key={w} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/25 text-red-100 border border-red-400/40">
                        ⚠︎ {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Input bar */}
            <div className="shrink-0 p-2 bg-[#111] grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-center border-t border-white/5">
              <button className="shrink-0 w-11 h-11 grid place-items-center rounded-full text-white/60 hover:bg-white/5" aria-label="추가"><Plus size={18} /></button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={room.done ? "대화가 완료되었어요. 다른 인물과 대화해보세요!" : scenario.correctionMode ? "친구의 유행어를 바른 말로 고쳐 주세요..." : "바른 말로 답장해 보세요..."}
                disabled={room.done}
                className="min-w-0 rounded-full bg-[#2a2a2c] text-white placeholder:text-white/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FEE500]/60 transition"
              />
              <button
                onClick={send}
                disabled={room.done}
                aria-label="전송"
                className="shrink-0 inline-flex items-center justify-center gap-1 rounded-full bg-[#FEE500] text-black px-3 sm:px-4 min-w-[44px] min-h-[44px] text-sm font-bold hover:scale-[1.03] active:scale-95 transition disabled:opacity-40"
              >
                <Send size={16} /> <span className="hidden sm:inline">전송</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}