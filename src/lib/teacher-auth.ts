// SHA-256 기반 교사 인증 + sessionStorage 임시 세션.
// 브라우저 창을 닫으면 자연 소멸(sessionStorage) → 재입장 시 재인증.

// SHA-256("1234") — 초기 기본 비밀번호. 필요하면 이 상수만 교체하면 된다.
export const TEACHER_PW_SHA256 =
  "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

const SESSION_KEY = "wt:teacher:session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2h

type Session = { token: string; exp: number };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTeacherPassword(pw: string): Promise<boolean> {
  if (!pw) return false;
  const hex = await sha256Hex(pw);
  return timingSafeEqualHex(hex, TEACHER_PW_SHA256);
}

function randomToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function issueTeacherSession(): Session {
  const s: Session = { token: randomToken(), exp: Date.now() + SESSION_TTL_MS };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
  return s;
}

export function readTeacherSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.token || !s?.exp || s.exp < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearTeacherSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}