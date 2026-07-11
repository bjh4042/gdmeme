import { useEffect, useRef, useState } from "react";
import type { Student, StudentRecord } from "@/lib/literacy-types";
import logoAsset from "@/assets/logo-v2.png.asset.json";

export function Onboarding({
  onSubmit,
  onAdmin,
  roster = [],
}: {
  onSubmit: (s: Student) => void;
  onAdmin?: () => void;
  roster?: StudentRecord[];
}) {
  const [classCode, setClassCode] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [logoLoaded, setLogoLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [kstTime, setKstTime] = useState(() => formatKST());
  useEffect(() => {
    const t = window.setInterval(() => setKstTime(formatKST()), 15_000);
    return () => window.clearInterval(t);
  }, []);
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
    const trimmedNumber = number.trim();
    const trimmedName = name.trim();
    const dup = roster.find(
      (r) => r.classCode === classCode && r.number === trimmedNumber,
    );
    if (dup && dup.name.trim() !== trimmedName) {
      const msg = `이미 등록된 아이디입니다.\n\n학급 ${classCode} · ${trimmedNumber}번은 이미 '${dup.name}' 학생이 사용 중이에요.\n번호를 다르게 입력하거나, 본인이면 등록된 이름 그대로 입력해 주세요.`;
      setErr("중복된 아이디입니다. 번호 또는 이름을 확인해 주세요.");
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    onSubmit({ classCode, number: trimmedNumber, name: trimmedName });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-white">
      {onAdmin && (
        <button
          type="button"
          onClick={onAdmin}
          title="교사 관리자 모드"
          className="fixed top-3 right-3 z-50 w-10 h-10 grid place-items-center rounded-full bg-white shadow-md border border-slate-200 text-lg hover:bg-slate-50 transition"
        >
          🧑‍🏫
        </button>
      )}
      {/* Smartphone frame */}
      <div
        className="relative w-full max-w-[360px] rounded-[3rem] bg-slate-900 p-3 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35),0_15px_30px_-15px_rgba(15,23,42,0.25)] ring-1 ring-slate-800/40"
      >
        {/* Side buttons */}
        <span aria-hidden className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-slate-700" />
        <span aria-hidden className="absolute -left-[3px] top-40 h-16 w-[3px] rounded-l bg-slate-700" />
        <span aria-hidden className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-slate-700" />

        {/* Inner screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-white flex flex-col">
          {/* Dynamic-island / notch */}
          <div aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-28 rounded-full bg-slate-900 z-20" />
          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-slate-700">
            <span>{kstTime}</span>
            <span className="flex items-center gap-1">
              <span aria-hidden>📶</span>
              <span aria-hidden>🔋</span>
            </span>
          </div>

          {/* Scrollable screen content */}
          <div className="px-5 pt-3 pb-4">
            <div className="text-center mb-3">
              <div
                className="relative w-full rounded-2xl overflow-hidden bg-slate-100"
                style={{ aspectRatio: "1024 / 559" }}
              >
                {!logoLoaded && (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 to-slate-100" aria-hidden="true" />
                )}
                <img
                  ref={imgRef}
                  src={logoAsset.url}
                  alt="바른말 수호대 로고"
                  width={1024}
                  height={559}
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => setLogoLoaded(true)}
                  className={`w-full h-full object-cover transition-opacity duration-150 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </div>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[color:var(--navy)] mb-1">학급 코드 (4자리)</label>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="예: 3105"
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-base font-mono tracking-widest focus:border-[color:var(--navy)] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[color:var(--navy)] mb-1">번호</label>
                  <input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="14"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 focus:border-[color:var(--navy)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--navy)] mb-1">이름</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 focus:border-[color:var(--navy)] outline-none"
                  />
                </div>
              </div>
              {err && <p className="text-xs text-[color:var(--danger)]">{err}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] py-3 font-bold text-base hover:opacity-90 transition shadow-[var(--shadow-pop)]"
              >
                수업 시작하기 →
              </button>
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                개인정보는 저장되지 않으며, 이 기기의 브라우저에만 기록됩니다.
              </p>
            </form>
          </div>

          {/* Home indicator */}
          <div aria-hidden className="pb-2 pt-1 flex justify-center">
            <span className="h-1 w-24 rounded-full bg-slate-800/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatKST(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${parseInt(h, 10)}:${m}`;
}
