import { useMemo, useState } from "react";
import type { DictEntry, Evaluation } from "@/lib/literacy-types";
import { KOREAN_INITIALS, ALPHABET, firstInitial, computeTotal, gradeOf, sortByInitial } from "@/lib/literacy-types";

export function DictionaryTab({
  dict,
  onSubmit,
  student,
}: {
  dict: DictEntry[];
  onSubmit: (payload: { word: string; student_definition: string; alternatives: string[]; evaluations: Evaluation; suggested_by: string }) => void;
  student: { classCode: string; number: string; name: string };
}) {
  const [filter, setFilter] = useState<string>("전체");
  const [openModal, setOpenModal] = useState(false);

  const approved = useMemo(
    () => dict.filter((d) => d.status === "approved").sort((a, b) => sortByInitial(a.word, b.word)),
    [dict],
  );
  const shown = useMemo(() => {
    if (filter === "전체") return approved;
    return approved.filter((d) => firstInitial(d.word) === filter);
  }, [approved, filter]);

  const filters = ["전체", ...KOREAN_INITIALS, ...ALPHABET];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="text-2xl font-black text-[color:var(--navy)]">📖 우리가 만드는 바른 우리말 사전</h2>
        <button
          onClick={() => setOpenModal(true)}
          className="rounded-xl bg-[color:var(--mint-deep)] text-white px-4 py-2 font-bold shadow-[var(--shadow-pop)] hover:opacity-90"
        >
          + 사전 등록 신청
        </button>
      </div>

      <div className="rounded-2xl bg-card border-2 border-[color:var(--border)] p-3">
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-w-[36px] px-2 py-1.5 rounded-lg text-sm font-bold transition ${
                filter === f
                  ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]"
                  : "bg-[color:var(--muted)] text-[color:var(--navy)] hover:bg-[color:var(--mint)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-card border-2 border-dashed border-[color:var(--border)] p-10 text-center text-muted-foreground">
          해당 초성/알파벳으로 등록된 단어가 아직 없어요.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <EntryCard key={d.id} entry={d} />
          ))}
        </div>
      )}

      {openModal && (
        <ProposalModal
          onClose={() => setOpenModal(false)}
          onSubmit={(payload) => {
            onSubmit({ ...payload, suggested_by: `${student.classCode}_${student.number.padStart(2, "0")}` });
            setOpenModal(false);
          }}
        />
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: DictEntry }) {
  const g = gradeOf(entry.total_harmful_score);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  return (
    <div className="rounded-2xl bg-card border-2 border-[color:var(--border)] p-4 hover:shadow-[var(--shadow-soft)] transition">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-2">
        <h3 className="text-xl font-black text-[color:var(--navy)] truncate">{entry.word}</h3>
        <span
          className="shrink-0 text-xs font-bold px-2 py-1 rounded-full text-white"
          style={{ background: bg }}
        >
          {g.emoji} {g.label}
        </span>
      </div>
      <p className="text-sm text-[color:var(--navy)] mb-3">{entry.student_definition}</p>
      <div className="mb-3">
        <div className="text-xs font-bold text-muted-foreground mb-1">유해 점수 {entry.total_harmful_score}/100</div>
        <div className="h-2 rounded-full bg-[color:var(--muted)] overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${entry.total_harmful_score}%`, background: bg }} />
        </div>
      </div>
      <div className="text-xs">
        <div className="font-bold text-[color:var(--mint-deep)] mb-1">💡 바른 대안 표현</div>
        <ul className="space-y-0.5 text-[color:var(--navy)]">
          {entry.alternatives.map((a, i) => (
            <li key={i}>· {a}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
        <span>제안 {entry.suggested_by}</span>
        <span>
          {entry.curriculum_code} · 투표 {entry.vote_count ?? 1}
        </span>
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
}: {
  onClose: () => void;
  onSubmit: (p: { word: string; student_definition: string; alternatives: string[]; evaluations: Evaluation }) => void;
}) {
  const [word, setWord] = useState("");
  const [def, setDef] = useState("");
  const [alt, setAlt] = useState("");
  const [ev, setEv] = useState<Evaluation>({
    aggression: 3,
    bullying: 3,
    discrimination: 3,
    violence: 3,
    grammar_destruction: 3,
  });
  const total = computeTotal(ev);
  const g = gradeOf(total);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim() || !def.trim() || !alt.trim()) return;
    onSubmit({
      word: word.trim(),
      student_definition: def.trim(),
      alternatives: alt.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      evaluations: ev,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl my-8 rounded-3xl bg-card p-6 border-2 border-[color:var(--mint-deep)] shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-[color:var(--navy)]">📝 사전 등록 신청</h3>
          <button type="button" onClick={onClose} className="text-2xl">
            ×
          </button>
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">단어명 *</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--mint-deep)]"
              placeholder="예: 어쩔티비"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">학생들이 정의한 뜻 *</span>
            <textarea
              value={def}
              onChange={(e) => setDef(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border-2 border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--mint-deep)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--navy)]">바른 우리말 권장 대안 표현 * (쉼표로 구분)</span>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--mint-deep)]"
              placeholder="네 생각을 존중해, 그렇게 생각할 수도 있겠구나"
            />
          </label>
        </div>
        <div className="mt-5">
          <h4 className="text-sm font-black text-[color:var(--navy)] mb-2">리터러시 유해성 5대 척도 (1~5점)</h4>
          <div className="space-y-3">
            {EVAL_LABELS.map((l) => (
              <div key={l.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[color:var(--navy)]">{l.label}</span>
                  <span className="font-mono font-bold text-[color:var(--mint-deep)]">{ev[l.key]}점</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">{l.hint}</div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={ev[l.key]}
                  onChange={(e) => setEv({ ...ev, [l.key]: Number(e.target.value) })}
                  className="w-full accent-[color:var(--mint-deep)]"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-2xl p-4 text-white" style={{ background: bg }}>
          <div className="text-xs opacity-90">종합 유해 점수</div>
          <div className="text-3xl font-black">
            {total}/100 {g.emoji}
          </div>
          <div className="text-sm font-bold">{g.label}</div>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-[color:var(--muted)] font-bold">
            취소
          </button>
          <button type="submit" className="px-5 py-2 rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold">
            교사 승인 요청 보내기
          </button>
        </div>
      </form>
    </div>
  );
}