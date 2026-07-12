import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Sparkles, ShieldAlert, ShieldCheck, ShieldQuestion, Radio, ArrowRight, BookOpen } from "lucide-react";
import type { DictEntry } from "@/lib/literacy-types";
import { gradeOf } from "@/lib/literacy-types";

const DEFAULT_TRENDS: Record<string, number> = {
  "어쩔티비": 10,
  "누칼협": 8,
  "핑프": 6,
  "킹받네": 4,
  "뇌절": 2,
};

function storageKey(classCode: string) {
  return `class_search_keywords_count_${classCode || "guest"}`;
}

function readCounts(classCode: string): Record<string, number> {
  if (typeof window === "undefined") return { ...DEFAULT_TRENDS };
  try {
    const raw = window.localStorage.getItem(storageKey(classCode));
    if (!raw) {
      window.localStorage.setItem(storageKey(classCode), JSON.stringify(DEFAULT_TRENDS));
      return { ...DEFAULT_TRENDS };
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
  } catch {}
  return { ...DEFAULT_TRENDS };
}

function writeCounts(classCode: string, next: Record<string, number>) {
  try {
    window.localStorage.setItem(storageKey(classCode), JSON.stringify(next));
  } catch {}
}

export function AnalyzerTab({
  dict,
  onRegisterNew,
  classCode,
}: {
  dict: DictEntry[];
  onRegisterNew: (word: string) => void;
  classCode: string;
}) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...DEFAULT_TRENDS }));

  useEffect(() => {
    setCounts(readCounts(classCode));
  }, [classCode]);

  const topKeywords = useMemo(
    () =>
      Object.entries(counts)
        .filter(([w]) => w.trim().length > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w),
    [counts],
  );

  const approved = dict.filter((d) => d.status === "approved");
  const results = submitted
    ? approved.filter((d) => {
        const t = submitted.trim().toLowerCase();
        return (
          d.word.toLowerCase().includes(t) ||
          d.student_definition.toLowerCase().includes(t) ||
          (d.source ?? "").toLowerCase().includes(t)
        );
      })
    : [];

  const runSearch = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      setSubmitted(t);
      setCounts((prev) => {
        const next = { ...prev, [t]: (prev[t] ?? 0) + 1 };
        writeCounts(classCode, next);
        return next;
      });
    },
    [classCode],
  );

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    runSearch(q);
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className={`transition-all ${submitted ? "pt-4 sm:pt-6" : "pt-6 sm:pt-8"}`}>
        <div className="text-center mb-4 sm:mb-6 space-y-1.5 sm:space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[color:var(--mint-deep)] bg-white/70 px-3 py-1.5 rounded-full backdrop-blur">
            <Sparkles size={14} /> 초등 국어 매체 리터러시 · 밈 분석기
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[color:var(--navy)] tracking-tight">
            바른말 <span className="text-[color:var(--mint-deep)]">수호대</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            궁금한 밈·유행어·비속어를 검색해 우리 반이 함께 만든 뜻과 순화어를 찾아보세요.
          </p>
        </div>

        <form onSubmit={search} className="max-w-2xl mx-auto">
          <div className="glass-card p-2 flex items-center gap-2 shadow-[var(--shadow-soft)] focus-within:ring-2 focus-within:ring-[color:var(--mint-deep)] transition">
            <Search size={22} className="ml-3 text-[color:var(--mint-deep)] shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="예: 어쩔티비, 누칼협, 킹받네..."
              aria-label="밈·유행어 검색"
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-base sm:text-lg outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="submit"
              className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-5 py-3 font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
            >
              분석하기
            </button>
          </div>
          {!submitted && topKeywords.length > 0 && (
            <div className="mt-4 flex flex-row flex-wrap gap-2 justify-center items-center">
              <span className="text-xs text-muted-foreground mr-1 self-center">🔥 실시간 인기 검색어:</span>
              {topKeywords.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setQ(w);
                    runSearch(w);
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 hover:bg-white text-[color:var(--navy)] border border-white transition"
                >
                  <span className="text-[color:var(--mint-deep)] mr-1">{i + 1}</span>#{w}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {submitted && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          {results.length > 0 ? (
            <>
              <div className="text-sm font-bold text-[color:var(--navy)] mb-3 px-1">
                🔎 <span className="text-[color:var(--mint-deep)]">"{submitted}"</span> 검색 결과 {results.length}건
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((d) => (
                  <AnalyzerCard key={d.id} entry={d} />
                ))}
              </div>
            </>
          ) : (
            <div className="glass-card p-8 text-center space-y-4">
              <div className="text-5xl">🌱</div>
              <div className="text-lg font-black text-[color:var(--navy)]">
                아직 사전에 없는 단어예요!
              </div>
              <div className="text-sm text-muted-foreground">
                우리가 직접 분석해서 등록해 볼까요? 함께 뜻과 유해성을 살펴보고 바른 대안을 만들어요.
              </div>
              <button
                onClick={() => onRegisterNew(submitted)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-6 py-3 font-bold shadow-[var(--shadow-soft)] hover:scale-[1.03] active:scale-95 transition"
              >
                <BookOpen size={18} /> "{submitted}" 신규 등록 신청하기 <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyzerCard({ entry }: { entry: DictEntry }) {
  const g = gradeOf(entry.total_harmful_score);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  const Icon = g.tone === "safe" ? ShieldCheck : g.tone === "warn" ? ShieldQuestion : ShieldAlert;
  return (
    <div className="glass-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-2">
        <h3 className="text-2xl font-black text-[color:var(--navy)] truncate">{entry.word}</h3>
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
          style={{ background: bg }}
        >
          <Icon size={12} /> {entry.total_harmful_score} · {g.label}
        </span>
      </div>
      {entry.source && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--mint-deep)] bg-[color:var(--mint)]/40 rounded-full px-2 py-0.5">
          <Radio size={11} /> 출처 · {entry.source}
        </div>
      )}
      <p className="text-sm text-[color:var(--navy)] mb-3">{entry.student_definition}</p>
      <div className="rounded-2xl bg-white/60 p-3">
        <div className="text-xs font-bold text-[color:var(--mint-deep)] mb-1 flex items-center gap-1">
          <Sparkles size={12} /> 바른 우리말 대안
        </div>
        <ul className="text-sm text-[color:var(--navy)] space-y-0.5">
          {entry.alternatives.map((a, i) => (
            <li key={i}>· {a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}