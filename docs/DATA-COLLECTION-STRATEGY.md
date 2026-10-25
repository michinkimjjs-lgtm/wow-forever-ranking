# 데이터 수집 전략 (Phase 4B)

> 작성일: 2026-10-25 · 관련 문서: `docs/DATA-SOURCE-POLICY.md`, `docs/BLIZZARD-API-INTEGRATION-PLAN.md`, `docs/SUBMISSION-SYSTEM.md`, `docs/ADMIN-REVIEW.md`, `docs/DATA-COVERAGE-MODEL.md`

## 1. 요약

| 경로 | 상태 | 찾을 수 있는 범위 | 검증 상태 |
|---|---|---|---|
| Collector 파일 제출 (`/submit`) | 운영 중 | 제출한 본인 캐릭터 | 커뮤니티 제출 |
| **웹 직접 등록 (`/contribute/register`)** | **구현, 현재 등록 차단** (§2.5) | 등록한 본인 캐릭터 | 커뮤니티 제출 |
| Blizzard 공식 API | 준비만 (미공개) | 공개되면 capability별로 다름 | (공개 후 결정) |

- 2026-10-25 기준 WoW: Forever용 Blizzard 웹 API는 공개되지 않았다. endpoint는 등록하지 않았고 capability는 모두 `UNKNOWN`이다.
- 쓰지 않는 방법: 무작위 이름 대입, 외부 사이트 스크래핑, 비공개·내부 API 접근, 제3자 랭킹·census 서비스 데이터(`docs/DATA-SOURCE-POLICY.md`).

## 2. 웹 직접 등록 (애드온 없이)

### 2.1 흐름

```text
/contribute/register 양식 (§2.5 조건을 만족할 때만 표시)
  → POST /api/v1/submissions/manual (Origin + CSRF + 요청 제한 + 크기·깊이)
  → §2.5 등록 가능 조건 검사 (불충족이면 503, 본문 해석·DB 저장 없음)
  → 개인정보 검사 + 동의 3개
  → manualCharacterSchema 검증 (브라우저·서버 같은 스키마)
  → normalizeManualCharacter (확인된 매핑이 없으면 MAPPING_PENDING)
  → 중복 / 반복 제출 제한 / 이전 제출과 충돌 비교
  → character_submissions 저장 (data_source = user_submission, review_status = PENDING 또는 CONFLICT)
  → 관리자 검토 (/admin/submissions, "웹 직접 등록"으로 표시) → 승인 시 수집 파이프라인으로 반영
```

- 기존 공개 제출과 같은 기능 플래그(`FEATURE_PUBLIC_SUBMISSIONS`), 비밀값, 동의·정책 버전, 요청 제한을 쓴다.
- **자동 반영하지 않는다.** `autoAcceptNonConflicting` 설정과 관계없이 항상 검토 대기로 저장한다.
- 승인돼도 `verification_status = COMMUNITY_SUBMITTED`, `data_source = user_submission`(화면 표시: 직접 제출)이다.
- mock 배포에서는 저장하지 않고 검증(dryRun)만 한다.

### 2.2 입력 항목과 선택지 근거

| 항목 | 처리 | 근거 |
|---|---|---|
| 지역 | Battle.net 지역 `us` / `eu` / `kr` / `tw` 중 선택 | Battle.net 개발자 문서 Regionality and APIs. Forever 제공 여부는 모두 `UNKNOWN` |
| 게임 규칙 | `config/rulesets.ts`에서 `AVAILABLE`인 일반 / 전쟁 / 롤플레잉 | `docs/RULESETS.md`. 하드코어(출시 후 제공)는 제외 |
| 이름 + 성 | 둘 다 필수 | Forever는 전체 이름이 region 안에서 고유. 첫 이름만으로 식별하지 않음 |
| 레벨 | 정수 | 최대 레벨은 설정값. 레벨 달성 시각은 받지 않음(`FIRST_OBSERVED`로만 기록) |
| 직업 / 종족 / 진영 / 길드 | 게임에 표시된 이름을 문자열로 | 코드 목록 미확인(명세서 §30-9) |
| 확인 시각 | KST 입력 → ISO 8601(+09:00) | 미래·너무 오래된 시각은 거부 |
| 장비 | 슬롯은 Gear Profile 슬롯 코드에서 선택, 최대 20개 | 아이템 번호가 없으면 표시용으로만 보관, 장비 계산 제외 |
| 확인 자료 | https 스크린샷 주소 또는 10자 이상 설명 | 이미지 업로드 저장소가 없어 파일은 받지 않음 |

### 2.3 매핑 표 (지금은 비어 있음)

`config/registration.ts`

- `regionCodeByBattleNetRegion.{beta,live}`: Battle.net 지역 → 데이터 영역 region 코드
- `classCodeByName.{beta,live}`: 게임 표시 직업 이름(NFC, 소문자) → 직업 코드
- 게임 규칙 → gameMode: `config/game-scopes.ts`의 Ruleset 매핑(실제 영역은 아직 미설정)
- 이름·성 구분자: `config/export-mapping.ts`의 `nameSeparator`(미확인)

표가 비어 있는 동안 직접 등록은 받지 않는다(§2.5). 표를 채울 때는 공식 자료나 실제 제출로 확인한 근거를 이 문서에 적는다. 표가 채워지면 등록을 다시 받을 수 있다.

### 2.4 DB 변경 (migration 0007)

```sql
ALTER TABLE "character_submissions" DROP CONSTRAINT "character_submissions_source";
ALTER TABLE "character_submissions" ADD CONSTRAINT "character_submissions_source" CHECK (data_source IN ('addon', 'user_submission'));
```

- 기존 행은 모두 `addon`이므로 바뀌지 않는다. 데이터 삭제·변경 없음. 새 표·열 없음.
- 같은 트랜잭션 안에서 실행된다(drizzle migrate). 실패하면 이전 상태로 돌아가고 빌드가 멈춘다(`docs/DEPLOYMENT.md`).
- **적용 시점: 이 변경이 main에 병합되면 다음 Vercel Production 빌드가 운영 DB에 자동 적용한다.** 그래서 병합 전에 보고한다.
- 되돌리기: 원래 제약(`data_source = 'addon'`)으로 되돌리는 migration은 `user_submission` 행이 없을 때만 가능하다.

### 2.5 등록 가능 조건과 차단 (2026-10-25 결정)

랭킹에 반영할 수 없는 자료는 받지 않는다. `lib/submissions/availability.ts`의 `evaluateManualRegistrationSetup`이 대상 영역(live 배포는 live, 그 밖에는 beta)에 대해 다음을 모두 확인한다.

| 조건 | 설정 | 현재 |
|---|---|---|
| 게임 범위(region / gameMode) | `config/game-scopes.ts` | live·beta 없음 |
| 이름과 성 구분자 | `config/export-mapping.ts` `nameSeparator` | 미확인 |
| Battle.net 지역 → region 매핑 1개 이상 | `config/registration.ts` | 없음 |
| 등록 가능 규칙 → gameMode 매핑 1개 이상 | `config/game-scopes.ts` | 없음 |
| 직업 이름 → 직업 코드 매핑 | `config/registration.ts` | 없음 |

- 하나라도 없으면: 화면은 입력 양식 없이 "현재 캐릭터 등록을 받지 않습니다"와 이유만 표시한다. API는 `503 REGISTRATION_UNAVAILABLE`로 거부하고(검증 요청 포함), DB에 연결하지 않는다.
- 조건을 만족해도 `FEATURE_PUBLIC_SUBMISSIONS`가 꺼져 있으면 화면은 "등록 기능이 열려 있지 않음"만 표시하고 API는 404다.
- 조건을 만족하면 매핑이 확인된 지역·규칙만 선택지로 보여 준다. 확인된 목록에 없는 직업 이름은 `MAPPING_PENDING`으로 보관한다.
- `/contribute`, `/submit`의 "애드온 없이 등록하기" 링크는 등록을 받을 때만 보인다.
- 값은 추측해서 채우지 않는다. 채울 때는 근거를 이 문서에 적는다.

Collector 제출(`/submit`)은 동작을 바꾸지 않았다. 같은 판단(`evaluateCollectorRankingSetup`: 게임 범위, 이름 구분자, region·gameMode·직업 값 매핑)이 안 되면 "현재 제출 자료는 랭킹에 반영되지 않습니다" 안내만 표시한다. Collector 제출도 차단할지는 별도 결정 사항이다.

## 3. 공식 API 준비: 발견(discovery)과 중복 제거

### 3.1 capability (모두 UNKNOWN)

`config/blizzard/capabilities.ts`에 다음을 추가했다. 리테일 WoW API에 비슷한 기능이 있지만 Forever 적용 여부는 확인되지 않았다.

| capability | 리테일 참고 | 찾을 수 있는 범위 |
|---|---|---|
| `leaderboard` | PvP·쐐기 순위표 | 상위 일부 캐릭터만 |
| `guild_roster` | 길드 구성원 (realm 기반) | 이미 아는 길드의 구성원만 |
| `character_search` | 없음 (리테일에도 이름 검색·전체 목록 API 없음) | — |
| `character_status` | 캐릭터 상태 (존재 여부, 같은 캐릭터인지) | 이미 아는 캐릭터의 상태 확인 |

### 3.2 발견 가능 범위와 보장 범위

`lib/collection/discovery.ts`

- 발견 경로: `leaderboard`, `guild_roster`, `character_lookup`(사용자가 이름으로 요청), `community_submission`, `addon_export`
- **어느 경로도 전체 캐릭터 목록을 보장하지 않는다(`canEnumerateAll: false`).** `describeDiscoveryCoverage`는 어떤 조합에서도 `canClaimAllCharacters: false`를 돌려준다. 그래서 "전체 서버" 표현은 계속 `evaluateServerWideClaim` 기준을 따른다.
- `CharacterDiscoverySource` 인터페이스만 정의했다. 공식 API가 공개되기 전에는 구현을 등록하지 않는다.

### 3.3 중복 제거 (조회 전)

`mergeDiscoveries`: 여러 경로에서 같은 캐릭터를 찾으면 한 번만 조회한다.

1. 외부 ID(+ region)가 같으면 같은 캐릭터 (이름이 바뀌어도)
2. 외부 ID가 없으면 자연 키 `(region, gameMode, 정규화한 전체 이름)`
3. 같은 자연 키에 외부 ID가 하나면 그쪽에 합치고, 둘 이상이면 `identityConflict`로 표시하고 합치지 않는다

저장 단계의 식별(`lib/ingestion`의 외부 ID → 자연 키)은 그대로 쓴다. 이 단계는 호출 수를 줄이는 용도다.

## 4. 30일 보존과 정기 갱신

### 4.1 Blizzard 정책

`config/blizzard/data-policy.ts`

- Blizzard에서 받은 플레이어 데이터는 최소 30일마다 다시 받아야 하며, 그러지 못하면 지운다(사용자가 비공개·삭제를 요청했을 수 있음). 근거: https://us.forums.blizzard.com/en/blizzard/t/data-protection-notice-and-faq/609
- 호출 한도: 시간당 36,000회, 초당 100회. 근거: https://community.developer.battle.net/documentation/guides/getting-started
- 우리 설정: 21일부터 다시 받기 시작(`refreshAfterDays`), 한도의 60%를 정기 갱신에 사용(`refreshShare`).
- 리테일 기준이다. Forever API가 공개되면 같은 조건인지 다시 확인한다(명세서 §30-28).

### 4.2 판단 함수 (실행 없음)

| 함수 | 결과 |
|---|---|
| `decideRetention` | Blizzard 출처만: 21일 전 `KEEP`, 21일부터 `REFRESH`, 30일부터 `PURGE`. 사용자 제출·애드온은 항상 `KEEP` |
| `decideOnStatusCheck` | 캐릭터 없음·다른 외부 ID → `PURGE`, 같은 캐릭터 → `REFRESH`, 일시 오류 → `RETRY` |
| `planRefreshBatch` | 한도 안에서 만료가 가까운 순으로 고르고, 미루면 다음 회차 전에 만료되는 캐릭터를 `atRisk`로 알림 |

### 4.3 결정이 필요한 사항: 삭제 금지 규칙과의 충돌

프로젝트 규칙은 "캐릭터, 장비, 스냅샷, milestone 데이터는 삭제하지 않는다"이다. Blizzard 정책은 30일 안에 다시 받지 못한 Blizzard 출처 데이터를 지우라고 한다. 공식 API를 연결하기 전에 다음 중 하나를 정해야 한다.

- 안 A: Blizzard 출처 행(관측·스냅샷·milestone)만 삭제하고, 다른 출처 데이터는 유지
- 안 B: Blizzard 출처 값을 별도 표에 두고 만료 시 그 표에서만 삭제. 랭킹·Armory는 유효한 값만 읽음

권장: 안 B. 기존 `characters`를 다시 설계하지 않고 새 표를 추가하는 규칙(CLAUDE.md §16)과 맞는다. 어느 쪽이든 공식 API 연결 단계의 별도 migration으로 진행하고, 그때 다시 보고한다.

### 4.4 향후 표 (아직 만들지 않음)

| 표 | 용도 |
|---|---|
| `provider_fetch_state` | 캐릭터별 Blizzard 마지막 수신 시각, 다음 갱신 예정, 상태 확인 결과 |
| `discovery_candidates` | 발견 경로·시각, 조회 대기 상태 |

## 5. 테스트 계획

| 영역 | 테스트 | 상태 |
|---|---|---|
| 직접 등록 스키마·선택지·매핑 비어 있음 | `tests/manual-registration.test.ts` | 구현 |
| 직접 등록 HTTP 보안(Origin, CSRF, 동의 3개, 개인정보, mock dryRun) | 같은 파일 | 구현 |
| 저장(검토 대기·매핑 대기), 중복, 반복 제한, 승인 후 반영, DB CHECK | 같은 파일 (PGlite + 실제 migration) | 구현 |
| 등록 차단: 양식 미표시, 안내 문구, API 503·DB 미연결·미저장, 관련 화면 링크, Collector 화면 영향 | `tests/registration-closed.test.tsx`, `tests/manual-registration.test.ts` | 구현 |
| 발견 중복 제거, 전체 목록 미보장 | `tests/data-collection.test.ts` | 구현 |
| 30일 보존 판단, 상태 확인 판단, 갱신 계획 | 같은 파일 | 구현 |
| capability `UNKNOWN`·endpoint 비어 있음 유지 | 같은 파일, `tests/provider-contract.test.ts` | 구현 |
| 실제 Forever API 응답 정규화, 상태 확인 호출, 갱신 작업 큐 | 공식 API 공개 후 (응답 예시를 fixture로 저장해 검증) | 대기 |
| 만료 데이터 삭제 실행 | §4.3 결정 후 | 대기 |
