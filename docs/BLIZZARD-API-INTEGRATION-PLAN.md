# Blizzard API 연동 계획

> 단계: Phase 2C (게임 접속 없이, 실제 API 호출 없이 작성)
> 작성일: 2026-10-07
>
> 관련 문서:
> - [`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md) (공개 자료 조사 결과)
> - [`PHASE2-DATA-COLLECTION.md`](./PHASE2-DATA-COLLECTION.md) §7
> - [`PHASE2-DATA-SOURCE-PLAN.md`](./PHASE2-DATA-SOURCE-PLAN.md)
> - [`STATIC-GAME-DATA.md`](./STATIC-GAME-DATA.md)
>
> 구현:
> - Provider: `providers/blizzard/*`
> - capability 설정: `config/blizzard/capabilities.ts`
> - endpoint 설정: `config/blizzard/endpoints.ts`

## 0. 현재 상태와 원칙

**2026-10-07 기준, Blizzard WoW: Forever 웹 API는 공개 자료로 확인되지 않았습니다.**

- Battle.net 개발자 문서에서 Forever용 namespace와 endpoint를 찾지 못했습니다(FOREVER-API-CAPABILITY S7).
- 그래서 지금은 다음 상태를 유지합니다.
  - capability 8개: 모두 `UNKNOWN`
  - endpoint registry: 비어 있음
  - 기본 Provider: 호출하면 네트워크 요청 없이 "미구성" 오류
- 이 문서에서 **확인 필요**로 표시한 항목은 공식 문서·약관을 확인하기 전에는 코드에 확정값으로 넣지 않습니다.
- Retail / Classic API의 경로·namespace를 Forever에도 같다고 가정하지 않습니다.

## 1. Battle.net 인증

| 항목 | 현재 상태 | 구현 |
|---|---|---|
| 인증 방식 | **확인 필요.** Battle.net 개발자 API는 OAuth client credentials를 쓰지만, Forever API가 같은 방식인지는 모름 | `BlizzardAuth` 인터페이스. 기본 구현 `ClientCredentialsAuth` |
| 토큰 URL | **확인 필요** | `BLIZZARD_OAUTH_TOKEN_URL` 환경변수. 코드에 기본값 없음. https만 허용 |
| 클라이언트 ID / 비밀값 | 개발자 포털에서 발급 (Forever 대상 여부 확인 필요) | `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET` 환경변수만. 저장소·로그에 남기지 않음 |
| 토큰 재사용 | — | 만료 60초 전까지 메모리에 보관 |
| 사용자 계정 인증 | 사용하지 않음 | 사용자 Battle.net 로그인·비밀번호를 받지 않음 (명세서 §27) |

방식이 다르면 `BlizzardAuth`의 새 구현만 추가합니다. Provider와 수집 파이프라인은 바꾸지 않습니다.

## 2. Forever API endpoint 확인

확인 순서:

1. 공식 개발자 문서에서 Forever용 game / namespace / region을 확인합니다.
2. 기능별로 `config/blizzard/capabilities.ts`를 고칩니다.
   - 근거가 있는 기능만 `AVAILABLE`로 바꾸고, `evidence`(문서 URL, 확인 날짜)를 적습니다.
   - 제공하지 않는다고 문서에 명시된 기능은 `UNAVAILABLE`로 둡니다.
   - 존재는 확인했지만 응답 값의 의미를 실제 호출로 확인해야 하면 `RUNTIME_REQUIRED`로 둡니다.
3. `config/blizzard/endpoints.ts`에 endpoint를 등록합니다.

endpoint 등록 규칙 (`EndpointRegistry`가 검증):

| 규칙 | 이유 |
|---|---|
| capability가 `AVAILABLE`이고 evidence가 있어야 함 | 확인되지 않은 기능의 URL을 만들지 않음 |
| 경로는 API base 기준 상대 경로(`/...`)만 | API base는 설정(`BLIZZARD_API_BASE_URL`)에서만 옴 |
| 전체 URL, `//`, `.`, `..` 금지 | 다른 호스트로 요청이 새지 않게 함 |
| 자리표시자는 `{region}`, `{gameMode}`, `{characterName}`, `{externalId}`, `{itemId}`, `{guildId}`만 | 값은 모두 URL 인코딩 |
| capability 하나에 endpoint 하나 | 어떤 요청을 쓰는지 명확하게 함 |

| capability | 현재 | 확인할 것 |
|---|---|---|
| `character_profile` | UNKNOWN | Profile API 존재, 캐릭터 조회 키(이름 + 성? 외부 ID?), realm 없는 구조에서의 경로 |
| `character_level` | UNKNOWN | 레벨, 레벨 달성 시각 제공 여부 (`SOURCE_REPORTED` 가능 여부) |
| `character_equipment` | UNKNOWN | 장착 장비, 장착 인스턴스 아이템 레벨 제공 여부 |
| `item` | UNKNOWN | Game Data item / media API |
| `guild` | UNKNOWN | 길드 API, 길드 식별자 |
| `achievement` | UNKNOWN | 업적 API |
| `dungeon` | UNKNOWN | 던전 기록 API |
| `raid` | UNKNOWN | 공격대 기록 API |

## 3. 캐릭터 Profile

- 공식 응답 형식은 **확인 필요**입니다. 그래서 `BlizzardResponseNormalizer` 인터페이스만 두었습니다.
- 정규화 결과는 다른 공급원과 같은 내부 계약(`ProviderCharacter`)을 따릅니다.
  - `BlizzardProvider`가 `providerCharacterSchema`로 다시 검증합니다. 계약을 어기면 `ProviderContractError`입니다.
  - 결과에 `dataEnvironment`는 없습니다. 수집 파이프라인이 서버 설정으로 부여합니다.
- 식별: 공식 캐릭터 ID가 있으면 `character_external_refs`(`data_source = blizzard`)에 저장합니다. 사용자 제출로 먼저 들어온 같은 캐릭터와는 자연 키 `(dataEnvironment, region, gameMode, name_normalized)`로 연결합니다(명세서 §7.3).
- 이름: Forever는 "이름 + 성"이 region 안에서 고유합니다(FOREVER-API-CAPABILITY §2-3). API가 이름을 어떻게 받는지(구분자, 대소문자)는 **확인 필요**입니다. 지금은 받은 이름을 그대로 인코딩합니다.
- 레벨 달성 시각을 API가 주면 `levelReachedAt` → milestone `SOURCE_REPORTED`, 주지 않으면 `FIRST_OBSERVED`입니다.

## 4. 장비

- 장착 장비와 인스턴스 아이템 레벨 제공 여부는 **확인 필요**입니다.
- 슬롯: 공식 응답의 슬롯 값 → 우리 슬롯 코드 매핑은 정규화 코드에서 Gear Profile의 `clientSlotName` 또는 별도 매핑 설정으로 처리합니다. 슬롯 번호를 코드에 고정하지 않습니다.
- 평균 장비 레벨과 순위는 언제나 서버가 Gear Profile로 계산합니다(`calculateEquippedItemLevel`). API가 평균을 주더라도 비교용입니다.
- beta / live 장비 랭킹은 `APPROVED` Gear Profile이 생길 때까지 계속 "장비 랭킹 준비 중"입니다.

## 5. 아이템

- 공식 Game Data API가 열리면 `ItemCatalogProvider` 구현을 하나 더 만들어 `items` 데이터셋으로 가져옵니다([`STATIC-GAME-DATA.md`](./STATIC-GAME-DATA.md) §6).
- 이용 조건(캐시 기간, 재배포)을 확인하고 `license.status = PERMITTED`, 조건 URL과 확인 날짜를 기록해야 저장됩니다.
- 아이콘: media API 형식과 이미지 사용 조건은 **확인 필요**입니다.

## 6. 길드

- 길드 API와 길드 식별자는 **확인 필요**입니다.
- 확인되면 `guild_external_refs`(`data_source = blizzard`)로 연결합니다. 기존 `guilds` 테이블은 다시 설계하지 않습니다.

## 7. Rate Limit

- Forever API의 호출 한도는 **확인 필요**입니다. 숫자를 가정하지 않습니다.
- 구현된 것:
  - HTTP 429는 `BlizzardApiError(retryable = true)`로 구분합니다.
  - 요청 시간 제한은 `BLIZZARD_API_TIMEOUT_MS`(기본 10초)입니다.
- 공개 후 추가할 것:
  - 공식 한도를 설정값으로 둡니다(코드에 고정하지 않음).
  - P1 BullMQ 작업 큐의 limiter로 초당 / 시간당 호출 수를 제한합니다.
  - 응답 헤더에 남은 한도가 있으면 그 값을 따릅니다(헤더 이름 확인 필요).

## 8. Retry

| 응답 | 처리 |
|---|---|
| 200 | 정규화 → 계약 검증 |
| 404 | `null` (캐릭터 없음). 재시도하지 않음 |
| 401 / 403 | 재시도 불가 오류. 인증 설정 확인 |
| 429 | 재시도 가능 오류 |
| 5xx, 연결 실패, 시간 초과 | 재시도 가능 오류 |
| 그 밖의 4xx | 재시도 불가 오류 |

- 재시도 자체는 Provider 안에서 하지 않고, P1 작업 큐가 지수 백오프로 합니다. 한 번의 수집 작업이 오래 막히지 않게 하기 위해서입니다.
- 정규화 실패(`ProviderContractError`)는 재시도하지 않고 원본을 `ingestion_records`에 남겨 정규화 코드를 고친 뒤 다시 처리합니다.

## 9. Cache

- 화면 캐시는 지금처럼 `cacheKey(dataEnvironment, ...)`로 영역 접두사를 붙입니다.
- API 응답 캐시 기간과 저장 허용 범위는 약관을 확인한 뒤 정합니다(**확인 필요**).
- 원본 응답은 약관이 허용하는 범위에서만 `ingestion_records`에 보관합니다. 허용하지 않으면 정규화 결과만 저장합니다.

## 10. 데이터 최신성

- `observedAt`: 우리 서버가 응답을 받은 시각
- `sourceUpdatedAt`: 응답 헤더 `last-modified`가 있으면 그 값. 다른 갱신 시각 필드가 있는지는 **확인 필요**
- 캐릭터 화면의 "마지막 확인", 랭킹의 "데이터 갱신"은 기존 규칙 그대로 KST로 표시합니다.
- 오래된 데이터(7일) 정책은 공급원과 관계없이 같습니다.
- 수집 주기와 대상 선정(어떤 캐릭터를 조회할지)은 공식 API가 제공하는 방식만 사용합니다(**확인 필요**).

## 11. 개인정보

- 공개 캐릭터 정보(이름, 레벨, 직업, 장비, 길드)만 저장합니다.
- 계정 정보, 이메일, Battle.net 비밀번호, BattleTag는 받지 않습니다.
- Forever는 성(surname)을 게임 안에서 숨길 수 있습니다. 공식 API가 숨긴 성을 어떻게 다루는지, 사이트에서 성을 표시해도 되는지는 **확인 필요**입니다. 확인 전에는 API가 공개로 제공하는 이름만 씁니다.
- 캐릭터 삭제·비공개 요청 처리 절차는 공개 전에 정합니다.

## 12. API 이용약관

확인 필요 항목:

- [ ] 랭킹 / Armory 서비스 구축 허용 여부
- [ ] 상업적 이용(광고 등) 허용 여부
- [ ] 데이터 캐시·보관 기간, 재배포 조건
- [ ] 이미지(아이콘) 사용 조건
- [ ] 필요한 attribution 문구
- [ ] "WoW", "Warcraft" 상표 사용 범위 (명세서 §30-16)

약관을 확인하기 전에는 `BLIZZARD_API_ENABLED`를 켜지 않습니다.

## 13. 공식 데이터와 사용자 제출 데이터 우선순위

### 13-1. 데이터 공급원 구분

| 구분 | dataEnvironment | dataSource | 검증 상태 | 용도 |
|---|---|---|---|---|
| **A. Blizzard 공식 데이터** | beta / live | `blizzard` | **결정 필요** (아래) | 공개되면 전체 랭킹의 최우선 공급원 |
| **B. 사용자 Collector 제출** | beta / live | `user_submission` (애드온 파서는 `addon`) | 항상 `COMMUNITY_SUBMITTED` | 공식 API 전까지 제출된 캐릭터만 랭킹 |
| **C. Mock** | mock | `mock` | 항상 `MOCK` | 개발 전용. 전용 DB에만 저장 |

- A·B는 같은 영역에 함께 있을 수 있습니다. C는 A·B와 절대 같은 DB·쿼리에 들어가지 않습니다(DB 트리거·CHECK·importer가 막음).
- `blizzard` 데이터의 기본 검증 상태는 **아직 정하지 않았습니다**.
  - 지금은 `defaultVerificationStatus("blizzard")`가 오류를 냅니다.
  - 데이터 출처만으로 자동 `VERIFIED`가 되지 않습니다.
  - 공식 API를 확인한 뒤 명세서 §11을 먼저 고치고 반영합니다.

### 13-2. 우선순위

같은 캐릭터가 여러 공급원에 있으면 검증 상태 순으로 우선합니다(`lib/domain/source-priority.ts`).

```text
VERIFIED → LOG_VERIFIED → COMMUNITY_SUBMITTED → UNVERIFIED → MOCK
```

- 검증 상태가 같으면 더 최근에 관측한 데이터를 씁니다.
- 이 우선순위는 저장된 검증 상태를 **바꾸지 않습니다**. 순서만 정합니다.
- 서로 다른 dataEnvironment의 데이터를 비교하면 예외가 납니다.
- 수집 파이프라인에 적용하는 일(같은 캐릭터의 현재 상태를 어느 공급원 값으로 정할지)은 공식 API가 열리는 단계에서 합니다. 그때 다음을 함께 정합니다.
  - 공식 데이터가 오래되었고 사용자 제출이 최신일 때의 처리
  - 레벨 감소 관측(식별 충돌) 규칙과의 관계

## 14. API가 공개되면 할 일 (체크리스트)

1. §2·§12 확인. 결과를 명세서 §30-1과 이 문서에 기록
2. `config/blizzard/capabilities.ts`: 확인된 기능만 `AVAILABLE` + evidence
3. `config/blizzard/endpoints.ts`: 공식 endpoint 등록
4. `BlizzardResponseNormalizer` 구현 + 공식 예시 응답으로 계약 테스트 (`tests/provider-contract.test.ts`에 사례 추가)
5. `blizzard` 기본 검증 상태 결정 (명세서 §11 → `defaultVerificationStatus`)
6. 환경변수 설정 후 `BLIZZARD_API_ENABLED=on`
7. P1: BullMQ 수집 작업, rate limit, 재시도
8. 공급원 우선순위를 수집 파이프라인에 연결
9. 공식 Game Data로 Item Catalog 데이터셋 가져오기
10. 공식 데이터로 Forever Gear Profile 검토 → `APPROVED` 버전 추가

`BlizzardProvider` 클래스와 `CharacterDataProvider` 인터페이스, 랭킹 엔진, 화면은 바꾸지 않아도 됩니다.
