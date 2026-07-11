
## 목표
LocalStorage 직접 접근을 걷어내고 Zustand로 전역 상태를 재편, 교사 인증을 SHA-256 해시로 강화 + 관리자 대시보드를 lazy 청크로 분리, 4개 탭을 keep-alive로 유지, 주요 액션 버튼에 500ms 디바운스를 적용합니다.

## 1. 상태 아키텍처 (Zustand)

`bun add zustand` 후 `src/stores/` 아래에 4개 스토어로 분리 — 각각 좁은 selector로만 구독시켜 리렌더를 최소화합니다.

- `authStore` — `currentUser`(id/이름/학급/번호/역할), 로그인·로그아웃 액션. `persist`로 저장.
- `classStore` — 학급별 `{ xp, activityLog }`. 키 = `classCode`. `persist`(부분).
  - `addXp(classCode, delta)`, `pushActivity(classCode, entry)` 액션.
  - **가비지 컬렉션**: `pushActivity` 안에서 `activityLog.length > 100` 이면 `slice(-100)`으로 큐 트리밍.
- `roleplayStore` — 학생별 `rooms: Record<studentKey, Record<scenarioId, RoomState>>`. `persist`(부분).
  - `appendMsg(studentKey, scenarioId, msg)` 안에서 방별 `msgs.length > 100` 이면 오래된 것부터 shift.
- `dictionaryStore` — 승인 대기/승인 완료 단어. `persist`.

공통 규칙:
- `persist` 미들웨어 + `partialize`로 저장 대상만 골라 저장 (휘발 필드는 제외).
- 컴포넌트는 반드시 `useStore(s => s.slice)` 형태의 selector로만 구독. 객체를 통째로 뽑지 않음.
- 기존 `src/lib/literacy-store.ts`의 read/write 함수는 스토어 액션으로 이관하고, 첫 로드 시 legacy 키를 한 번 마이그레이션한 뒤 삭제.

## 2. 교사 인증 보안 강화 + 코드 스플리팅

- `TeacherGate` 컴포넌트 신설: 비밀번호 입력 → Web Crypto `crypto.subtle.digest("SHA-256", ...)`로 해시 → 사전 정의된 상수 해시(`TEACHER_PW_SHA256`)와 상수시간 비교.
  - 기존 평문 `'1234'` 제거. 기본 비밀번호는 유지하되 파일에는 해시만 저장.
- 인증 성공 시 `sessionStorage`에 임시 토큰(랜덤 UUID + 만료 시각) 저장. 창을 닫으면 자연 소멸.
- `TeacherDashboard`는 `React.lazy(() => import("@/components/literacy/TeacherDashboard"))` + `<Suspense fallback>`으로 감싸 인증 성공 후에만 청크 로드.

## 3. 탭 Keep-alive

`src/routes/index.tsx`의 4개 탭 렌더를 조건부 `null` 대신 항상 마운트 + `hidden` 토글로 변경:

```tsx
<div hidden={tab !== "analyzer"}><AnalyzerTab .../></div>
<div hidden={tab !== "chatbot"}><ChatbotTab .../></div>
<div hidden={tab !== "assistant"}><AssistantTab .../></div>
<div hidden={tab !== "dictionary"}><DictionaryTab .../></div>
```

- 각 탭 컴포넌트를 `React.memo`로 감싸 props가 안 바뀌면 리렌더 스킵.
- 상위에서 내려주는 콜백들은 `useCallback`, 파생 객체는 `useMemo`로 안정화.
- 결과: 탭 전환 시 스크롤 위치, 입력 중인 텍스트, 챗 스크롤 상태가 그대로 유지.

## 4. 액션 버튼 디바운스

`src/lib/use-debounced-action.ts` 신설:

```ts
export function useDebouncedAction<T extends (...a: any[]) => void>(fn: T, ms = 500) {
  const lockRef = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lockRef.current < ms) return;
    lockRef.current = now;
    fn(...args);
  }, [fn, ms]) as T;
}
```

적용 대상 (모두 500ms 리딩 엣지 스로틀):
- `ChatbotTab`의 `send()` 및 힌트 칩 클릭
- `QuizTab`의 정답 버튼
- `AssistantTab`의 질문 칩/전송
- `DictionaryTab`의 신청/승인 버튼
- 교사 대시보드의 [승인] 버튼

## 5. 마이그레이션 & 검증

- 스토어 도입 후 기존 `literacy-store.ts` 훅 사용처를 스토어 selector로 교체. 옛 훅은 얇은 어댑터로 남겼다가 정리.
- `bunx tsgo --noEmit`로 타입 확인, 초기 로드 후 콘솔 에러/네트워크 확인.
- 시크릿: 교사 비밀번호 기본값은 코드에 해시로만 존재하므로 시크릿 저장 불필요. 사용자가 다른 비밀번호를 원하면 이후 별도 요청 시 처리.

## 확인이 필요한 한 가지

교사 기본 비밀번호를 현재의 `1234`에서 그대로 두고 해시화만 할지, 아니면 다른 문자열로 바꾸시겠어요? 기본값을 알려주시면 그 값으로 해시를 박아두겠습니다. (별도 언급이 없으면 `1234`의 SHA-256 해시를 그대로 사용하겠습니다.)
