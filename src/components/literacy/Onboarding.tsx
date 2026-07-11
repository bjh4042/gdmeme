import { useState } from "react";
import type { Student } from "@/lib/literacy-types";
import logoAsset from "@/assets/logo.png.asset.json";

export function Onboarding({ onSubmit }: { onSubmit: (s: Student) => void }) {
  const [classCode, setClassCode] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(classCode)) return setErr("학급 코드는 4자리 숫자여야 해요.");
    if (!number.trim()) return setErr("학생 번호를 입력해 주세요.");
    if (!name.trim()) return setErr("이름을 입력해 주세요.");
    onSubmit({ classCode, number: number.trim(), name: name.trim() });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-[var(--shadow-soft)] border-2 border-[color:var(--mint-deep)]">
        <div className="text-center mb-6">
          <img
            src={logoAsset.url}
            alt="바른말 수호대 로고"
            className="w-full h-auto mb-2 rounded-xl"
          />
          <h1 className="text-2xl font-black text-[color:var(--navy)]">바른말 수호대</h1>
          <p className="text-sm text-muted-foreground mt-1">우리 반 고운 말 지키기 프로젝트</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[color:var(--navy)] mb-1">학급 코드 (4자리)</label>
            <input
              inputMode="numeric"
              maxLength={4}
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.replace(/\D/g, ""))}
              placeholder="예: 3105"
              className="w-full rounded-xl border-2 border-[color:var(--border)] px-4 py-3 text-lg font-mono tracking-widest focus:border-[color:var(--mint-deep)] outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-[color:var(--navy)] mb-1">번호</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="14"
                className="w-full rounded-xl border-2 border-[color:var(--border)] px-4 py-3 focus:border-[color:var(--mint-deep)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[color:var(--navy)] mb-1">이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full rounded-xl border-2 border-[color:var(--border)] px-4 py-3 focus:border-[color:var(--mint-deep)] outline-none"
              />
            </div>
          </div>
          {err && <p className="text-sm text-[color:var(--danger)]">{err}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] py-3 font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-pop)]"
          >
            수업 시작하기 →
          </button>
          <p className="text-xs text-muted-foreground text-center">
            개인정보는 저장되지 않으며, 이 기기의 브라우저에만 기록됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}