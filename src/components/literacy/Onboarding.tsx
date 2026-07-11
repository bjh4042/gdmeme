import { useEffect, useRef, useState } from "react";
import type { Student } from "@/lib/literacy-types";
import logoAsset from "@/assets/logo.png.asset.json";

export function Onboarding({ onSubmit, onAdmin }: { onSubmit: (s: Student) => void; onAdmin?: () => void }) {
  const [classCode, setClassCode] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [logoLoaded, setLogoLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    // If the image was already cached (e.g. via <link rel=preload>), onLoad
    // may fire before React attaches the listener — sync from the DOM.
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLogoLoaded(true);
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(classCode)) return setErr("학급 코드는 4자리 숫자여야 해요.");
    if (!number.trim()) return setErr("학생 번호를 입력해 주세요.");
    if (!name.trim()) return setErr("이름을 입력해 주세요.");
    onSubmit({ classCode, number: number.trim(), name: name.trim() });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6" style={{ background: "var(--gradient-hero)" }}>
      {onAdmin && (
        <button
          type="button"
          onClick={onAdmin}
          title="교사 관리자 모드"
          className="fixed top-3 right-3 z-50 w-10 h-10 grid place-items-center rounded-full bg-white/80 shadow-md text-lg hover:bg-[color:var(--mint)] transition"
        >
          🧑‍🏫
        </button>
      )}
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-[var(--shadow-soft)] border-2 border-[color:var(--mint-deep)]">
        <div className="text-center mb-6">
          <div
            className="relative w-full mb-3 rounded-xl overflow-hidden bg-[color:var(--mint)]/20"
            style={{ aspectRatio: "1428 / 798" }}
          >
            {!logoLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[color:var(--mint)]/40 to-[color:var(--mint-deep)]/20" aria-hidden="true" />
            )}
            <img
              ref={imgRef}
              src={logoAsset.url}
              alt="바른말 수호대 로고"
              width={1428}
              height={798}
              fetchPriority="high"
              decoding="async"
              onLoad={() => setLogoLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-150 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[color:var(--navy)]">바른말 수호대</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">우리 반 고운 말 지키기 프로젝트</p>
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