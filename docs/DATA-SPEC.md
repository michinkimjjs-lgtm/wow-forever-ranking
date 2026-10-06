# 데이터 명세 — Phase 1

기준: 명세서 §6, §7, §8, §13, §14. 실제 스키마는 `db/schema.ts`와 `db/migrations/`가 원본이다.

## 1. 공통 규칙

- 기본 키는 UUID다.
- 시각은 `timestamptz`(UTC)다.
- 모든 게임 데이터 테이블은 `data_environment`(mock / beta / live)를 가진다. 쓰기 트리거가 `database_identity`에서 허용하지 않는 영역을 거부한다.
- CHECK 제약: `data_environment = mock` ⇔ `data_source = mock` ⇔ `verification_status = MOCK`
- 하위 테이블은 `(부모 id, data_environment)` 복합 외래 키로 부모와 같은 영역임을 보장한다.
- 직업·종족·진영·슬롯·품질은 영어 코드로 저장한다. 한국어 이름은 `locales/ko/game.ts`에서 표시한다.

## 2. 테이블

| 테이블 | 역할 | 고유 키 |
|---|---|---|
| `database_identity` | 이 DB가 받을 수 있는 데이터 영역 (단일 행, 변경·삭제 금지) | `id = 1` |
| `ingestion_records` | 수집한 원본 payload, 상태(ACCEPTED / REJECTED / IDENTITY_CONFLICT), 경고 | — |
| `guilds` | 길드 | `(data_environment, region, game_mode, slug)` |
| `guild_external_refs` | 공급원별 길드 외부 ID | `(data_environment, data_source, external_id)` |
| `characters` | 캐릭터 현재 상태 (랭킹 조회용 파생 값 포함) | `(data_environment, region, game_mode, slug)` |
| `character_external_refs` | 공급원별 캐릭터 외부 ID | `(data_environment, data_source, external_id)` |
| `items` | 아이템 기본 정보 | `(data_environment, external_item_id)` |
| `character_items` | **현재 장착** 장비만 | `(character_id, slot_code)` |
| `character_snapshots` | 관측 시점별 상태 이력 (정규화 데이터, content_hash) | — |
| `level_milestones` | 캐릭터·레벨별 달성 기록 | `(character_id, level)` |

### 프롬프트의 `environment` 필드

Phase 1 프롬프트의 `environment` 필드는 확정 설계에 따라 다음과 같이 구현했다.

- `environment` → `data_environment`(mock / beta / live)
- 출처 → `data_source`(mock / blizzard / addon / user_submission)

Mock 데이터는 프롬프트의 `environment = beta`가 아니라 다음 값을 가진다(명세서 §6.2).

```text
data_environment = mock
data_source = mock
verification_status = MOCK
```

## 3. 캐릭터 식별 (명세서 §7)

1. `(data_environment, data_source, external_id)` 외부 ID 매핑으로 찾는다.
2. 없으면 자연 키 `(data_environment, region, game_mode, name_normalized)`로 찾는다.
3. 둘 다 없으면 새 캐릭터를 만든다.

이름과 슬러그 규칙:

- `name_normalized`: NFC 정규화 → 공백 정리 → 소문자
- `slug`: 정규화 이름의 공백을 `-`로 바꾼 값. 한글은 로마자로 바꾸지 않는다.

예외 처리:

- 레벨이 낮아진 관측, 같은 이름에 다른 외부 ID → `IDENTITY_CONFLICT`. 현재 상태에 반영하지 않는다.
- 외부 ID가 같고 이름이 다르면 이름 변경으로 본다. 단, 새 슬러그를 다른 캐릭터가 쓰고 있으면 충돌로 처리한다.
- 늦게 도착한 오래된 관측은 현재 상태를 덮어쓰지 않는다. 스냅샷, milestone, `first_seen_at` 보정에만 쓴다.
- Realm은 필수값으로 가정하지 않았다(컬럼 없음).

## 4. level_milestones (명세서 §8.2, §8.3)

| 컬럼 | 의미 |
|---|---|
| `timing_basis` | `SOURCE_REPORTED`(공급원이 실제 달성 시각 제공) / `FIRST_OBSERVED`(최초 관측) / `INFERRED`(건너뛴 중간 레벨) |
| `reached_at` | 실제 달성 시각. `SOURCE_REPORTED`일 때만 값이 있다(CHECK 제약) |
| `first_observed_at` | 이 레벨 이상이 처음 관측된 시각 |
| `previous_observed_at` | 직전(더 낮은 레벨) 관측 시각 |
| `effective_reached_at` | 생성 컬럼. `SOURCE_REPORTED`면 `reached_at`, 아니면 `first_observed_at` |

갱신 규칙:

- 근거 우선순위는 `SOURCE_REPORTED` > `FIRST_OBSERVED` > `INFERRED`다.
- 근거 수준이 같으면 이른 시각을 채택한다.
- `first_observed_at`은 항상 더 이른 값을 유지한다.
- `characters.current_level_reached_at`과 `current_level_timing_basis`는 현재 레벨 milestone에서 파생한 캐시 값이다.

## 5. 스냅샷 정책 (명세서 §13)

- 정규화한 상태(레벨, 직업, 길드, 장비, 계산 값)의 `content_hash`가 직전 스냅샷과 다르면 저장한다.
- 내용이 같아도 24시간(`snapshotHeartbeatHours`)이 지났으면 저장한다.
- 그 밖의 관측은 `last_seen_at`만 갱신한다.

## 6. Mock 데이터

`lib/mock/generator.ts`가 만든다. 개발용 가짜 데이터이며 실제 WoW: Forever 정보가 아니다.

**결정성**

- 같은 `seed` + 같은 기준 시각(`anchor`)이면 항상 같은 데이터, 같은 UUID, 같은 순위가 나온다.
- 기본 anchor는 오늘 0시(UTC)다.

**구성 (기본값 seed=20261006)**

- 캐릭터 120명: 기본 모드 약 100명, 대체 모드 약 20명
- 직업 9개, 종족 8개, 양 진영, 길드 8개(약 15%는 길드 없음)
- 레벨 1~30
- 캐릭터당 관측 1~6회. 일부 관측은 여러 레벨을 건너뛰고, 일부는 실제 달성 시각을 제공한다.
- 장비
  - 아이템 레벨은 캐릭터 레벨 −3 ~ +6
  - 일부는 양손 무기, 셔츠(제외 슬롯), 아이템 레벨 정보 누락, 장비 부족(커버리지 미달)
- 약 15%는 마지막 관측이 8~25일 전이라 오래된 데이터(랭킹 제외)다.

**임시 값**

지역(`kr`), 게임 모드(`standard`, `alternate`), 직업·종족 코드, 장비 슬롯은 모두 mock 임시 값이다. 화면에도 "(임시)"로 표시한다.

**seed 실행**

```bash
npm run db:seed -- --confirm-mock [--seed=20261006] [--anchor=2026-10-06T00:00:00Z] [--count=120]
```

seed는 mock 영역 데이터만 지우고 다시 만든다.

## 7. API

| 메서드 / 경로 | 설명 |
|---|---|
| `GET /api/v1/rankings/level` | 레벨 랭킹 |
| `GET /api/v1/rankings/gear` | 장비 랭킹 |
| `GET /api/v1/rankings/highest-item` | 최고 아이템 랭킹 |
| `GET /api/v1/characters/search?q=` | 캐릭터 검색 (`q` 필수, 최대 32자) |
| `GET /api/v1/characters/:id` | 캐릭터 상세 (UUID) |
| `GET /api/v1/characters/:region/:gameMode/:slug` | 캐릭터 상세 (자연 키) |
| `GET /api/v1/guilds/:id` | 길드 상세 (UUID) |

**공통 파라미터** (목록 API)

`page`, `pageSize`(최대 100), `gameMode`, `region`, `class`, `faction`, `guild`(UUID), `verifiedOnly`, `dataEnvironment`

- 알 수 없는 파라미터, `rank` 같은 순위 값, 잘못된 값은 `400 INVALID_QUERY`로 응답한다.

**성공 응답**

```json
{
  "data": [{ "rank": 1, "character": { "id": "…", "name": "…", "slug": "…", "region": "kr", "gameMode": "standard" }, "level": 30 }],
  "meta": {
    "page": 1, "pageSize": 50, "total": 81,
    "dataEnvironment": "mock", "isMockData": true,
    "lastUpdatedAt": "2026-10-05T23:36:00.000Z", "generatedAt": "…",
    "policy": { "staleAfterDays": 7, "gearProfile": { "id": "mock-provisional", "version": 1, "status": "PROVISIONAL" } },
    "status": "ok"
  }
}
```

**오류 응답**

```json
{ "error": { "code": "INVALID_QUERY", "message": "요청 값이 올바르지 않습니다." } }
```

코드:

- `INVALID_QUERY` (400)
- `NOT_FOUND` (404)
- `SERVICE_UNAVAILABLE` (503: 설정 또는 DB 식별 표식 불일치)
- `INTERNAL_ERROR` (500)

## 8. 실제 데이터 확인이 필요한 항목

명세서 §30의 16개 항목이 그대로 남아 있다. 이번 단계에서 어떤 항목도 실제 값으로 확정하지 않았다.

- beta / live의 `gameScopes`와 `codes`는 `null`이다.
- beta / live에 쓸 `APPROVED` Gear Profile이 없다.
