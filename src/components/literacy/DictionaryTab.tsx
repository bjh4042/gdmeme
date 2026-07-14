import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Plus, Search, Sparkles, X, ShieldAlert, ShieldCheck, ShieldQuestion, Radio, AlertTriangle, Siren } from "lucide-react";
import type { DictEntry, Evaluation } from "@/lib/literacy-types";
import { KOREAN_INITIALS, ALPHABET, firstInitial, computeTotal, gradeOf, riskBucketOf, sortByInitial } from "@/lib/literacy-types";
import { harmHints } from "@/lib/harm-hints";
import { REACTIONS, reactionCountsFor, myReactionsFor, useEngagementStore, type ReactionKind } from "@/stores/engagement";
import { AreaBadgeChips } from "./AreaBadges";
import { useDebouncedAction } from "@/lib/use-debounced-action";
import { toast } from "sonner";

export function DictionaryTab({
  dict,
  onSubmit,
  student,
  prefillWord,
  openModalKey,
}: {
  dict: DictEntry[];
  onSubmit: (payload: {
    word: string;
    student_definition: string;
    alternatives: string[];
    evaluations: Evaluation;
    suggested_by: string;
    source?: string;
    context_note?: string;
    listener_effect?: string;
  }) => void;
  student: { classCode: string; number: string; name: string };
  prefillWord?: string;
  openModalKey?: number;
}) {
  const [filter, setFilter] = useState<string>("전체");
  const [openModal, setOpenModal] = useState(false);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<"all" | "safe" | "mild" | "danger">("all");
  const [field, setField] = useState<"all" | "word" | "source">("all");
  const [initialWord, setInitialWord] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (openModalKey !== undefined) {
      setInitialWord(prefillWord);
      setOpenModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModalKey]);

  const approved = useMemo(() => {
    // 렌더 방어선: `#02-06` 형태의 잔여 꼬리표는 제거하고, 동일 단어 카드는 첫 항목만 유지.
    const stripTag = (w: string) => w.replace(/\s*#\d+[-–]?\d*\s*$/g, "").trim();
    const seen = new Set<string>();
    const unique: DictEntry[] = [];
    for (const d of dict) {
      if (d.status !== "approved") continue;
      const cleanWord = stripTag(d.word);
      if (!cleanWord || seen.has(cleanWord)) continue;
      seen.add(cleanWord);
      unique.push(cleanWord === d.word ? d : { ...d, word: cleanWord });
    }
    return unique.sort((a, b) => sortByInitial(a.word, b.word));
  }, [dict]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // 위험도 탭은 SSOT 인 riskBucketOf() 결과 하나로만 판정한다.
    // (0–39 safe · 40–69 mild · 70–100 danger) — 카드 뱃지의 gradeOf() 와 동일 기준.
    const passRisk = (d: DictEntry) => {
      if (risk === "all") return true;
      return riskBucketOf(d.total_harmful_score ?? 0) === risk;
    };
    return approved.filter((d) => {
      if (filter !== "전체" && firstInitial(d.word) !== filter) return false;
      if (!passRisk(d)) return false;
      if (q) {
        const inWord = d.word.toLowerCase().includes(q);
        const inSource = (d.source ?? "").toLowerCase().includes(q);
        if (field === "word" && !inWord) return false;
        if (field === "source" && !inSource) return false;
        if (field === "all" && !inWord && !inSource) return false;
      }
      return true;
    });
  }, [approved, filter, query, risk, field]);

  const filters = ["전체", ...KOREAN_INITIALS, ...ALPHABET];
  const currentStudentId = `${student.classCode}_${student.number.padStart(2, "0")}`;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-[color:var(--mint)] to-[color:var(--accent)] text-[color:var(--navy)] shadow-[var(--shadow-soft)]">
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-[color:var(--navy)] truncate">우리가 만드는 바른 우리말 사전</h2>
            <p className="text-xs text-muted-foreground">밈·유행어를 우리 손으로 분석하고 순화어를 함께 만들어요</p>
          </div>
        </div>
        <button
          onClick={() => setOpenModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-4 py-2.5 font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
        >
          <Plus size={18} /> 사전 등록 신청
        </button>
      </div>

      <div data-tour="dict-search" className="glass-soft p-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] mb-3">
          <label className="relative">
            <span className="sr-only">단어·출처 검색</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="단어나 출처로 검색"
              aria-label="사전 검색"
              className="w-full rounded-2xl border-2 border-white/70 bg-white/70 pl-9 pr-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)] transition"
            />
          </label>
          <div role="radiogroup" aria-label="검색 대상" className="flex gap-1 bg-white/50 rounded-2xl p-1">
            {[
              { id: "all", label: "전체" },
              { id: "word", label: "단어" },
              { id: "source", label: "출처" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={field === f.id}
                onClick={() => setField(f.id as typeof field)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)] ${
                  field === f.id ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]" : "text-[color:var(--navy)] hover:bg-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div data-tour="dict-filter-tabs" role="radiogroup" aria-label="위험도 필터" className="flex gap-1 bg-white/50 rounded-2xl p-1">
            {[
              { id: "all", label: "🌐 전체", tone: "" },
              { id: "safe", label: "🟢 안전", tone: "var(--safe)" },
              { id: "mild", label: "🟡 순화 필요", tone: "var(--warn)" },
              { id: "danger", label: "🔴 위험", tone: "var(--danger)" },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={risk === r.id}
                aria-label={`위험도 ${r.label} 필터`}
                onClick={() => setRisk(r.id as typeof risk)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)] ${
                  risk === r.id ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]" : "text-[color:var(--navy)] hover:bg-white"
                }`}
                style={risk === r.id && r.tone ? { boxShadow: `inset 0 -3px 0 ${r.tone}` } : undefined}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              aria-label={`초성 ${f} 필터`}
              className={`min-w-[36px] px-2.5 py-1.5 rounded-xl text-sm font-bold transition ${
                filter === f
                  ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)] shadow-[var(--shadow-soft)]"
                  : "bg-white/60 text-[color:var(--navy)] hover:bg-[color:var(--mint)]"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)]`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="glass-soft p-10 text-center text-muted-foreground border-2 border-dashed border-white/50">
          <Sparkles className="mx-auto mb-2 text-[color:var(--mint-deep)]" />
          검색 조건에 맞는 단어가 없어요. 다른 초성·위험도·검색어를 시도해 보세요.
        </div>
      ) : (
        <div data-tour="dict-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <EntryCard key={d.id} entry={d} currentStudentId={currentStudentId} currentClassCode={student.classCode} dict={dict} />
          ))}
        </div>
      )}

      {openModal && (
        <ProposalModal
          onClose={() => {
            setOpenModal(false);
            setInitialWord(undefined);
          }}
          initialWord={initialWord}
          onSubmit={(payload) => {
            onSubmit({ ...payload, suggested_by: `${student.classCode}_${student.number.padStart(2, "0")}` });
            setOpenModal(false);
            setInitialWord(undefined);
          }}
        />
      )}
    </div>
  );
}

function EntryCard({
  entry,
  currentStudentId,
  currentClassCode,
  dict,
}: {
  entry: DictEntry;
  currentStudentId: string;
  currentClassCode: string;
  dict: DictEntry[];
}) {
  const g = gradeOf(entry.total_harmful_score);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  const Icon = g.tone === "safe" ? ShieldCheck : g.tone === "warn" ? ShieldQuestion : ShieldAlert;
  const likesByEntry = useEngagementStore((s) => s.likesByEntry);
  const react = useEngagementStore((s) => s.react);
  const counts = reactionCountsFor(entry.id, likesByEntry);
  const mine = myReactionsFor(entry.id, currentStudentId, likesByEntry);
  // suggested_by format: `${classCode}_${number}`
  const authorId = entry.suggested_by;
  const authorClass = authorId?.includes("_") ? authorId.split("_")[0] : currentClassCode;
  const doReact = useDebouncedAction((kind: ReactionKind) => {
    if (!currentStudentId) return;
    const willToggleOff = mine.includes(kind);
    const ok = react({
      entryId: entry.id,
      reactorId: currentStudentId,
      reactorClass: currentClassCode,
      authorId: authorId ?? "",
      authorClass: authorClass ?? currentClassCode,
      authorName: authorId ?? "",
      word: entry.word,
      kind,
    });
    if (ok) {
      const r = REACTIONS.find((x) => x.key === kind);
      if (willToggleOff) {
        toast(`${r?.icon} ${r?.label} 취소 · -1 XP`, { duration: 1400 });
      } else {
        toast.success(`${r?.icon} ${r?.label} · +1 XP`, { duration: 1400 });
      }
    }
  }, 400);
  return (
    <div className="glass-card p-5 hover:-translate-y-1 transition-all duration-300">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-2">
        <h3 className="text-2xl font-black text-[color:var(--navy)] truncate">{entry.word}</h3>
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
          style={{ background: bg }}
        >
          <Icon size={12} /> {g.label}
        </span>
      </div>
      {/* 1) 뜻 */}
      <div className="mb-2">
        <div className="text-[11px] font-black text-[color:var(--mint-deep)] mb-0.5">📖 우리가 정리한 뜻</div>
        {entry.student_definition?.trim() ? (
          <p className="text-sm text-[color:var(--navy)] line-clamp-4">{entry.student_definition}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">아직 정리된 뜻이 없어요.</p>
        )}
      </div>
      {/* 2) 출처 · 사용 배경 */}
      {(entry.source || entry.context_note) && (
        <div className="mb-2 space-y-1">
          {entry.source && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--mint-deep)] bg-[color:var(--mint)]/40 rounded-full px-2 py-0.5">
              <Radio size={11} /> 출처 · {entry.source}
            </div>
          )}
          {entry.context_note && (
            <div className="text-[11px] text-slate-700">
              <b className="text-[color:var(--navy)]">🎬 본 상황</b> · {entry.context_note}
            </div>
          )}
        </div>
      )}
      {/* legacy source-only placeholder removed above */}
      {false && entry.source && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--mint-deep)] bg-[color:var(--mint)]/40 rounded-full px-2 py-0.5">
          <Radio size={11} /> 출처 · {entry.source}
        </div>
      )}
      {/* 3) 5대 유해성 점수 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-1">
          <span>5대 유해성 종합 점수</span>
          <span style={{ color: bg }}>{entry.total_harmful_score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-white/60 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${entry.total_harmful_score}%`, background: bg }} />
        </div>
      </div>
      {/* 4) 사용할 때 생각할 점 (규칙 기반) */}
      {(() => {
        const hints = harmHints(entry.evaluations);
        if (hints.length === 0) return null;
        return (
          <div className="mb-3 rounded-2xl bg-amber-50/70 border border-amber-200 p-2.5">
            <div className="text-[11px] font-black text-amber-800 mb-1">💭 사용할 때 생각할 점</div>
            <ul className="space-y-0.5 text-[11px] text-amber-900">
              {hints.map((h, i) => (
                <li key={i}><span aria-hidden>{h.icon}</span> {h.text}</li>
              ))}
            </ul>
          </div>
        );
      })()}
      {/* 5) 듣는 사람의 마음 */}
      {entry.listener_effect && (
        <div className="mb-3 rounded-2xl bg-rose-50/70 border border-rose-200 p-2.5 text-[11px] text-rose-900">
          <div className="font-black text-rose-800 mb-0.5">💗 이 말을 들으면</div>
          {entry.listener_effect}
        </div>
      )}
      {/* 6) 대체 표현 */}
      <div className="text-xs">
        <div className="font-bold text-[color:var(--mint-deep)] mb-1 flex items-center gap-1"><Sparkles size={12} /> 바른 대안 표현</div>
        {entry.alternatives && entry.alternatives.length > 0 ? (
          <ul className="space-y-0.5 text-[color:var(--navy)]">
            {entry.alternatives.map((a, i) => (
              <li key={i}>· {a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 italic">아직 대안 표현이 없어요. 사전 등록에서 함께 만들어 봐요.</p>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-white/60 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>제안 {entry.suggested_by}</span>
          <span data-tour="area-badges">
            <AreaBadgeChips suggestedBy={entry.suggested_by} dict={dict} />
          </span>
        </span>
        <span>투표 {entry.vote_count ?? 1}</span>
      </div>
      <div data-tour="dict-votes" className="mt-3 grid grid-cols-3 gap-1.5">
        {REACTIONS.map((r) => {
          const on = mine.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => doReact(r.key)}
              aria-pressed={on}
              aria-label={`${r.label} 공감 ${on ? "취소" : "누르기"} (누적 ${counts[r.key]}회)`}
              title={on ? `${r.label} · 다시 눌러 취소` : r.label}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-black leading-tight transition-all duration-200 wt-text ${
                on
                  ? "text-white shadow-[0_0_0_2px_rgba(255,255,255,0.6)_inset,0_4px_14px_-2px_rgba(0,0,0,0.25)] ring-2 ring-white/70 scale-[1.02]"
                  : "bg-white/70 text-[color:var(--navy)] hover:bg-white hover:-translate-y-0.5 active:scale-95"
              }`}
              style={on ? { background: r.color } : undefined}
            >
              <span className="text-base leading-none">{r.icon}</span>
              <span className="truncate max-w-full">{r.label}</span>
              <span className="font-mono text-[10px] opacity-90">{counts[r.key]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EVAL_LABELS: { key: keyof Evaluation; label: string; hint: string }[] = [
  { key: "aggression", label: "① 공격성 및 욕설", hint: "거친 말이나 공격적인가?" },
  { key: "bullying", label: "② 조롱 및 따돌림", hint: "친구를 놀리거나 소외시키는가?" },
  { key: "discrimination", label: "③ 차별 및 혐오", hint: "성별, 장애, 지역 등을 비하하는가?" },
  { key: "violence", label: "④ 폭력성 및 자극성", hint: "위험하고 잔인한 행동을 유도하는가?" },
  { key: "grammar_destruction", label: "⑤ 문법 파괴 정도", hint: "한글 맞춤법이나 형식을 파괴하는가?" },
];

function ProposalModal({
  onClose,
  onSubmit,
  initialWord,
}: {
  onClose: () => void;
  onSubmit: (p: {
    word: string;
    student_definition: string;
    alternatives: string[];
    evaluations: Evaluation;
    source?: string;
    context_note?: string;
    listener_effect?: string;
  }) => void;
  initialWord?: string;
}) {
  const [word, setWord] = useState(initialWord ?? "");
  const [def, setDef] = useState("");
  const [alt, setAlt] = useState("");
  const [source, setSource] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [listenerEffect, setListenerEffect] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [ev, setEv] = useState<Evaluation>({
    aggression: 3,
    bullying: 3,
    discrimination: 3,
    violence: 3,
    grammar_destruction: 3,
  });
  const submittingRef = useRef(false);
  const total = computeTotal(ev);
  const g = gradeOf(total);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return; // 중복 제출 방어
    if (!source.trim()) {
      setErrorMsg("단어가 사용된 출처를 적어주어야 신청할 수 있어요!");
      return;
    }
    if (!word.trim() || !def.trim() || !alt.trim()) {
      setErrorMsg("낱말명·뜻풀이·대안 표현을 모두 입력해 주세요.");
      return;
    }
    setErrorMsg("");
    submittingRef.current = true;
    setTimeout(() => (submittingRef.current = false), 800);
    onSubmit({
      word: word.trim(),
      student_definition: def.trim(),
      alternatives: alt.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      source: source.trim(),
      context_note: contextNote.trim() || undefined,
      listener_effect: listenerEffect.trim() || undefined,
      evaluations: ev,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--navy)]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <form onSubmit={submit} className="w-full max-w-2xl my-8 glass-card p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-[color:var(--navy)] flex items-center gap-2">
            <Plus className="text-[color:var(--mint-deep)]" /> 사전 등록 신청
          </h3>
          <button type="button" onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/60 transition">
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">단어명 *</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="mt-1 w-full rounded-2xl border-2 border-white/70 bg-white/70 backdrop-blur px-3 py-2.5 outline-none focus:border-[color:var(--mint-deep)] transition"
              placeholder="예: 어쩔티비"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)] flex items-center gap-1">
              <Radio size={14} /> 🔗 이 단어를 어디서 보거나 들었나요? (출처) * <span className="text-xs font-normal text-muted-foreground">필수</span>
            </span>
            <input
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              aria-invalid={!!errorMsg && !source.trim()}
              className={`mt-1 w-full rounded-2xl border-2 bg-white/70 backdrop-blur px-3 py-2.5 outline-none transition focus:border-[color:var(--mint-deep)] ${
                errorMsg && !source.trim() ? "border-[color:var(--danger)]" : "border-white/70"
              }`}
              placeholder="예: 유튜브 쇼츠 000채널, 인스타그램 릴스, 인터넷 신문기사, 학교 운동장"
            />
            {errorMsg && (
              <p role="alert" className="mt-1 text-xs font-bold text-[color:var(--danger)]">
                ⚠️ {errorMsg}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">학생들이 정의한 뜻 *</span>
            <textarea
              value={def}
              onChange={(e) => setDef(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-2xl border-2 border-white/70 bg-white/70 backdrop-blur px-3 py-2.5 outline-none focus:border-[color:var(--mint-deep)] transition"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">바른 우리말 권장 대안 표현 * (쉼표로 구분)</span>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="mt-1 w-full rounded-2xl border-2 border-white/70 bg-white/70 backdrop-blur px-3 py-2.5 outline-none focus:border-[color:var(--mint-deep)] transition"
              placeholder="네 생각을 존중해, 그렇게 생각할 수도 있겠구나"
            />
          </label>
        </div>
        <div className="mt-5">
          <h4 className="text-sm font-black text-[color:var(--navy)] mb-2">리터러시 유해성 5대 척도 (1~5점)</h4>
          <div className="space-y-3">
            {EVAL_LABELS.map((l) => (
              <div key={l.key} className="rounded-2xl bg-white/50 backdrop-blur p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[color:var(--navy)]">{l.label}</span>
                  <div
                    className="flex items-center gap-0.5"
                    role="radiogroup"
                    aria-label={`${l.label} 별점 선택 (1점부터 5점)`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = n <= ev[l.key];
                      // 3점 이하: ⚠️ (노란 경고), 4점 이상: 🚨 (경광등) — 직관적 위험 시각화
                      const IconCmp = n >= 4 ? Siren : AlertTriangle;
                      const activeColor = n >= 4 ? "text-[color:var(--danger)]" : "text-[color:var(--warn)]";
                      return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setEv({ ...ev, [l.key]: n })}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                            e.preventDefault();
                            setEv({ ...ev, [l.key]: Math.min(5, ev[l.key] + 1) });
                          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                            e.preventDefault();
                            setEv({ ...ev, [l.key]: Math.max(1, ev[l.key] - 1) });
                          }
                        }}
                        className="transition-transform hover:scale-125 active:scale-90 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)]"
                        role="radio"
                        aria-checked={ev[l.key] === n}
                        aria-label={`${l.label} ${n}점`}
                        tabIndex={ev[l.key] === n ? 0 : -1}
                      >
                        <IconCmp
                          size={20}
                          className={active ? activeColor : "text-slate-300"}
                          fill={active ? "currentColor" : "none"}
                        />
                      </button>
                      );
                    })}
                    <span className="ml-2 font-mono font-bold text-[color:var(--mint-deep)] text-xs">{ev[l.key]}점</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-1">{l.hint}</div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={ev[l.key]}
                  onChange={(e) => setEv({ ...ev, [l.key]: Number(e.target.value) })}
                  className="w-full accent-[color:var(--mint-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mint-deep)] rounded"
                  aria-label={`${l.label} 슬라이더, 현재 ${ev[l.key]}점`}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-valuenow={ev[l.key]}
                  aria-valuetext={`${ev[l.key]}점 (${l.hint})`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-2xl p-4 text-white shadow-[var(--shadow-soft)]" style={{ background: bg }}>
          <div className="text-xs opacity-90">종합 유해 점수</div>
          <div className="text-3xl font-black">{total}/100 {g.emoji}</div>
          <div className="text-sm font-bold">{g.label}</div>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white font-bold transition">
            취소
          </button>
          <button type="submit" className="px-5 py-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition">
            교사 승인 요청 보내기
          </button>
        </div>
      </form>
    </div>
  );
}