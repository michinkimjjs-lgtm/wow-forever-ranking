# WoW Forever 랭킹 사이트 — Claude Code 개발 규칙

> 상세 설계는 `WOW_FOREVER_RANKING_SPEC.md`(v2, 설계 확정본)를 따른다.
> 이 파일은 개발할 때 반드시 지켜야 할 규칙의 요약이다. 두 문서가 충돌하면 명세서의 상세 규칙을 따르고, 두 문서를 함께 고친다.
> Phase 1 구현 결과 문서: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA-SPEC.md`, `docs/RANKING-RULES.md`
> Phase 2 문서: `docs/FOREVER-API-CAPABILITY.md`, `docs/CHARACTER-EXPORT-V1.md`, `docs/GEAR-PROFILE.md`, `docs/BLIZZARD-API-INTEGRATION-PLAN.md`, `docs/STATIC-GAME-DATA.md`

## 1. 프로젝트 목적

이 프로젝트는 **월드 오브 워크래프트: 포에버(WoW: Forever)** 전용 랭킹 및 Armory 웹사이트를 만드는 것이 목적이다.

### MVP 핵심 기능
- 현재 최고 레벨 캐릭터 랭킹
- 장착 평균 아이템 레벨 랭킹
- 최고 단일 장착 아이템 랭킹
- 캐릭터 검색
- 캐릭터 Armory
- 길드 정보
- 데이터 최신 시각 표시
- 캐릭터 성장 이력 저장(`character_snapshots`, `level_milestones`). 그래프 화면은 P1

### 향후 기능
- 레벨 / 장비 성장 그래프
- 던전 클리어 시간
- 공격대 클리어 시간
- 보스 처치 기록
- World First / Guild First / Class First / Faction First
- 직업별 / 진영별 / 길드별 랭킹
- 레벨 및 장비 성장 통계
- PvP 랭킹

---

# 2. 가장 중요한 언어 규칙

## 기본 언어는 한국어다.

사용자가 실제로 보는 **모든 웹사이트 UI 텍스트는 한국어를 기본 언어로 작성한다.**

다음 항목은 반드시 한국어를 기본으로 한다.

- 사이트 메뉴
- 버튼
- 제목
- 설명문
- 필터
- 검색창 안내문
- 표의 헤더
- 상태 문구
- 오류 메시지 (API 오류 응답의 `message` 포함)
- 빈 화면 메시지
- 로딩 문구
- 데이터 최신 시각
- 검증 상태
- 도움말
- SEO 제목
- SEO 설명
- Open Graph 기본 문구

예:

좋음:
- 홈
- 랭킹
- 레벨 랭킹
- 장비 랭킹
- 최고 아이템
- 캐릭터 검색
- 길드
- 마지막 확인
- 데이터 갱신
- 검증됨

나쁨:
- Home
- Ranking
- Gear Ranking
- Search Character
- Last Seen

코드에서 변수명, 함수명, 파일명, DB 컬럼명, enum 코드, API 경로는 영어를 사용해도 된다.
**영어 코드와 한국어 사용자 화면을 명확하게 분리한다.**

---

# 3. 다국어 구조

현재는 한국어가 기본 언어다.

향후 영어를 추가할 수 있도록 UI 문자열을 컴포넌트 안에 직접 하드코딩하지 않는다.

권장 구조:

```text
locales/
├─ ko/
│  ├─ common.ts
│  ├─ rankings.ts
│  ├─ characters.ts
│  ├─ guilds.ts
│  └─ game.ts      (직업·종족·진영·슬롯·검증 상태 코드 → 한국어)
│
└─ en/
   └─ 향후 추가
```

기본 locale:

```text
ko-KR
```

- DB에는 직업·종족·진영·슬롯을 영어 **코드**로 저장한다. 한국어 이름은 `locales/ko`에서 표시한다.
- 향후 언어 전환을 추가해도 한국어 UI가 기존 기능에서 깨지지 않아야 한다.

---

# 4. 제품 정의

서비스의 정체성:

> WoW: Forever의 레벨, 장비, 캐릭터 성장, 던전, 공격대 기록을 추적하는 독립 랭킹/Armory 플랫폼

참고 서비스:
- Raider.IO — 랭킹 UI, 필터, 캐릭터 페이지 구성 참고
- WOWF.IO — WoW: Forever 콘텐츠 및 정보 구조 참고
- WoW Forever Armory 계열 서비스 — 캐릭터 Armory 정보 구성 참고
- Classic Armory — 캐릭터/길드 탐색 UX 참고

단순 복제는 하지 않는다.

우리 서비스의 핵심 차별점:
- WoW: Forever 전용
- 최초 레벨 달성 기록
- 장비 성장 이력
- 데이터 갱신 시각
- 직업 / 진영 / 길드별 세분화
- 던전 / 공격대 World First

---

# 5. 기술 스택

## 프론트엔드
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## 백엔드
- Next.js Route Handlers / Server Actions
- TypeScript

## 데이터베이스
- PostgreSQL
- Drizzle ORM

## 캐시
- Redis

## 백그라운드 작업
- Node.js
- BullMQ

Phase 1에서는 다음과 같이 구현한다.
- 캐시는 인터페이스와 인메모리 구현으로 시작한다.
- 랭킹은 요청할 때 SQL로 계산한다.
- Redis와 BullMQ는 실제 데이터 수집을 연결하는 단계(P1)에서 도입한다.
- Ranking Engine과 캐시 인터페이스는 그때도 바뀌지 않도록 설계한다.

---

# 6. 확인되지 않은 것을 만들어내지 않는다

- WoW: Forever의 실제 API는 **아직 확정되지 않았다**는 전제로 설계한다.
- 존재가 확인되지 않은 Blizzard API 엔드포인트, 애드온 API, 게임 서버 구조(Realm 등)를 임의로 만들어 구현하지 않는다.
- 미확인 항목(명세서 §30)은 다음 중 하나로 처리한다.
  - 설정값
  - 초안(`DRAFT`) 값
  - 화면의 "준비 중" 상태
- 미확인 항목을 코드에 확정값으로 하드코딩하지 않는다.
- 게임의 최대 레벨, 장비 슬롯, region / gameMode 값, 직업 목록은 설정으로 관리한다.

---

# 7. 데이터 공급원 구조

웹사이트 UI는 외부 데이터 공급원이나 외부 게임 API에 직접 연결되어서는 안 된다.

모든 게임 데이터는 Provider 인터페이스와 수집 파이프라인(원본 저장 → 검증 → 빌드별 파서 → 정규화 → 식별 → 저장)을 통과한다.

권장 구조:

```text
providers/
├─ types.ts
├─ registry.ts
├─ mock/
│  └─ MockCharacterProvider.ts
├─ blizzard/
│  └─ BlizzardProvider.ts
└─ addon/
   ├─ AddonProvider.ts
   └─ parsers/
```

### MockProvider
현재 개발용. `APP_DATA_ENVIRONMENT=mock`일 때만 등록할 수 있다.

### BlizzardProvider
향후 Blizzard가 WoW: Forever 호환 웹/API를 제공하는 경우 연결한다.
확인 전까지 엔드포인트를 구현하지 않고, 호출하면 "미구성" 오류를 반환한다.
- capability(`config/blizzard/capabilities.ts`)는 확인 전까지 모두 `UNKNOWN`. 추측으로 `AVAILABLE`로 바꾸지 않는다.
- endpoint(`config/blizzard/endpoints.ts`)는 공식 근거가 있는 `AVAILABLE` 기능만 상대 경로로 등록한다. 지금은 비어 있다.
- URL·namespace·인증 값은 환경변수로만 받는다. 상세: `docs/BLIZZARD-API-INTEGRATION-PLAN.md`

### 공급원 우선순위
같은 캐릭터가 여러 공급원에 있으면 `VERIFIED → LOG_VERIFIED → COMMUNITY_SUBMITTED → UNVERIFIED → MOCK` 순으로 우선한다. 데이터 출처만으로 `VERIFIED` 처리하지 않는다.

### 정적 게임 데이터
아이템·직업·종족·진영·게임 모드·던전·공격대·보스는 버전별 데이터셋(`sourceBuild`, `interfaceVersion`, `datasetVersion`, `observedAt`)으로 가져온다. 덮어쓰지 않는다. 이용 조건을 확인하지 않은 데이터는 실제 DB에 넣지 않는다. 상세: `docs/STATIC-GAME-DATA.md`

### AddonProvider
공식 웹 API가 부족한 경우 사용자 동의 기반 데이터 제출/수집 구조를 지원한다. 파서는 `sourceBuild`별로 분리한다.

**특정 외부 사이트나 API를 사이트 전체의 핵심 데이터 원천으로 고정하지 않는다.**

---

# 8. 데이터 환경 분리와 무결성

## 용어

```text
dataEnvironment: mock | beta | live
dataSource:      mock | blizzard | addon | user_submission
```

- `beta`/`live`는 실제 데이터, `mock`은 개발용 가짜 데이터다.
- 서로 다른 `dataEnvironment`의 데이터는 비교·합산하지 않는다.

## 불변 규칙

```text
dataEnvironment = mock ⇔ dataSource = mock ⇔ verificationStatus = MOCK
```

DB CHECK 제약으로 강제한다.

## Mock 데이터와 실제 데이터는 어떤 쿼리에서도 섞이지 않는다

반드시 지킬 것:

- 모든 배포는 `APP_DATA_ENVIRONMENT`를 반드시 가진다. 없거나 잘못되면 앱이 시작하지 않는다.
- mock 데이터는 **전용 DB**에만 저장한다.
- 모든 DB에 `database_identity`(허용 dataEnvironment 목록)를 두고, 모든 게임 데이터 테이블에 쓰기 트리거를 건다. 허용되지 않은 영역의 행은 DB가 거부한다.
- 앱은 시작할 때 `APP_DATA_ENVIRONMENT`와 `database_identity`가 맞는지 확인한다.
- Mock seed는 다음을 모두 만족할 때만 실행된다.
  - `APP_DATA_ENVIRONMENT=mock`
  - DB 식별 표식이 mock
  - 실행 인자 `--confirm-mock`
- 저장할 행의 `dataEnvironment`는 서버 설정이 부여한다. 외부 payload의 값을 믿지 않는다.
- 모든 데이터 조회 함수는 `dataEnvironment` 범위를 **필수 인자**로 받는다. 기본값은 두지 않는다.
- 캐시 키는 `dataEnvironment`로 시작한다.
- 위 안전장치는 자동 테스트로 확인한다.

## 관측 메타데이터

모든 관측 데이터에는 가능하면 다음을 저장한다.

- `dataEnvironment`
- `dataSource`
- `sourceUpdatedAt`
- `lastSeenAt` / `observedAt`
- `verificationStatus`
- `gameMode`
- `sourceBuild`

원본 payload는 `ingestion_records`에 보관해 다시 처리할 수 있게 한다.

## Mock 표시

mock 배포는 모든 페이지에 다음 안내를 항상 표시한다. 이 안내는 끌 수 없다.

```text
베타 테스트 데이터
현재는 테스트 데이터가 표시되고 있습니다.
```

mock 배포는 검색 엔진에 노출하지 않는다(`noindex`).

---

# 9. 캐릭터 식별

- 캐릭터 이름만으로 식별하지 않는다.
- 식별 요소:
  - 내부 UUID
  - `externalId`(공급원별, `character_external_refs`)
  - `region`
  - `gameMode`
  - `dataEnvironment`
  - `characterName`
  - `name_normalized`(NFC + 소문자)
  - `slug`
- 식별 순서:
  1. 외부 ID 매핑
  2. 자연 키 `(dataEnvironment, region, gameMode, name_normalized)`
  3. 둘 다 없으면 새 캐릭터
- 고유 인덱스: `(data_environment, region, game_mode, slug)`
- **Realm은 실제 데이터에서 필요성이 확인되기 전까지 필수값으로 가정하지 않는다.** 확인되면 명세서 §7.5 절차로 컬럼과 인덱스를 추가한다.
- 레벨 감소 관측은 현재 상태에 반영하지 않고 "식별 충돌"로 기록한다.

URL:

```text
/characters/{region}/{gameMode}/{slug}
```

한글 이름은 로마자로 바꾸지 않고, 정규화한 이름을 URL 인코딩해 slug로 쓴다.

---

# 10. 레벨 랭킹 규칙

정렬 순서:

1. `level DESC`
2. 현재 레벨 milestone의 `effectiveReachedAt ASC` (NULL은 마지막)
3. `firstSeenAt ASC`
4. `characterName ASC`
5. `id ASC` (결과를 항상 같게 만들기 위한 최종 기준)

같은 레벨이라면 **해당 레벨에 더 먼저 도달(또는 먼저 관측)한 캐릭터가 높은 순위**다.

## level_milestones

`levelReachedAt` 한 값만으로 최초 달성을 표현하지 않는다. 캐릭터·레벨별로 `level_milestones`에 기록한다.

- `timing_basis`
  - `SOURCE_REPORTED`(실제 달성 시각) / `FIRST_OBSERVED`(최초 관측 시각) / `INFERRED`(건너뛴 중간 레벨)
- `reached_at`: 실제 달성 시각. `SOURCE_REPORTED`일 때만 값이 있다.
- `first_observed_at`: 최초 관측 시각. 항상 값이 있다.
- `previous_observed_at`: 직전 관측 시각
- `effective_reached_at`: 정렬에 쓰는 시각
- `data_source`, `verification_status`, `source_build`

근거 우선순위는 `SOURCE_REPORTED` > `FIRST_OBSERVED` > `INFERRED`다. milestone은 삭제하지 않는다.

`level_milestones`는 향후 다음 기록에 활용한다.

- 최초 10레벨
- 최초 20레벨
- 최초 30레벨
- …
- 최초 최대 레벨

공식 First 칭호는 `VERIFIED` 또는 `LOG_VERIFIED` 기록에만 부여한다.

실제 최대 레벨은 게임 버전에 따라 달라질 수 있으므로 숫자를 코드에 고정하지 않는다.

---

# 11. 장비 랭킹 규칙

## 평균 장비 레벨

Gear Profile의 **랭킹 대상 슬롯**에 장착한 아이템의 아이템 레벨 평균을 사용한다. 소수점 둘째 자리에서 반올림해 저장하고 표시한다.

정렬:

1. `averageItemLevel DESC`
2. `highestItemLevel DESC`
3. `characterName ASC`
4. `id ASC`

## 최고 단일 아이템

랭킹 대상 슬롯에 장착한 아이템 중 가장 높은 아이템 레벨을 사용한다.

정렬:

1. `highestItemLevel DESC`
2. `averageItemLevel DESC`
3. `characterName ASC`
4. `id ASC`

## Gear Profile (설정)

슬롯 정의를 코드에 하드코딩하지 않는다. `config/gear-profiles/*`에서 다음을 관리한다.

- 랭킹 대상 슬롯(`slots[].rankable`)
- 제외 슬롯(`excludedSlots`)
- 양손 무기 처리(`twoHandWeaponPolicy`: `COUNT_ONCE` | `COUNT_TWICE` | `OFFHAND_AS_EMPTY`)
- 미착용 슬롯 처리(`emptySlotPolicy`: `EXCLUDE_FROM_DENOMINATOR` | `COUNT_AS_ZERO`)
- 최소 데이터 커버리지(`minimumCoverage`)
- 프로필 상태(`DRAFT` | `APPROVED`)와 버전 (상세: `docs/GEAR-PROFILE.md`)

계산 결과에는 사용한 프로필 ID와 버전을 함께 저장한다.

## 미확정 구조 처리

- 실제 WoW: Forever 장비 구조가 확인되지 않은 부분은 임의로 확정하지 않는다.
- `beta`/`live`에 `APPROVED` 프로필이 없으면 장비 랭킹을 계산하지 않고 "장비 랭킹 준비 중"을 표시한다.
- mock은 `mock-provisional` 프로필을 쓸 수 있다.
- 가방 속 아이템은 저장하지도 계산하지도 않는다.
- 최소 커버리지에 못 미치는 캐릭터는 장비 랭킹에서 제외하고 Armory에 "장비 정보 부족"을 표시한다.

MVP에서는 임의의 자체 `Gear Score`를 만들지 않는다.

---

# 12. 랭킹 공통 규칙과 오래된 데이터

- 랭킹은 서버(`lib/ranking/`)에서 계산한다.
- 클라이언트나 수집 payload가 `rank` 값을 보내도 사용하지 않는다.
- 최종 기준(`id ASC`)까지 완전히 정렬하므로 동순위는 없다. 순위는 필터 적용 결과 안의 위치다.
- 랭킹 대상 조건:
  - 같은 `dataEnvironment`·`gameMode`
  - 최근 확인
  - 허용된 검증 상태
  - (장비 랭킹) 승인된 Gear Profile과 최소 커버리지

## 오래된 데이터

- 마지막 관측 후 **7일 이상** 지난 캐릭터는 현재 랭킹에서 제외한다.
- 장비 랭킹은 장비 관측 시각에도 같은 기준을 적용한다.
- 값은 설정 `ranking.staleAfterDays`로 바꿀 수 있다(dataEnvironment별 지정 가능).
- 캐릭터, 장비, 스냅샷, milestone 데이터는 **삭제하지 않는다.**
- 화면 안내: "최근 7일 이내에 확인된 캐릭터만 표시됩니다." (숫자는 설정값에서 가져온다)

---

# 13. 검증 상태

| DB 코드 | 한국어 UI |
|---|---|
| `VERIFIED` | 검증됨 |
| `LOG_VERIFIED` | 로그 검증 |
| `COMMUNITY_SUBMITTED` | 사용자 제출 |
| `UNVERIFIED` | 미검증 |
| `MOCK` | 테스트 데이터 |

- `addon`, `user_submission` 데이터의 기본값은 `COMMUNITY_SUBMITTED`다.
- `mock` 데이터는 항상 `MOCK`이다.
- 다른 표기(예: "검증 완료")를 쓰지 않는다.

---

# 14. 캐릭터 Armory

URL:

```text
/characters/{region}/{gameMode}/{slug}
```

필수 표시 정보:

- 캐릭터명
- 레벨
- 종족
- 직업
- 진영
- 길드
- 평균 장비 레벨
- 최고 아이템 레벨
- 현재 랭킹 (또는 랭킹 제외 사유)
- 마지막 확인 시각
- 데이터 출처
- 검증 상태
- 현재 레벨 달성 시각과 근거

장비 슬롯 목록과 순서는 Gear Profile을 따른다. 일반적인 WoW 슬롯 예시는 다음과 같다(실제 구조는 확인 필요).

- 머리
- 목
- 어깨
- 등
- 가슴
- 손목
- 손
- 허리
- 다리
- 발
- 반지 1
- 반지 2
- 장신구 1
- 장신구 2
- 주 무기
- 보조 무기 / 대체 무기 슬롯

실제 게임 데이터에서 지원하지 않는 슬롯은 억지로 표시하지 않는다.

---

# 15. 데이터 최신성과 시간 표시

랭킹 사이트에서는 데이터가 실제로 언제 갱신됐는지 명확해야 한다.

모든 주요 랭킹/캐릭터 화면에 다음 정보를 표시한다.

```text
데이터 갱신: 2026년 10월 6일 오후 3:42
마지막 확인: 2분 전
```

- DB는 UTC(`timestamptz`)로 저장한다.
- 사용자 화면은 대한민국 표준시(KST, `Asia/Seoul`)로 표시한다.
- 절대 시각 형식은 `2026년 10월 6일 오후 3:42`(12시간제, 오전/오후)다.
- 서버의 시스템 시간대에 의존하지 않는다.

---

# 16. DB 핵심 엔티티

MVP 필수:

- `database_identity`
- `static_datasets`, `static_data_records` (정적 게임 데이터, Phase 2C)
- `ingestion_records`
- `characters`
- `character_external_refs`
- `guilds`
- `guild_external_refs`
- `items`
- `character_items` (현재 장착 장비만)
- `character_snapshots`
- `level_milestones`

향후:

- `dungeons`, `dungeon_runs`, `dungeon_run_players`
- `raids`, `raid_bosses`, `raid_kills`, `raid_kill_participants`
- `first_records`
- `pvp_seasons`, `pvp_ratings`

규칙:

- 기본 키는 UUID다.
- 모든 게임 데이터 테이블은 `data_environment`, 쓰기 트리거, (해당 시) CHECK 제약을 가진다.
- 확장 테이블은 `data_source`, `verification_status`, `source_build`도 가진다.
- DB 변경은 migration으로 관리한다. 파괴적인 스키마 변경은 피한다.
- **확장은 기존 `characters`/`guilds`를 다시 설계하지 않고, 이를 참조하는 새 테이블을 추가하는 방식으로 한다.**

컬럼 상세는 명세서 §14를 따른다.

---

# 17. 캐릭터 성장 이력

`character_snapshots`와 `level_milestones`를 반드시 준비한다.

`character_snapshots` 최소 저장 항목:

- 캐릭터 ID
- 레벨
- 평균 장비 레벨
- 최고 아이템 레벨
- 장비 커버리지와 Gear Profile 버전
- 관측 시각
- 데이터 출처, 검증 상태, 빌드
- 정규화 데이터와 원본 payload 참조(`ingestion_record_id`)

저장 정책:

- 내용이 바뀌었을 때 저장한다.
- 내용이 같아도 기본 24시간마다 저장한다.
- 그 밖의 관측은 `last_seen_at`만 갱신한다.

이를 통해 향후 다음을 구현한다.

- 레벨 성장 그래프
- 장비 성장 그래프
- 하루 동안 가장 많이 성장한 캐릭터
- 최초 레벨 달성 기록

---

# 18. 랭킹 엔진

랭킹 로직은 UI 컴포넌트에 넣지 않는다.

권장 구조:

```text
lib/
└─ ranking/
   ├─ level.ts
   ├─ gear.ts
   ├─ highest-item.ts
   └─ index.ts
```

랭킹은 서버에서 계산한다.

클라이언트가 `rank` 값을 제출하거나 조작하는 것을 허용하지 않는다.

랭킹 규칙을 임의로 변경하지 않는다. 변경이 필요하면 명세서를 먼저 고친다.

---

# 19. API

초기 API:

```text
GET /api/v1/rankings/level
GET /api/v1/rankings/gear
GET /api/v1/rankings/highest-item
GET /api/v1/characters/search
GET /api/v1/characters/:id
GET /api/v1/characters/:region/:gameMode/:slug
GET /api/v1/guilds/:id
```

공통 요구사항:

- 서버 측 정렬
- 페이지네이션 (기본 50, 최대 100)
- 필터 (`gameMode`, `region`, `class`, `faction`, `guild`, `verifiedOnly`)
- 입력값 검증 (알 수 없는 파라미터는 400)
- 안정적인 응답 형식
- 오류 처리: `{ error: { code, message } }`, `message`는 한국어
- 데이터 최신성 메타데이터: `lastUpdatedAt`, `generatedAt`, `dataEnvironment`, `isMockData`, `policy`

API 경로는 영어로 유지해도 된다.
사용자 화면은 한국어로 표시한다.

---

# 20. UX / UI 규칙

시각 방향:

- 어두운 배경
- Warcraft 분위기
- 정보 중심
- 지나친 장식은 금지
- 랭킹 표 가독성 최우선
- 데스크톱/모바일 반응형

### 한국어 UI 예시

상단 메뉴:

```text
홈 | 랭킹 | 캐릭터 | 길드 | 통계
```

랭킹:

```text
레벨 랭킹
장비 랭킹
최고 아이템
```

상태:

```text
데이터 갱신
마지막 확인
검증됨
테스트 데이터
준비 중
현재 랭킹 제외
```

버튼:

```text
전체 랭킹 보기
캐릭터 검색
상세 보기
필터 적용
초기화
```

사용자가 보게 되는 문자열은 영어가 아니라 한국어를 사용한다.

게임 고유명사/아이템명/직업명 등은 **실제 게임 클라이언트에서 사용하는 한국어 명칭을 우선**한다.

---

# 21. 검색

캐릭터 검색은 다음을 지원할 수 있도록 설계한다.

- 캐릭터명
- 길드명
- 직업
- 진영
- 게임 모드

검색 규칙:

- 서버에서 수행한다.
- 항상 현재 `dataEnvironment` 안에서만 검색한다.
- 입력값과 대상 모두 NFC + 소문자로 정규화한다.
- 부분 일치는 `pg_trgm`을 사용한다.

검색 결과 예:

```text
캐릭터 검색 결과

홍길동
레벨 30 · 전사 · 호드
길드: 아제로스 수호대
```

검색 UI 문구 역시 한국어다.

---

# 22. SEO

주요 랭킹과 캐릭터 페이지는 검색 엔진에 노출 가능하도록 한다.

페이지별:

- 한국어 title
- 한국어 description
- canonical
- Open Graph
- 구조화 데이터

예:

```text
<title>WoW 포에버 레벨 랭킹 | Forever Rank</title>
```

- 영문 SEO는 향후 다국어 기능을 추가할 때 별도로 처리한다.
- mock 배포는 `noindex`.

---

# 23. 보안

- 모든 입력값 검증
- 공개 데이터 제출 API Rate Limit과 payload 크기 제한
- Battle.net 비밀번호 수집 금지
- 불필요한 개인정보 수집 금지
- 외부 ID 검증
- 가능한 경우 데이터 출처 검증
- 클라이언트가 제출한 랭킹 값을 신뢰하지 않음
- 수집 데이터의 `dataEnvironment`는 서버가 부여

---

# 24. 외부 데이터 사용 규칙

외부 사이트를 무단 스크래핑하여 핵심 서비스 데이터로 사용하지 않는다.

Raider.IO나 기타 제3자 서비스의 이용약관에 경쟁 서비스 구축 제한이 있는 경우, 해당 API를 핵심 랭킹 데이터 공급원으로 사용하지 않는다.

공식 Blizzard API가 제공되는 경우 우선 검토한다.

공식 API가 부족한 경우에는 사용자 동의 기반 제출/애드온 수집 방식을 검토한다.

---

# 25. 현재 WoW: Forever 데이터 현실

WoW: Forever는 베타 단계에서 클라이언트와 애드온 환경이 빠르게 변경될 수 있다.

따라서:

- 클라이언트 빌드를 저장한다.
- 데이터 공급원별·빌드별 파서를 분리한다.
- 아이템 슬롯 정의를 하드코딩하지 않는다(Gear Profile).
- 랭킹 로직과 데이터 수집 로직을 분리한다.
- 특정 빌드에 대한 가정은 문서화한다.
- 원본 payload를 보관해 재처리할 수 있게 한다.

현재는 Mock 데이터만으로 사이트를 개발할 수 있어야 한다.

실제 데이터로 확인이 필요한 항목은 명세서 §30에 정리되어 있다. 새로 발견한 미확인 사항도 그곳에 추가한다.

---

# 26. Claude Code 작업 순서

대규모 기능을 구현하기 전에 반드시:

1. 관련 문서를 읽는다.
2. 현재 저장소 구조를 확인한다.
3. 영향을 받는 모듈을 찾는다.
4. 구현 계획을 세운다.
5. 한 번에 하나의 수직 기능 단위로 구현한다.
6. 테스트를 추가한다.
7. 타입 검사 / 린트 / 테스트를 실행한다.
8. 문서를 갱신한다.

추가 규칙:

- 기존 아키텍처를 이유 없이 다시 만들지 않는다.
- 랭킹 규칙을 임의로 변경하지 않는다.
- 현재 구현 단계의 범위는 명세서 §32를 따른다.

---

# 27. 완료 기준

기능은 다음 조건을 모두 만족해야 완료로 본다.

- 한국어 UI가 정상 표시됨
- API 정상 동작
- DB migration 존재
- validation 존재
- 테스트 존재
- typecheck 통과
- lint 통과
- 관련 문서 갱신
- Mock / 실제 데이터가 올바르게 분리됨 (안전장치 테스트 통과)
- 데이터 최신 시각 표시 (KST 형식)
- 오래된 데이터 정책 적용
