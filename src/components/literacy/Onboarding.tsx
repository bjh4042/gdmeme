import { useEffect, useMemo, useRef, useState } from "react";
import type { Student, StudentRecord } from "@/lib/literacy-types";
import logoAsset from "@/assets/logo-v2.webp.asset.json";
import heroIllustration from "@/assets/hero-illustration.png.asset.json";

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
  const [touched, setTouched] = useState<{ classCode: boolean; number: boolean; name: boolean }>({
    classCode: false,
    number: false,
    name: false,
  });
  const [logoLoaded, setLogoLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const [remember, setRemember] = useState(false);
  const [kstTime, setKstTime] = useState("");
  useEffect(() => {
    setKstTime(formatKST());
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

  // 최근 로그인 정보 자동 완성
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("last_login_info");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.classCode === "string" &&
        typeof parsed.number === "string" &&
        typeof parsed.name === "string"
      ) {
        setClassCode(parsed.classCode);
        setNumber(parsed.number);
        setName(parsed.name);
        setRemember(true);
        window.setTimeout(() => submitRef.current?.focus(), 0);
      }
    } catch {
      /* storage/parse 실패 무시 */
    }
  }, []);

  // 필드별 실시간 유효성 — 사용자가 한 번이라도 입력한 필드에만 오류 노출.
  const trimmedNumber = number.trim();
  const trimmedName = name.trim();
  const errors = useMemo(() => {
    const e: { classCode?: string; number?: string; name?: string } = {};
    if (classCode.length > 0 && !/^\d{4}$/.test(classCode))
      e.classCode = "학급 코드는 숫자 4자리여야 해요.";
    if (trimmedNumber.length > 0 && !/^\d{1,3}$/.test(trimmedNumber))
      e.number = "번호는 숫자만 입력해요. (1~3자리)";
    if (trimmedName.length > 0 && trimmedName.length > 20)
      e.name = "이름은 20자 이하로 적어주세요.";
    return e;
  }, [classCode, trimmedNumber, trimmedName]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ classCode: true, number: true, name: true });
    if (!/^\d{4}$/.test(classCode)) return setErr("학급 코드는 숫자 4자리를 입력해 주세요.");
    if (!trimmedNumber) return setErr("학생 번호를 입력해 주세요.");
    if (!/^\d{1,3}$/.test(trimmedNumber)) return setErr("번호는 숫자만 입력해요.");
    if (!trimmedName) return setErr("이름을 입력해 주세요.");
    if (trimmedName.length > 20) return setErr("이름은 20자 이하로 적어주세요.");
    setErr("");
    if (remember) {
      try {
        window.localStorage.setItem(
          "last_login_info",
          JSON.stringify({ classCode, number: trimmedNumber, name: trimmedName }),
        );
      } catch {
        /* storage/parse 실패 무시 */
      }
    } else {
      try {
        window.localStorage.removeItem("last_login_info");
      } catch {
        /* storage/parse 실패 무시 */
      }
    }
    const dup = roster.find((r) => r.classCode === classCode && r.number === trimmedNumber);
    if (dup && dup.name.trim() !== trimmedName) {
      const msg = `이미 등록된 아이디입니다.\n\n학급 ${classCode} · ${trimmedNumber}번은 이미 '${dup.name}' 학생이 사용 중이에요.\n번호를 다르게 입력하거나, 본인이면 등록된 이름 그대로 입력해 주세요.`;
      setErr("중복된 아이디입니다. 번호 또는 이름을 확인해 주세요.");
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    onSubmit({ classCode, number: trimmedNumber, name: trimmedName });
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden flex items-center justify-center p-3 sm:p-6 bg-white">
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
      <div className="relative w-full max-w-[360px] min-w-0 h-[min(92dvh,760px)] sm:h-[min(760px,90dvh)] rounded-[3rem] bg-slate-900 p-3 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35),0_15px_30px_-15px_rgba(15,23,42,0.25)] ring-1 ring-slate-800/40">
        {/* Side buttons */}
        <span
          aria-hidden
          className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-slate-700"
        />
        <span
          aria-hidden
          className="absolute -left-[3px] top-40 h-16 w-[3px] rounded-l bg-slate-700"
        />
        <span
          aria-hidden
          className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-slate-700"
        />

        {/* Inner screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-white flex flex-col">
          <div className="absolute top-0 inset-x-0 z-30 bg-gray-50 border-b border-gray-100 text-gray-500 text-[10px] text-center py-1 px-2 rounded-t-[2.25rem]">
            🖥️ 학교 PC 및 태블릿(가로 모드) 환경 최적화
          </div>
          {/* Dynamic-island / notch */}
          <div
            aria-hidden
            className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-28 rounded-full bg-slate-900 z-20"
          />
          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-slate-700">
            <span suppressHydrationWarning>{kstTime || "9:41"}</span>
            <span className="flex items-center gap-1">
              <span aria-hidden>📶</span>
              <span aria-hidden>🔋</span>
            </span>
          </div>

          {/* Scrollable screen content */}
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="min-h-full flex flex-col justify-center gap-8">
              <div className="text-center">
                <div className="mx-auto max-w-[240px] sm:max-w-[320px] lg:max-w-[360px] mb-4">
                  <div
                    className="relative w-full rounded-2xl overflow-hidden bg-slate-100"
                    style={{ aspectRatio: "720 / 393" }}
                  >
                    {!logoLoaded && (
                      <div
                        className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 to-slate-100"
                        aria-hidden="true"
                      />
                    )}
                    <img
                      ref={imgRef}
                      src={logoAsset.url}
                      alt="바른말 수호대 로고"
                      width={720}
                      height={393}
                      fetchPriority="high"
                      decoding="async"
                      onLoad={() => setLogoLoaded(true)}
                      className={`w-full h-auto object-contain transition-opacity duration-150 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                  </div>
                </div>
                <h1 className="mt-2 text-base font-black text-[color:var(--navy)]">
                  바른말 수호대
                </h1>
                <p className="mt-1 text-[11px] leading-snug text-slate-600 px-2">
                  디지털 언어의 뜻과 맥락을 살펴보고,
                  <br />
                  상대를 존중하는 표현을 함께 만들어 가는 학습 공간
                </p>
                <ol
                  aria-label="바른말 수호 5단계 학습 흐름"
                  className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 flex-wrap"
                >
                  {[
                    { i: "🔎", t: "발견" },
                    { i: "🧭", t: "파헤치기" },
                    { i: "💗", t: "공감" },
                    { i: "✏️", t: "바꾸기" },
                    { i: "🌱", t: "실천" },
                  ].map((s, idx, arr) => (
                    <li key={s.t} className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <span aria-hidden>{s.i}</span>
                        <span>{s.t}</span>
                      </span>
                      {idx < arr.length - 1 && (
                        <span aria-hidden className="text-slate-300">
                          ›
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 mx-auto max-w-[260px] sm:max-w-[320px]">
                  <img
                    src={heroIllustration.url}
                    alt="태블릿과 책으로 바른말을 배우는 두 학생 일러스트"
                    width={1600}
                    height={1024}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto select-none"
                  />
                </div>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[color:var(--navy)] mb-1.5">
                    학급 코드 (4자리)
                  </label>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.replace(/\D/g, ""))}
                    onBlur={() => setTouched((t) => ({ ...t, classCode: true }))}
                    placeholder="예: 3105"
                    aria-invalid={touched.classCode && !!errors.classCode}
                    className={`w-full rounded-xl border-2 bg-white px-3 py-3 text-base font-mono tracking-widest outline-none transition ${
                      touched.classCode && errors.classCode
                        ? "border-[color:var(--danger)] focus:border-[color:var(--danger)]"
                        : "border-slate-200 focus:border-[color:var(--navy)]"
                    }`}
                  />
                  {touched.classCode && errors.classCode && (
                    <p className="mt-1 text-[11px] text-[color:var(--danger)]">
                      {errors.classCode}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--navy)] mb-1.5">
                      번호
                    </label>
                    <input
                      inputMode="numeric"
                      maxLength={3}
                      value={number}
                      onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                      onBlur={() => setTouched((t) => ({ ...t, number: true }))}
                      placeholder="14"
                      aria-invalid={touched.number && !!errors.number}
                      className={`w-full rounded-xl border-2 bg-white px-3 py-3 outline-none transition ${
                        touched.number && errors.number
                          ? "border-[color:var(--danger)] focus:border-[color:var(--danger)]"
                          : "border-slate-200 focus:border-[color:var(--navy)]"
                      }`}
                    />
                    {touched.number && errors.number && (
                      <p className="mt-1 text-[11px] text-[color:var(--danger)]">{errors.number}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--navy)] mb-1.5">
                      이름
                    </label>
                    <input
                      value={name}
                      maxLength={20}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="홍길동"
                      aria-invalid={touched.name && !!errors.name}
                      className={`w-full rounded-xl border-2 bg-white px-3 py-3 outline-none transition ${
                        touched.name && errors.name
                          ? "border-[color:var(--danger)] focus:border-[color:var(--danger)]"
                          : "border-slate-200 focus:border-[color:var(--navy)]"
                      }`}
                    />
                    {touched.name && errors.name && (
                      <p className="mt-1 text-[11px] text-[color:var(--danger)]">{errors.name}</p>
                    )}
                  </div>
                </div>
                {err && <p className="text-xs text-[color:var(--danger)]">{err}</p>}
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-[color:var(--navy)] focus:ring-[color:var(--navy)]"
                  />
                  <span>로그인 정보 기억하기</span>
                </label>
                <button
                  ref={submitRef}
                  type="submit"
                  className="w-full rounded-xl bg-primary text-primary-foreground py-4 font-bold text-base hover:opacity-90 transition shadow-[var(--shadow-pop)]"
                >
                  수업 시작하기 →
                </button>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  개인정보는 저장되지 않으며, 이 기기의 브라우저에만 기록됩니다.
                </p>
              </form>
            </div>
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
