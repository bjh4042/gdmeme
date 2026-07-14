# 바른말 수호대 교육적 리팩터링 계획

전면 재개발이 아닌 **기존 구조·데이터 유지 + 정보 위계·규칙 기반 안내 보강** 중심. 위험이 낮은 단계부터 순차 적용하고, 각 단계 후 기존 기능 동작을 확인한 뒤 다음 단계로 넘어갑니다.

## 사전 분석 (구현 전 1회)

- 현재 라우트: `src/routes/__root.tsx`, `src/routes/index.tsx` (단일 SPA 스타일 탭)
- 상태: `src/stores/{dict,engagement,roster,class,auth}.ts` (Zustand + persist)
- 핵심 도메인: `src/lib/{literacy-types,roadmap,weekly-survey,badges,literacy-seed}.ts`
- 주요 탭: `DictionaryTab / AnalyzerTab / AssistantTab / QuizTab / DashboardTab`
- 교사: `TeacherDashboard`, `RoadmapTeacherPanel`
- 이미 존재하는 것 → **재사용, 재구현 금지**: Roadmap 5단계 계산, StageChip, 주간 설문, 성찰 저널, 실천 로그(`practiceLogs`), 배지·XP, CSV/XLSX 내보내기, 위험도 SSOT(`riskBucketOf`)

## 단계별 작업

### 1단계 — 로드맵과 탭 연결 명료화 (저위험)
- 신규 유틸 `src/lib/stage-context.ts`: 탭 id → `{ stage, goal, next }` 매핑 (단일 SSOT)
- 각 탭 상단에 이미 있는 `StageChip` 옆에 한 줄 안내(`학습 목표 / 다음 활동`) 추가. 중복 표시 방지 위해 헤더 영역에만 배치
- `routes/index.tsx` 메인 제목 아래에 지도 문구 1줄 추가
- Roadmap 카드 정보 위계: 첫 화면에서 접근성 향상을 위해 `DashboardTab` 상단으로 이동(이미 상단이면 skip)
- **강제 잠금 금지**, 자유 이동 유지

### 2단계 — 검색·분석 결과 카드 순서 정리 (저위험, UI만)
- `DictionaryTab.tsx` 카드 컴포넌트 렌더 순서: 표현 → 뜻 → 출처/배경 → 5대 유해성 → **사용할 때 생각할 점** → 대체 표현 → 관련 학습 링크
- 신규 유틸 `src/lib/harm-hints.ts`: `Evaluation` → 규칙 기반 문구 배열 반환. AI 미사용, null/undefined 안전
- 빈 데이터 상태 문구 처리 (뜻/출처/대체 표현 부재 시)
- 카드 디자인 전면 교체 X — 섹션 헤더와 순서만 재배열

### 3단계 — 사전 등록 선택 필드 추가 (스키마 확장)
- `DictEntry`에 `context_note?: string`, `listener_effect?: string` 선택 추가
- `stores/dict.ts` `addProposal` 시그니처에 선택 필드 pass-through (기본값 undefined)
- 등록 폼(`DictionaryTab.tsx`의 제안 모달)에 **접기·펼치기** 섹션으로 두 항목 추가. `source`와 문구 차별화 안내
- 결과 카드에서 값 있을 때만 표시
- 기존 localStorage 마이그레이션 불필요(선택 필드라 undefined 허용)

### 4단계 — 성찰·실천 흐름 재사용 정리
- 기존 저널·주간 설문·`practiceLogs` 그대로 사용, 신규 저장소 만들지 않음
- 질문 문구 4종 통일(`src/lib/reflection-prompts.ts`) — 오늘 알게 된 표현 / 상대 감정 / 바꿔 말할 표현 / 실천 한 가지
- 저장 검증: `.trim()` 후 빈 문자열 차단, 동일 학생·동일 날짜·동일 내용 중복 저장 방지 로직
- 저장 후 피드백 문구 노출 ("오늘 생각한 바른 표현을 실제 대화에서도 실천해 보세요.")
- `RoadmapCard` 실천하기 진행률에 반영되는지 재확인 (`roadmap.ts` 이미 반영)
- 학생 ID 변경 시 데이터 유지: 기존 `${classCode}_${number}` 키 유지, 마이그레이션 없이 그대로 사용

### 5단계 — 교사 대시보드 교육적 요약
- `TeacherDashboard.tsx` 상단에 **요약 섹션**을 신설(기존 관리 UI는 아래로 유지)
  1. Roadmap 단계별 진행 현황 (기존 `RoadmapTeacherPanel` 재사용)
  2. 최근 활동 학생 top 5 (`engagement` 로그에서 파생)
  3. 학생별 진행률 요약 링크
  4. 많이 검색·제안된 표현 (dict `vote_count` 기준)
  5. 고유해성 표현 top (score ≥ 70)
  6. 승인 대기 제안 수
  7. 성찰·실천 참여율
  8. 퀴즈 영역별 결과 — **domain 데이터 존재 시에만** 표시
- 신규 유틸 `src/lib/teacher-insights.ts`: 규칙 기반 안내 문구 생성
- 데이터 없으면 "아직 기록된 활동이 없습니다" 빈 상태

### 6단계 — 익명 연구 데이터 내보내기
- `src/lib/anon-export.ts`:
  - 학생을 `joinedAt / number` 정렬 → `S01, S02...` 안정 매핑
  - CSV: UTF-8 BOM(`\uFEFF`) 접두
  - XLSX: 기존 `xlsx` 라이브러리 재사용
  - 컬럼: 익명코드/검색수/제안수/공감수/퀴즈수/성찰수/실천수/단계별 진행률/마지막 활동
- 파일명: `바른말수호대_익명_학습활동.csv` / `.xlsx`
- `TeacherDashboard` 내보내기 영역에 버튼 2개 추가 (기존 CSV/XLSX 인접 배치)

### 7단계 — 퀴즈 domain 필드 + 결과 피드백
- 퀴즈 문제 타입(`src/lib/quiz-bank-50.json` 로더 부분)에 `domain?` 선택 필드 확장
- 기존 문제 임의 재분류 X — 필드가 없으면 통계 미표시
- `QuizTab.tsx` 결과 화면에 총점 하단 피드백 섹션 추가
  - domain 별 정답률 계산 → 부족 영역별 규칙 안내(`src/lib/quiz-feedback.ts`)
  - domain 값이 하나도 없으면 총점 피드백만 표시

### 8단계 — PC 중심 UX·접근성·빈 상태 점검
- 우선 뷰포트: 1920×1080, 1366×768
- 표: `overflow-x-auto` 확인/추가, 모달 `max-h-[90dvh] overflow-y-auto`
- 아이콘 버튼 `aria-label` 감사, `Dialog` ESC 닫힘/포커스 관리(Radix 기본 활용)
- 유해성 표시에 숫자/텍스트/아이콘 동반 확인 (이미 대부분 충족)
- 빈 상태 문구 일괄 검토
- Playwright로 두 뷰포트에서 주요 화면 스크린샷 캡처

### 9단계 — 데모 데이터·초기화 안전성
- 교사 화면 상단에 소형 배너: "현재 화면은 기능 확인을 위한 예시 데이터입니다."
- 학생 화면 미표시
- 시드 로직: 실데이터 존재 시 재시드 방지 가드(이미 있으면 유지)
- 초기화 버튼: 2단계 확인(확인창 + 문구 입력 또는 재확인). 삭제 대상 명시
- 실제 학교/지역/교사/학생명 하드코딩 grep 후 제거

### 10단계 — 최종 검증
- `bun install && bun run lint && bun run build`
- 학생/교사 흐름을 Playwright로 자동 순회 스크린샷
- 새로고침 후 persist 유지 확인

## 데이터 타입 확장 (모두 선택 필드, 기존 데이터 호환)

```ts
DictEntry {
  ...
  context_note?: string
  listener_effect?: string
}
QuizItem { ...; domain?: "meaning" | "context" | "empathy" | "expression" }
```

## 위험 관리

- 단계마다 파일 수정을 최소 세트로 분리하여 각 단계 후 lint/build 통과 확인
- 3·7단계는 스키마 확장을 포함하므로 기존 persist 데이터에 대해 `undefined` 안전성 테스트
- 대형 컴포넌트(`DictionaryTab`, `TeacherDashboard`, `QuizTab`)는 재작성 대신 **섹션 삽입·순서 변경**만 수행

## 승인 요청

이 계획대로 1단계부터 순차 진행할까요? 특정 단계만 우선하고 싶으면 알려주세요 (예: "5·6단계 먼저").
