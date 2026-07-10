import { useState } from "react";
import type { DictEntry } from "@/lib/literacy-types";
import { gradeOf } from "@/lib/literacy-types";

const MASTER_PW = "1234";

export function TeacherDashboard({
  dict,
  onApprove,
  onReject,
  onClose,
  onReset,
}: {
  dict: DictEntry[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [pw, setPw] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

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
            <button type="button" onClick={onClose} className="text-2xl">
              ×
            </button>
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto rounded-3xl bg-card p-6 border-2 border-[color:var(--navy)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-[color:var(--navy)] truncate">🧑‍🏫 교사 대시보드</h3>
            <p className="text-xs text-muted-foreground">단어 승인/반려 및 학급 데이터 관리</p>
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

        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <Stat label="대기" n={pending.length} color="var(--warn)" />
          <Stat label="승인" n={approved.length} color="var(--safe)" />
          <Stat label="반려" n={rejected.length} color="var(--danger)" />
        </div>

        <h4 className="font-black text-[color:var(--navy)] mb-2">⏳ 대기 중인 단어 ({pending.length})</h4>
        {pending.length === 0 ? (
          <div className="rounded-xl bg-[color:var(--muted)] p-4 text-sm text-muted-foreground">대기 중인 단어가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <PendingRow key={d.id} entry={d} onApprove={onApprove} onReject={onReject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="rounded-xl p-3 text-white" style={{ background: color }}>
      <div className="text-xs opacity-90 font-bold">{label}</div>
      <div className="text-2xl font-black">{n}</div>
    </div>
  );
}

function PendingRow({
  entry,
  onApprove,
  onReject,
}: {
  entry: DictEntry;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const g = gradeOf(entry.total_harmful_score);
  const bg = g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  return (
    <div className="rounded-xl border-2 border-[color:var(--border)] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-black text-[color:var(--navy)] text-lg truncate">{entry.word}</div>
          <div className="text-xs text-muted-foreground">
            제안 {entry.suggested_by} · {entry.timestamp} · 투표 {entry.vote_count ?? 1}
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: bg }}>
          {g.emoji} {entry.total_harmful_score}
        </span>
      </div>
      <p className="text-sm text-[color:var(--navy)]">{entry.student_definition}</p>
      <div className="mt-2 text-xs text-[color:var(--mint-deep)]">
        💡 대안: {entry.alternatives.join(" / ")}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-center">
        {(["aggression", "bullying", "discrimination", "violence", "grammar_destruction"] as const).map((k) => (
          <div key={k} className="rounded-md bg-[color:var(--muted)] py-1">
            <div className="text-muted-foreground">{k.slice(0, 4)}</div>
            <div className="font-black text-[color:var(--navy)]">{entry.evaluations[k].toFixed(1)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 justify-end">
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
      </div>
    </div>
  );
}