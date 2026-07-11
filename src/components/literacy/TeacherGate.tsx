import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { issueTeacherSession, readTeacherSession, verifyTeacherPassword } from "@/lib/teacher-auth";

// 인증 성공 시에만 청크(chunk)를 네트워크로 가져온다.
// → 대다수의 학생 유저는 이 번들을 절대 다운로드하지 않는다.
const TeacherDashboard = lazy(() =>
  import("./TeacherDashboard").then((m) => ({ default: m.TeacherDashboard })),
);

type DashboardProps = ComponentProps<typeof TeacherDashboard>;

export function TeacherGate(props: DashboardProps) {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // sessionStorage에 살아있는 임시 토큰이 있으면 재입력 없이 통과.
  useEffect(() => {
    if (readTeacherSession()) setOk(true);
  }, []);

  if (ok) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
            <div className="rounded-2xl bg-card px-6 py-4 font-bold text-[color:var(--navy)] shadow-xl">
              📦 교사 대시보드 불러오는 중…
            </div>
          </div>
        }
      >
        <TeacherDashboard {...props} />
      </Suspense>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setErr("");
          try {
            const passed = await verifyTeacherPassword(pw);
            if (passed) {
              issueTeacherSession();
              setOk(true);
            } else {
              setErr("비밀번호가 올바르지 않아요.");
            }
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-sm rounded-3xl bg-card p-6 border-2 border-[color:var(--navy)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[color:var(--navy)]">🔐 교사 대시보드</h3>
          <button type="button" onClick={props.onClose} className="text-2xl" aria-label="닫기">
            ×
          </button>
        </div>
        <label className="block text-sm font-bold text-[color:var(--navy)] mb-1">마스터 비밀번호</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border-2 border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--mint-deep)]"
        />
        {err && <p className="text-sm text-[color:var(--danger)] mt-2">{err}</p>}
        <p className="text-xs text-muted-foreground mt-2">초기 비밀번호: 1234 · 창을 닫으면 세션 만료</p>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] py-2 font-bold disabled:opacity-60"
        >
          {busy ? "확인 중…" : "입장"}
        </button>
      </form>
    </div>
  );
}