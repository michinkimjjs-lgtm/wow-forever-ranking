# 캐릭터 데이터 제출 시스템

> 단계: Phase 3A (2026-10-07)
>
> 관련 문서:
> - [`PRIVACY-DATA-POLICY.md`](./PRIVACY-DATA-POLICY.md)
> - [`ADMIN-REVIEW.md`](./ADMIN-REVIEW.md)
> - [`CHARACTER-EXPORT-V1.md`](./CHARACTER-EXPORT-V1.md)
> - [`COMMUNITY-RANKING-PLAN.md`](./COMMUNITY-RANKING-PLAN.md)
>
> 구현:
> - 화면 `app/submit/page.tsx`, `components/submit/submit-form.tsx`
> - API `app/api/v1/submissions/character/route.ts`, `lib/submissions/*`
> - DB `character_submissions` (마이그레이션 0005, 0006)
> - 설정 `config/submissions.ts`

## 1. 개요

사용자가 ForeverRankCollector로 만든 **Character Export v1** 파일을 웹사이트에서 제출합니다.

```text
/submit 화면 (브라우저)
  파일 선택 → 크기 확인 → (.lua면 latestExportJson 추출) → JSON 파싱(깊이·길이 제한)
  → 개인정보 의심 값 검사 → 스키마 검증 → 미리보기 → 동의 2개 → 제출
        │ POST /api/v1/submissions/character  { export, consent }
        ▼
서버 (공개 제출 경로)
  Origin 확인 → 화면 보안 토큰(CSRF) → 요청 제한 → 크기·깊이 → 감싸는 형식 → 개인정보 의심 값 → 동의
  → validate → normalize → identify → calculate gear → duplicate check → conflict check → store
        ▼
character_submissions (검토 대기 PENDING / CONFLICT)
        ▼ 관리자 검토 (/admin/submissions)
승인 → 수집 파이프라인(ingestObservation) → characters / 장비 / 스냅샷 / milestone → 랭킹
거부 → 랭킹에 반영 안 함 (기록은 남김)
```

**제출만으로 랭킹이 바뀌지 않습니다.**

- 기본 설정(`autoAcceptNonConflicting: false`)에서는 모든 공개 제출이 관리자 승인 후 반영됩니다.
- 검증 상태는 언제나 `COMMUNITY_SUBMITTED`(커뮤니티 제출)입니다. DB CHECK로 강제합니다.
- 검토 상태(`reviewStatus`)와 검증 상태(`verificationStatus`)는 서로 다른 값입니다.

## 2. 기능 플래그와 환경변수

| 변수 | 용도 |
|---|---|
| `FEATURE_PUBLIC_SUBMISSIONS=on` | 공개 제출을 켭니다. 꺼져 있으면 `/submit`은 파일 확인·미리보기만 하고, API는 404 |
| `SUBMISSION_SECRET` (32자 이상) | 화면 보안 토큰 서명, 요청 제한용 일시 식별값, 관리자 로그인 서명. 없으면 공개 제출과 관리자 화면이 꺼집니다 |
| `SUBMISSIONS_ADMIN_TOKEN` (32자 이상) | 관리자 로그인과 관리자 API 토큰 |
| `FEATURE_CHARACTER_SUBMISSIONS=on` | 관리자 API 경로(Bearer 토큰, Phase 2B-1)를 켭니다 |

배포별 동작:

| 배포 | 공개 제출 |
|---|---|
| mock | **저장하지 않습니다.** 검증(dryRun)만 합니다. 화면에 "테스트 데이터 환경입니다…" 표시. 기존 mock 랭킹은 그대로입니다 |
| beta / live | 검토 대기로 저장합니다 |

## 3. 화면 (`/submit`)

- 제목은 "캐릭터 데이터 제출"이고, 설명 2줄을 표시합니다.
- 데이터 범위 / 데이터 출처 / 검증 상태:
  - Forever Rank가 확인한 캐릭터
  - 커뮤니티 제출
  - 커뮤니티 제출
- 안내 섹션:
  - 포함되는 데이터
  - 수집하지 않는 정보
  - 데이터 사용 방법
  - 삭제 요청
  - 데이터 출처와 검증 상태
  - 파일 만드는 방법
- 파일 선택 UI (Phase 3B):
  - 브라우저 기본 파일 입력("Choose File")은 숨깁니다.
  - 한국어 버튼 "파일 선택"(선택 후 "다른 파일 선택")을 씁니다.
  - "선택된 파일: (파일 이름)" 또는 "파일을 선택하세요."를 표시합니다.
  - "지원 형식: .json / .lua · 최대 256KB"를 안내합니다.
- 지원 파일:
  - `.json`: Character Export v1 JSON
  - `.lua`: Collector SavedVariables. 그 안의 `latestExportJson` 문자열을 브라우저에서 꺼냅니다
  - `.lua` 문자열 이스케이프 방식은 Runtime verification required입니다.
- 브라우저 검사 순서와 오류 문구:

| 단계 | 실패 문구 |
|---|---|
| 확장자 | 지원하지 않는 파일입니다. |
| `.lua` 안에 export 없음 | 파일에서 Forever Rank Character Export를 찾지 못했습니다. |
| 크기 (256KB) | 파일이 너무 큽니다. (최대 256KB) |
| JSON 파싱 | 지원하지 않는 파일입니다. JSON 형식이 아닙니다. |
| 깊이·길이·값 개수 | 파일 구조가 너무 깊거나 값이 너무 깁니다. |
| 개인정보 의심 값 | 개인정보나 계정 정보로 보이는 값이 있어 제출할 수 없습니다. |
| 스키마 | 캐릭터 데이터 형식이 올바르지 않습니다. |

- 미리보기 항목:
  - 캐릭터 이름, 성, 레벨, 직업, 종족, 진영, 길드
  - 장비 수, 평균 장비 레벨, 최고 아이템 레벨, coverage
  - 데이터 확인 시각(KST), 클라이언트 빌드
- 미리보기 계산 기준:
  - 장비 값은 슬롯 매핑 프로필(`forever-draft`, DRAFT)로 계산한 **참고용** 값입니다.
  - 직업·종족·진영은 클라이언트가 파일에 적은 표시 이름입니다.
  - GUID는 표시하지 않습니다.
- 동의 체크박스 2개를 모두 선택해야 제출 버튼이 켜집니다.
- 결과에는 제출 번호, 검토 상태, 검증 상태를 표시합니다. 이전 제출과 달라진 항목이 있으면 함께 보여 줍니다.
- 화면 폭이 좁아도 쓸 수 있습니다. 표 대신 2열 목록을 쓰고, 버튼은 모바일에서 전체 폭입니다.

## 4. 서버 처리 (`submitCharacterExport`)

| 단계 | 내용 | 실패 시 |
|---|---|---|
| validate | `characterExportV1Schema` (zod) | 400, 저장 안 함 |
| normalize | `config/export-mapping.ts`로 게임 값 변환 | 422, 저장 안 함.<br>**예외**: 공개 제출에서 원인이 매핑 미확인(`MAPPING_MISSING`, `NAME_SEPARATOR_UNCONFIRMED`, `SLOT_MAPPING_UNAVAILABLE`, `UNKNOWN_SLOT`)뿐이면 `MAPPING_PENDING`으로 보관 |
| identify | 외부 ID(GUID) → 자연 키 (읽기 전용) | — |
| calculate gear | 랭킹용 프로필(APPROVED) 또는 슬롯 매핑 프로필 | — |
| duplicate check | §6 | 중복이면 저장하지 않고 원래 제출의 `duplicate_count` 증가 |
| 반복 제출 제한 | 같은 캐릭터 10분 안 재제출, 검토 대기 5건 이상 | 429 |
| conflict check | §7 | 충돌이면 `CONFLICT` |
| store | 공개 제출: 검토 대기 저장<br>관리자 API: 충돌이 없으면 바로 반영(ACCEPTED) | — |

`MAPPING_PENDING`이 필요한 이유:

- 지금 `config/export-mapping.ts`는 모두 비어 있습니다. 직업·종족·지역·게임 모드 값이 Runtime verification required입니다.
- 그래서 실제 첫 제출은 정규화에 실패합니다.
- 이 제출을 버리지 않고 보관해 두면, 관리자가 원본 값을 보고 매핑을 확정한 뒤 승인(재처리)할 수 있습니다.

## 5. 보안

| 항목 | 구현 |
|---|---|
| 파일 크기 | 브라우저 256KB(.lua는 2배까지 읽고 추출한 JSON을 256KB로 제한). 서버: Content-Length와 실제 본문 모두 확인 (동의 정보 여유 4KB) |
| JSON 깊이 | 12단계 (`checkJsonLimits`, 반복문 검사라 깊은 입력에도 스택 오류 없음) |
| 문자열 길이 | 값·키 2,048자, 값 개수 20,000개 |
| 금지 키 | `__proto__`, `constructor`, `prototype` |
| 감싸는 형식 | `{ export, consent }` 외 필드 거부 (strict) |
| 요청 제한 | `RateLimiter` 인터페이스. 클라이언트별 시간당 10회, 서버 전체 시간당 500회 (메모리 구현, 여러 서버면 Redis 구현으로 교체) |
| 일시 식별값 | `HMAC(SUBMISSION_SECRET, 날짜 + IP + User-Agent)` 앞 32자. 메모리에서만 쓰고 **저장하지 않음**. 날짜가 바뀌면 달라짐 |
| CSRF | 화면이 발급한 서명 토큰(`x-forever-rank-csrf`, 2시간) + `Origin`이 `SITE_URL`과 같아야 함 + `Sec-Fetch-Site`가 있으면 `same-origin` |
| 반복 제출 | 같은 캐릭터 10분 간격, 검토 대기 최대 5건 |
| 비정상 요청 | JSON이 아니면 415, 잘못된 JSON 400, 개인정보 의심 422 |
| 관리자 인증 | [`ADMIN-REVIEW.md`](./ADMIN-REVIEW.md) §1 |

숫자는 `config/submissions.ts`에서 바꿉니다. 게임 데이터 가정이 아니라 운영 보호용 값입니다.

## 6. 중복 처리

다음 중 하나면 중복입니다.

1. 검증 결과(알 수 없는 필드 제거 후)의 정렬 JSON 해시(`payload_hash`)가 같음
   - 키 순서가 다르거나 알 수 없는 필드가 추가된 같은 파일도 중복입니다.
   - DB 고유 인덱스 `(data_environment, payload_hash)`로도 막습니다.
2. 같은 캐릭터(`identity_key`)이고 정규화한 관측 내용 해시(`content_hash`)가 같음

중복이면:

- 새로 저장하지 않습니다.
- 원래 제출의 `duplicate_count`와 `last_duplicate_at`을 갱신합니다.
- 응답으로 원래 제출 번호를 돌려줍니다.

## 7. 충돌 처리

같은 캐릭터(`identity_key` = GUID 해시, 없으면 region + gameMode + 전체 이름 해시)의 이전 제출과 비교합니다.

- 비교: `compareSubmissions` (Phase 2D, `lib/domain/submission-consistency.ts`)
- 기록 (`comparison`):
  - 이전 제출 ID
  - 이전 / 현재 관측 시각
  - 달라진 항목: 이름, 레벨, 직업, 종족, 진영, 길드, 장비 수, 평균 / 최고 아이템 레벨
  - 문제 코드

| 문제 | 심각도 | 결과 |
|---|---|---|
| `LEVEL_DECREASE` 레벨 감소 | 충돌 | `CONFLICT` |
| `SAME_TIME_DIFFERENT_LEVEL` 5분 안 레벨 다름 | 충돌 | `CONFLICT` |
| `CLASS_CHANGED` 직업 변경 | 충돌 | `CONFLICT` |
| `STRONG_ID_MISMATCH` GUID 다름 | 충돌 | `CONFLICT` |
| `RACE_OR_FACTION_CHANGED` | 경고 | 기록만 |
| `NAME_CHANGED` | 정보 | 기록만 |

- 충돌 제출은 **즉시 랭킹을 바꾸지 않습니다**. 관리자가 확인 후 결정합니다.
- 비교 대상:
  - 제출할 때: 거부되지 않은 모든 이전 제출 (검토 대기 포함)
  - 승인할 때: 이미 반영된(ACCEPTED) 제출만

## 8. 응답 (공개 제출)

```json
{
  "data": {
    "mode": "queued",
    "submissionId": "uuid",
    "reviewStatus": "PENDING",
    "verificationStatus": "COMMUNITY_SUBMITTED",
    "duplicate": false,
    "blockedReason": null,
    "preview": { "...": "미리보기 항목" },
    "changes": [],
    "conflict": false,
    "warnings": []
  },
  "meta": { "dryRun": false, "generatedAt": "..." }
}
```

- 내부 캐릭터 ID와 수집 기록 ID는 공개 응답에 넣지 않습니다.
- 오류 형식은 `{ error: { code, message } }`이고, `message`는 한국어입니다.

## 9. 실제 게임 접속 없이 검증한 것 / 실제 제출이 필요한 것

| 게임 접속 없이 검증 (`tests/submission-system.test.ts`, fixture 11개) | 실제 사용자 제출이 필요 |
|---|---|
| 파일 확인·미리보기·`.lua` 추출 | 실제 SavedVariables의 Lua 문자열 이스케이프 형식 |
| 보안(CSRF, Origin, 제한, 깊이, 민감정보) | 실제 export 크기·필드 분포 (제한값 조정) |
| 중복·충돌·반복 제출 | 실제 GUID 형식과 안정성 |
| MAPPING_PENDING 보관 → 매핑 후 승인 | `config/export-mapping.ts` 값 (직업·종족·진영·지역·게임 모드·품질·구분자) |
| 승인 시 랭킹 반영, 검증 상태 유지 | 민감정보 검사 오탐 여부 (실제 아이템 링크·길드 이름) |

## 10. mock 전용 처리 경로 (Phase 3D)

`lib/submissions/mock-export.ts`의 `processMockCharacterExport`는 테스트 fixture로 제출 흐름 전체를 게임 접속 없이 검증하는 경로입니다.

```text
validate → normalize → identify → Gear Profile → duplicate check → conflict check → storage → (ranking)
```

- `appEnv = mock`에서만 동작합니다. 저장되는 행은 `mock` / `mock` / `MOCK`입니다.
- `character_submissions`(실제 영역 전용)는 쓰지 않습니다.
  - 중복: `ingestion_records`의 원본 해시로 판단합니다.
  - 충돌: 캐릭터 현재 상태와 비교합니다. 충돌이면 저장하지 않습니다.
- 매핑은 테스트 전용 가짜 매핑(`tests/fixtures/character-export/mock/mapping.json`)을 씁니다. Gear Profile은 `forever-draft`(DRAFT)를 씁니다.
- 실제 제출 경로는 fixture 표식(`mock-fixture`)이 있는 export를 `MOCK_FIXTURE_REJECTED`로 거부합니다.
