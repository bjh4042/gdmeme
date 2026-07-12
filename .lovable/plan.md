# 4대 신규 기능 통합 구현안

기존 4탭/Zustand/classCode 격리 구조는 그대로 두고, **단일 신규 스토어 `engagement`** 와 **프로필 모달** 하나를 축으로 4가지 기능을 얹습니다.

## 1. 신규 상태 — `src/stores/engagement.ts` (Zustand + persist)

한 개 스토어에 학생 단위(`studentId = classCode_number`)로 격리된 데이터를 담습니다.

```ts
type StudentEngagement = {
  likesGiven: Record<number /*entryId*/, ("bravo"|"learned"|"cheer")[]>; // 이 학생이 눌러본 반응
  likesReceivedCount: number;   // 뱃지 조건용
  journals: { date: string /*YYYY-MM-DD*/; text: string }[]; // 하루 1개
  streak: number;               // 연속일수(어제 작성 여부로 계산)
  lastJournalDate?: string;
  unlockedBadges: string[];     // ["empathy","recorder","lexicographer","etiquette"]
  quizAllClearRoleplay: boolean;// 5스테이지 올클리어 플래그
};

byStudent: Record<string, StudentEngagement>
likesByEntry: Record<number, Record<string /*studentId*/, ("bravo"|"learned"|"cheer")[]>>; // 어뷰징 방지 소스오브트루스
```

액션:
- `react(entryId, reactorId, authorId, reactorClass, authorClass, kind)` — 이미 눌렀는지 확인 → 신규면 저장 + `roster.addStudentXP(reactorId,+1)` + `roster.addStudentXP(authorId,+1)` + `class.addXP(reactorClass,+1)` + `class.addXP(authorClass,+1)`. 어뷰징 방지 = **학생 1명이 단어 1개당 kind별 1회**.
- `writeJournal(studentId, text)` — 오늘 이미 있으면 no-op 반환. XP +2, `streak` 계산 후 3연속이면 +10 보너스와 폭죽 이벤트 리턴.
- `checkBadges(studentId, ctx)` — 조건 만족 시 unlock 반환(신규 획득만).
- `markLexicographer(authorId)` — 사전 승인 훅에서 호출.
- `markEtiquetteMaster(studentId)` — 역할극 5스테이지 클리어 훅.

가비지 컬렉션: `journals` 90개 초과 시 앞에서 slice, `likesByEntry`는 승인 엔트리 삭제 시 정리(추후 hook).

## 2. UI 통합

### (A) `DictionaryTab.EntryCard` — 공감 버튼
카드 하단에 3개 버튼(👍/💡/👏). 각 버튼:
- 클릭 = `useDebouncedAction`으로 400ms 잠금.
- 이미 눌렀으면 `disabled` + 활성 스타일(pressed).
- 카운트 표시(`likesByEntry[entryId]` 집계).
- 클릭 → 스토어 `react()` 호출 → 폭죽 없는 소형 sonner toast + 카드 살짝 흔들림.

props로 `currentStudent`, `onReact(entryId, authorId, authorClass, kind)`를 위쪽에서 주입. 상위 `routes/index.tsx`에서 학급/작성자 정보 매핑.

### (B) 프로필 모달 — `src/components/literacy/ProfileModal.tsx` (신규)
헤더의 학생 뱃지 영역을 클릭하거나 새로 만든 👤 버튼으로 열림. 내부 섹션:
1. **오늘의 우리말 성찰**: textarea + "저장(+2 XP)". 오늘 이미 작성했으면 잠금 표시. streak 3 달성 시 canvas-confetti 폭죽 + toast(+10 XP).
2. **뱃지 도감**: 4칸 grid. 미획득은 grayscale+blur+🔒. 획득은 컬러 도트 아이콘.
   - `empathy` 공감의 기사: likesGiven 총 5회.
   - `recorder` 기록의 달인: streak≥3.
   - `lexicographer` 사전 편찬자: 승인된 자신의 단어≥1.
   - `etiquette` 예절 마스터: roleplay 5스테이지 올 클리어.
3. **📄 나의 언어 수호 리포트 보기** 버튼 → `ReportModal` 오픈.

### (C) 리포트 모달 — `src/components/literacy/ReportModal.tsx` (신규)
Glassmorphism 상장 카드. 내부 `ref` 요소를 `html2canvas`로 png export.
내용: 학생명·소속, 개인 누적 XP, 획득 뱃지 표시, 사전 기여도(승인/제안 수), 역할극 통과율(스토어에서 유도, 없으면 unlock 플래그 기반), 학급 언어 기상도 요약.
버튼: 💾 부모님께 자랑하기 → `html2canvas(node).then(c => c.toBlob(download))`.

**Prop 기반 재사용**: `ReportModal`은 `studentId`를 받아 스토어에서 데이터 조회 → 교사 대시보드에서도 같은 컴포넌트 사용.

### (D) 교사 대시보드 통합
학생 목록 각 행에 "📄 리포트" 액션 버튼 추가 → `<ReportModal studentId={r.id} viewerIsTeacher />` 열림. 학부모 배포용으로 PNG 저장 가능.

## 3. 훅 연결 (기존 로직 최소 침습)

- `routes/index.tsx` `onApprove` 이후: `engagement.markLexicographer(applicantId)`.
- `QuizTab` / `ChatbotTab`에서 역할극 스테이지 완료 시 `awardXP` 옆에 `engagement.reportRoleplayClear(studentId, stageId)` 훅 추가. 스테이지 세트(5)를 모두 클리어하면 `markEtiquetteMaster` 발동.
- 공감/저널의 XP 지급은 스토어 내부에서 `useRosterStore.getState()`, `useClassStore.getState()`를 직접 호출 → 전역 상태가 즉시 갱신되어 헤더 XP 인디케이터·타임라인이 자동 리렌더(기존 selector 그대로 동작).

## 4. 의존성

- `bun add zustand`(이미 있음), **`bun add html2canvas canvas-confetti`** (2종 신규).
- 폭죽은 canvas-confetti의 `fire()` 한 방(리포트/저널 스트릭).

## 5. 안전장치

- `classCode` 격리: 공감 XP는 `reactor`와 `author`의 홈 학급 각각에만 가산 → 다른 학급 XP는 절대 오염되지 않음.
- 어뷰징 방지: `likesByEntry[entryId][studentId]` 배열에 kind가 이미 있으면 액션 무시(스토어 레벨) + 버튼 `disabled`(UI 레벨) 2중 방어.
- 저널: `lastJournalDate === today`면 저장 버튼 잠금.
- 뱃지 해금은 조건 재계산 시 신규만 unlock 배열에 push(중복 방지).

## 6. 파일 변경 요약

신규:
- `src/stores/engagement.ts`
- `src/components/literacy/ProfileModal.tsx`
- `src/components/literacy/ReportModal.tsx`

수정:
- `src/components/literacy/DictionaryTab.tsx` — EntryCard 공감 버튼
- `src/components/literacy/TeacherDashboard.tsx` — 학생 행 리포트 버튼
- `src/routes/index.tsx` — Profile/Report 모달 오픈, engagement 훅 연결
- `src/lib/literacy-store.ts` — 얇은 `useEngagement` 어댑터 노출
- `src/components/literacy/QuizTab.tsx`, `ChatbotTab.tsx` — 역할극 클리어 시 `reportRoleplayClear`

전 과정 후 `tsgo` 타입체크. 진행할까요?
