import { useMemo, useState } from "react";
import type { DictEntry, Evaluation } from "@/lib/literacy-types";
import { computeTotal, gradeOf } from "@/lib/literacy-types";
import { Pencil, X, Plus, Trash2 } from "lucide-react";

const MASTER_PW = "1234";

type UpdatePayload = {
  word?: string;
  student_definition?: string;
  evaluations?: Evaluation;
  alternatives?: string[];
  source?: string;
};

export function TeacherDashboard({
  dict,
  onApprove,
  onReject,
  onUpdate,
  onClose,
  onReset,
}: {
  dict: DictEntry[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onUpdate: (id: number, patch: UpdatePayload) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [pw, setPw] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  if (!ok) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === MASTER_PW) setOk(true);
            else setErr("비밀번호가 올바르지 않아요.");
          }}
          className="w-full max-w-sm rounded-3xl bg-card p-6 border-2 border-[color:var(--navy)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-[color:var(--navy)]">🔐 교사 대시보드</h3>
            <button type="button" onClick={onClose} className="text-2xl">×</button>
          </div>
          <label className="block text-sm font-bold text-[color:var(--navy)] mb-1">마스터 비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-xl border-2 border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--mint-deep)]"
          />
          {err && <p className="text-sm text-[color:var(--danger)] mt-2">{err}</p>}
          <p className="text-xs text-muted-foreground mt-2">초기 비밀번호: 1234</p>
          <button className="mt-4 w-full rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] py-2 font-bold">
            입장
          </button>
        </form>
      </div>
    );
  }

  const pending = dict.filter((d) => d.status === "pending");
  const approved = dict.filter((d) => d.status === "approved");
  const rejected = dict.filter((d) => d.status === "rejected");
  const list = tab === "pending" ? pending : tab === "approved" ? approved : rejected;
  const editing = editingId != null ? dict.find((d) => d.id === editingId) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto rounded-3xl bg-card p-6 border-2 border-[color:var(--navy)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-[color:var(--navy)] truncate">🧑‍🏫 교사 대시보드</h3>
            <p className="text-xs text-muted-foreground">단어 승인·반려 및 데이터 편집</p>
          </div>
          <div className="shrink-0 flex gap-2">
            <button onClick={onReset} className="text-xs px-3 py-2 rounded-lg bg-[color:var(--muted)] font-bold">
              시드로 초기화
            </button>
            <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold">
              닫기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <TabStat label="대기" n={pending.length} active={tab === "pending"} color="var(--warn)" onClick={() => setTab("pending")} />
          <TabStat label="승인" n={approved.length} active={tab === "approved"} color="var(--safe)" onClick={() => setTab("approved")} />
          <TabStat label="반려" n={rejected.length} active={tab === "rejected"} color="var(--danger)" onClick={() => setTab("rejected")} />
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl bg-[color:var(--muted)] p-6 text-sm text-muted-foreground text-center">
            해당 상태의 단어가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((d) => (
              <EntryRow
                key={d.id}
                entry={d}
                showActions={tab === "pending"}
                onApprove={onApprove}
                onReject={onReject}
                onEdit={() => setEditingId(d.id)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          entry={editing}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            onUpdate(editing.id, patch);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function TabStat({
  label,
  n,
  color,
  active,
  onClick,
}: {
  label: string;
  n: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-white transition ${active ? "ring-4 ring-offset-2 ring-[color:var(--navy)]/30 scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
      style={{ background: color }}
    >
      <div className="text-xs opacity-90 font-bold">{label}</div>
      <div className="text-2xl font-black">{n}</div>
    </button>
  );
}

function EntryRow({
  entry,
  showActions,
  onApprove,
  onReject,
  onEdit,
}: {
  entry: DictEntry;
  showActions: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: () => void;
}) {
  const g = gradeOf(entry.total_harmful_score);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  return (
    <div className="rounded-xl border-2 border-[color:var(--border)] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-black text-[color:var(--navy)] text-lg truncate">{entry.word}</div>
          <div className="text-xs text-muted-foreground truncate">
            제안 {entry.suggested_by} · {entry.timestamp} · 투표 {entry.vote_count ?? 1}
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: bg }}>
          {g.emoji} {entry.total_harmful_score}
        </span>
      </div>
      <p className="text-sm text-[color:var(--navy)] line-clamp-3">{entry.student_definition}</p>
      <div className="mt-2 text-xs text-[color:var(--mint-deep)] truncate">
        💡 대안: {entry.alternatives.join(" / ") || "—"}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-center">
        {(["aggression", "bullying", "discrimination", "violence", "grammar_destruction"] as const).map((k) => (
          <div key={k} className="rounded-md bg-[color:var(--muted)] py-1">
            <div className="text-muted-foreground">{k.slice(0, 4)}</div>
            <div className="font-black text-[color:var(--navy)]">{entry.evaluations[k].toFixed(1)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {showActions && (
          <>
            <button
              onClick={() => onReject(entry.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--muted)] text-[color:var(--danger)]"
            >
              반려
            </button>
            <button
              onClick={() => onApprove(entry.id)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--safe)] text-white"
            >
              ✅ 승인
            </button>
          </>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--navy)] text-[color:var(--navy-foreground)] hover:scale-[1.03] transition"
        >
          <Pencil size={13} /> 데이터 수정
        </button>
      </div>
    </div>
  );
}

const EVAL_META: { key: keyof Evaluation; label: string; emoji: string }[] = [
  { key: "aggression", label: "공격성", emoji: "💥" },
  { key: "bullying", label: "따돌림", emoji: "🚫" },
  { key: "discrimination", label: "혐오성", emoji: "🙅" },
  { key: "violence", label: "폭력성", emoji: "⚔️" },
  { key: "grammar_destruction", label: "문법파괴", emoji: "🔤" },
];

function EditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: DictEntry;
  onClose: () => void;
  onSave: (patch: UpdatePayload) => void;
}) {
  const [word, setWord] = useState(entry.word);
  const [def, setDef] = useState(entry.student_definition);
  const [source, setSource] = useState(entry.source ?? "");
  const [evals, setEvals] = useState<Evaluation>({ ...entry.evaluations });
  const [alts, setAlts] = useState<string[]>([...entry.alternatives]);
  const [newAlt, setNewAlt] = useState("");

  const total = useMemo(() => Math.round(computeTotal(evals)), [evals]);
  const g = gradeOf(total);
  const badgeBg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";

  function updateEval(k: keyof Evaluation, v: number) {
    setEvals((prev) => ({ ...prev, [k]: v }));
  }
  function addAlt() {
    const t = newAlt.trim();
    if (!t) return;
    if (alts.includes(t)) return;
    setAlts([...alts, t]);
    setNewAlt("");
  }

  function save() {
    const w = word.trim();
    const d = def.trim();
    if (!w || !d) return;
    onSave({
      word: w,
      student_definition: d,
      source: source.trim() || undefined,
      evaluations: evals,
      alternatives: alts.slice(0, 8),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm overflow-y-auto p-4 flex items-start sm:items-center justify-center animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-3xl border border-white/60 shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))",
          backdropFilter: "blur(24px) saturate(160%)",
        }}
      >
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-4 border-b border-white/50 bg-white/40">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[color:var(--mint-deep)]">✏️ 데이터 수정</div>
            <h3 className="text-xl font-black text-[color:var(--navy)] truncate">{entry.word}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Word */}
          <Field label="낱말명">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              maxLength={40}
              className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
            />
          </Field>

          {/* Definition */}
          <Field label="뜻풀이 (초등 국어 눈높이 설명)">
            <textarea
              value={def}
              onChange={(e) => setDef(e.target.value)}
              maxLength={600}
              rows={4}
              className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)] resize-y"
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">{def.length}/600</div>
          </Field>

          {/* Source */}
          <Field label="출처 (선택)">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={120}
              placeholder="예: 국립국어원, 인터넷 커뮤니티 등"
              className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
            />
          </Field>

          {/* Harm sliders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-[color:var(--navy)]">5대 리터러시 유해성 점수 (1~5)</div>
              <div
                className="text-xs font-black px-3 py-1.5 rounded-full text-white shadow-sm transition-colors"
                style={{ background: badgeBg }}
              >
                {g.emoji} 종합 {total}/100 · {g.label}
              </div>
            </div>
            <div className="space-y-2">
              {EVAL_META.map(({ key, label, emoji }) => (
                <div key={key} className="rounded-xl bg-white/60 border border-white/70 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-bold text-[color:var(--navy)]">
                      {emoji} {label}
                    </div>
                    <div className="text-xs font-black text-[color:var(--navy)]">{evals[key].toFixed(1)}</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={evals[key]}
                    onChange={(e) => updateEval(key, Number(e.target.value))}
                    className="w-full accent-[color:var(--mint-deep)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Alternatives */}
          <Field label="바른 우리말 대안 표현">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {alts.length === 0 && <span className="text-xs text-muted-foreground">아직 대안이 없어요. 아래에서 추가해 주세요.</span>}
              {alts.map((a, i) => (
                <span
                  key={`${a}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--mint)] text-[color:var(--navy)] text-xs font-bold px-2.5 py-1"
                >
                  {a}
                  <button
                    onClick={() => setAlts(alts.filter((_, idx) => idx !== i))}
                    className="opacity-70 hover:opacity-100"
                    aria-label={`${a} 삭제`}
                    type="button"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newAlt}
                onChange={(e) => setNewAlt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAlt();
                  }
                }}
                maxLength={30}
                placeholder="새 대안 표현 (Enter로 추가)"
                className="flex-1 rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
              />
              <button
                type="button"
                onClick={addAlt}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[color:var(--mint-deep)] text-white text-sm font-bold hover:scale-[1.03] transition"
              >
                <Plus size={14} /> 추가
              </button>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/50 bg-white/40 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[color:var(--muted)] text-sm font-bold"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={!word.trim() || !def.trim()}
            className="px-5 py-2 rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] text-sm font-bold disabled:opacity-40 hover:scale-[1.03] transition"
          >
            💾 변경사항 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold text-[color:var(--navy)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}