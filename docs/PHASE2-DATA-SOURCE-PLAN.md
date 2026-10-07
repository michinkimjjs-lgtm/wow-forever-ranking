# Phase 2 — 데이터 공급원 계획

> 단계: Phase 2A-OFFLINE
> 근거 문서
> - [`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md): 클라이언트 API 분석과 출처
> - [`CHARACTER-EXPORT-V1.md`](./CHARACTER-EXPORT-V1.md): 로컬 내보내기 형식
> - [`PHASE2-DATA-COLLECTION.md`](./PHASE2-DATA-COLLECTION.md): Phase 2A Probe 설계
>
> 출처 ID(S1~S7)는 `FOREVER-API-CAPABILITY.md` §1을 따릅니다.

## 0. 먼저 구분해야 할 두 문제

**"공개 API surface를 확인하는 것"과 "전체 캐릭터의 현재 상태를 수집하는 것"은 다른 문제입니다.**

| 질문 | 현재 답 | 이유 |
|---|---|---|
| 클라이언트가 어떤 API를 제공하는가? | **가능 (이번 단계에서 대부분 확인)** | Forever 클라이언트 API 문서 덤프(S1·S2)와 Forever UI 소스(S3)가 공개됨 |
| 아이템 마스터 데이터(이름, 레벨, 슬롯, 품질)를 얻을 수 있는가? | **상당 부분 가능** | 클라이언트 API, 공개 아이템 사이트(S4, 이용 조건 확인 필요), 향후 공식 Game Data API |
| 던전 / 레이드 정적 데이터(이름, 보스)를 얻을 수 있는가? | **상당 부분 가능** | 클라이언트 API(`EncounterInfo`, `C_EncounterJournal`)와 공개 데이터. 다만 베타 규칙 `EncounterJournalDisabled=1`(S2) |
| **모든 캐릭터의 레벨**을 얻을 수 있는가? | **불가능 (공개 전체 데이터가 없음)** | 애드온은 자기 캐릭터만 읽을 수 있음. Blizzard Forever 웹 API는 미공개(S5, S7) |
| **모든 캐릭터의 장비**를 얻을 수 있는가? | **불가능 (공개 전체 데이터가 없음)** | 위와 같음. 다른 플레이어 Inspect는 정책상 하지 않음 |

결론:

- 이번 단계로 "**무엇을 어떤 API로 읽는지**"는 정해졌습니다.
- 하지만 "**모든 캐릭터의 데이터를 서버가 직접 가져오는 방법**"은 아직 없습니다.
- 공식 API가 열리기 전까지 우리 랭킹은 **사용자가 직접 제출한 캐릭터만** 대상으로 합니다. 화면에 "제출된 캐릭터를 기준으로 한 랭킹입니다."를 표시합니다(명세서 §18).

## 1. 지금 바로 확보할 수 있는 데이터

| 데이터 | 방법 | 비고 |
|---|---|---|
| 클라이언트 API 목록·시그니처 | S1 `api.json`, S2 `forever_api.json`, S3 생성 문서 | 이번 문서에 반영 |
| interface / 빌드 계열 | S1 메타(1.60.1 / 70170 / 16001), S3 `version.txt`(1.60.1.70235) | `sourceBuild` 파서 분기 기준 |
| realm 없음, 이름+성, region 안 전체 이름 고유 | 공식 공지(S6) | 캐릭터 식별 설계 근거 |
| Forever 장비 슬롯 이름 20개 | S3 Camelot `PaperDollFrame.xml` | beta Gear Profile 초안의 근거. 승인(`APPROVED`)은 실제 데이터 확인 후 |
| 게임 모드 관련 API, `ForeverExperiencePreset` 값 | S1 | `Enum.GameMode` 값은 실행 필요 |
| 아이템 카탈로그 일부 | S4 AHledger가 27,459개 아이템 공개를 표방 | **이용 조건·다운로드 형식 미확인** → §7 |

## 2. 실제 게임이 필요한 데이터

사용자 PC에서 Collector를 실행해야만 얻을 수 있는 값입니다.

| 데이터 | 이유 |
|---|---|
| 내 캐릭터의 현재 레벨·장비·아이템 레벨 | 클라이언트 전용 |
| GUID 형식, 영속성 | 실행해야 형식을 볼 수 있음 |
| 성 구분자, 성을 숨긴 경우 반환값 | 클라이언트 C 상수 |
| `Enum.GameMode`, `Enum.ItemQuality`, `Enum.InventoryType` 값 | 공개 덤프에 없음 |
| 장비 슬롯 번호 | `GetInventorySlotInfo`가 실행 중에 결정 |
| 아이템 링크의 마법부여·보석 필드 | 실행 필요 |
| region 번호 ↔ 지역 | 실행 필요 |
| SavedVariables 재로드 버그가 남아 있는지 | 실행 필요 |
| 레벨 상승 시각 (`PLAYER_LEVEL_UP`) | 이벤트가 발생할 때 그 PC에서만 기록 가능 |

이 값들은 **한 명의 테스트 플레이어가 한 번 실행**하면 대부분 확정할 수 있습니다. 확정 결과는 서버의 매핑 설정(`config/game-scopes`, `config/codes`, Gear Profile)에 반영합니다.

## 3. 공식 Blizzard API가 필요한 데이터

| 데이터 | 이유 |
|---|---|
| **모든 캐릭터**의 레벨·장비·길드 (전체 랭킹) | 제3자가 모든 캐릭터를 조회하려면 서버 대 서버 API가 필요 |
| 캐릭터 존재 여부·이름 변경·삭제 확인 | 사용자 제출만으로는 알 수 없음 |
| 검증된(`VERIFIED`) 기록 | 클라이언트 데이터는 위조 가능 |
| 공식 아이템·던전·보스 Game Data | 카탈로그의 권위 있는 출처 |

현재 상태:

- Blizzard WoW Forever 웹 API는 공개되지 않았습니다.
- S5(Armory WoW Forever)도 "Blizzard가 API 접근을 허용하면" 출시하겠다고 안내합니다.
- S7(Battle.net 개발자 문서)에서도 Forever namespace를 찾지 못했습니다.

연결 절차는 `PHASE2-DATA-COLLECTION.md` §7을 따릅니다. Forever 데이터에 Retail·Classic namespace를 대신 쓰지 않습니다.

## 4. 사용자 제출로 확보 가능한 데이터

`ForeverRankCollector`의 Character Export v1을 사용자가 직접 업로드하는 방식입니다(Phase 2B).

| 확보 가능 | 내용 |
|---|---|
| 캐릭터 정보 | 이름·성·GUID·레벨·직업·종족·진영·길드 이름 |
| 장비 | 장착 장비의 아이템 ID·링크·아이템 레벨·품질·아이콘·보석 |
| 게임 모드 / 빌드 / 지역 번호 | 원본 값 그대로 |
| 레벨 상승 시각 | Collector를 켠 상태에서 오른 레벨만 (`SOURCE_REPORTED` 후보) |
| 아이템 카탈로그 일부 | 제출된 장비의 아이템 ID와 링크 |

한계:

- **제출한 사람의 캐릭터만** 들어옵니다. 랭킹은 "제출된 캐릭터 기준"입니다.
- 데이터를 위조할 수 있어서 항상 `COMMUNITY_SUBMITTED`로 저장합니다.
- 레벨 상승 시각은 애드온을 켜 둔 동안만 기록됩니다. 그 밖의 레벨은 `FIRST_OBSERVED` 또는 `INFERRED`입니다.
- SavedVariables 재로드 버그가 남아 있으면, 세션마다 따로 제출해야 기록이 이어집니다.

## 5. 향후 대체 가능한 데이터 공급원

| 공급원 | 쓸 수 있는 데이터 | 조건 / 위험 |
|---|---|---|
| Blizzard Forever Game Data / Profile API | 전체 캐릭터, 아이템, 던전 | 공개 + 약관 확인 후 최우선 |
| Companion 앱 (사용자 PC) | Collector 파일 자동 감지 후 **사용자 동의 시** 업로드 | 사용자 동의, 개인정보 최소화 |
| AHledger (S4) | 아이템 카탈로그 | 이용 조건·attribution 확인 전에는 사용하지 않음. 필요하면 운영자에게 허락 요청 |
| 커뮤니티 데이터셋 (예: AllTheThings Forever 데이터, S2 README에서 소개) | 아이템·퀘스트·던전 정적 데이터 | 데이터별 라이선스 확인. GPL 등 조건이 있으면 그 조건을 따름 |
| 클라이언트 데이터 파일 추출 (datamining) | 아이템·던전 정적 데이터 | Blizzard 약관 검토 전에는 사용하지 않음 |
| 다른 사이트 스크래핑 | — | **사용하지 않음** (명세서 §28) |
| Raider.IO 등 제3자 API | — | 핵심 공급원으로 쓰지 않음 (명세서 §28) |

## 6. 데이터 검증 방법

서버가 Character Export v1을 받을 때 적용합니다(Phase 2B 구현).

| 단계 | 규칙 |
|---|---|
| 형식 | `docs/schemas/character-export-v1.schema.json`으로 검증. `schema` / `schemaVersion`이 다르면 원본만 저장하고 처리하지 않음 |
| 크기·빈도 | payload 크기 제한, 계정·IP별 Rate Limit |
| 영역 | `dataEnvironment`는 서버 설정. export에 들어 있는 값은 쓰지 않음. mock 배포는 제출 API를 열지 않음 |
| 빌드 | `client.buildNumber`로 파서 선택. 모르는 빌드는 보류 |
| 매핑 | `regionId`, `activeGameMode`, `classFile` 등은 서버 설정에 매핑이 있을 때만 처리. 매핑이 없으면 보류 (값을 추정하지 않음) |
| 시각 | `observedAt`이 미래이거나 너무 오래되면 거부. 레벨 상승 시각은 직전 관측과 현재 관측 사이여야 함 |
| 범위 | 레벨 1~최대 레벨(설정), 아이템 레벨 범위, 슬롯 중복 금지 |
| 일관성 | 같은 GUID의 레벨이 낮아지면 "식별 충돌". 같은 GUID의 이름이 바뀌면 이름 변경으로 처리 |
| 재계산 | 평균 장비 레벨·커버리지·순위는 서버가 Gear Profile로 다시 계산. `clientAverageItemLevel`은 비교용 |
| 교차 확인 | `clientAverageItemLevel`과 서버 계산값의 차이가 크면 표시(플래그) |
| 검증 상태 | 항상 `COMMUNITY_SUBMITTED`. `VERIFIED`는 공식 API로 확인된 데이터에만 |
| 원본 보관 | `ingestion_records`에 원본 저장. 파서를 고친 뒤 다시 처리 |

## 7. Item Catalog importer 설계

### 7-1. 후보와 상태

| 후보 | 필드 | 상태 |
|---|---|---|
| **A. Collector 제출 장비** | itemId, itemLink, itemLevel(인스턴스), quality, icon(fileID), inventoryType | **바로 가능** (제출된 아이템만) |
| **B. AHledger** (S4) | 검색 결과 기준 27,459개, Forever 신규 4,909개. 설명·귀속·스택·판매가·레시피 | **보류**. 이 환경에서 `/data` 접속이 차단되어 형식·이용 조건·attribution 조건을 확인하지 못함 |
| **C. Blizzard Game Data API** | 공식 item / item class / media | 공개 대기 |
| **D. 커뮤니티 데이터셋** | 데이터셋마다 다름 | 라이선스 확인 필요 |

### 7-2. 구조 (Phase 2C에서 importer·검증 구현. 현재 구조는 [`STATIC-GAME-DATA.md`](./STATIC-GAME-DATA.md))

```text
ItemCatalogSource (공급원별 어댑터)
  id, displayName, license, attributionText, termsUrl, termsCheckedAt
  fetch() → 원본 레코드 목록
        │
        ▼
catalog_import_runs (제안) — 공급원, 실행 시각, 원본 해시, 건수, 결과
        │  원본 보관
        ▼
정규화 CatalogItem
  externalItemId, name, nameLocale, baseItemLevel, inventoryType,
  quality, iconFileId, classId, subclassId, sourceBuild
        │  검증 (필수값, 범위, 중복)
        ▼
items 테이블 upsert (dataEnvironment는 서버 설정)
```

`items` 테이블과의 대응:

| `items` 컬럼 | 카탈로그 필드 | 비고 |
|---|---|---|
| `external_item_id` | `externalItemId` | 고유 키 `(data_environment, external_item_id)` |
| `name`, `name_locale` | `name`, `nameLocale` | 공급원이 주는 언어. 한국어 이름이 없으면 영어 이름 + locale 표시 |
| `slot_code` | `inventoryType` → 슬롯 코드 매핑 | `Enum.InventoryType` 값 확인 후 매핑 |
| `quality_code` | `quality` → 품질 코드 매핑 | `Enum.ItemQuality` 값 확인 후 매핑 |
| `base_item_level` | `baseItemLevel` | 장착 인스턴스 레벨은 `character_items.item_level`에 따로 저장 |
| `icon_url` | `iconFileId` → URL | fileID를 이미지 URL로 바꾸는 방법이 정해질 때까지 비워 둠 |
| `data_source` | — | **설계 결정 필요.** 현재 enum은 `mock / blizzard / addon / user_submission`. 제3자 카탈로그는 이 중 어느 것에도 맞지 않음 |

명세서 변경이 필요한 제안(승인 후 진행, 파괴적 변경 없음):

1. `items`에 nullable 컬럼 추가: `inventory_type`, `class_id`, `subclass_id`, `icon_file_id`, `catalog_source_id`
2. `catalog_sources` 테이블: 공급원별 라이선스·attribution·이용 조건 확인일 기록. 사이트의 아이템 화면과 푸터에 attribution 표시
3. 카탈로그 공급원을 위한 `data_source` 값 추가 여부 결정

### 7-3. 이용 조건·attribution 기록 원칙

- 공급원마다 다음을 `catalog_sources`에 기록합니다.
  - 라이선스, 이용 조건 URL, 확인 날짜, 요구하는 attribution 문구
  - 상업적 이용 가능 여부, 재배포 가능 여부
- 조건을 확인하지 못한 공급원은 **가져오지 않습니다**. 현재 AHledger가 이 경우입니다.
- 조건이 바뀌었는지 정기적으로 다시 확인합니다.

## 8. 핵심 질문에 대한 답

| # | 질문 | 답 |
|---|---|---|
| 1 | Forever 캐릭터 레벨을 어떻게 확보하는가? | **지금**: Collector(`UnitLevel`)로 만든 export를 사용자가 제출. 레벨 상승 시각은 `PLAYER_LEVEL_UP`. **나중**: 공식 Profile API |
| 2 | 장착 아이템을 어떻게 확보하는가? | Collector가 슬롯 이름 20개를 `C_PaperDollInfo.GetInventorySlotInfo`로 번호로 바꾸고, `GetInventoryItemLink` / `GetInventoryItemID`로 읽음 → 사용자 제출 |
| 3 | 아이템 레벨을 어떻게 확보하는가? | 장착 인스턴스: `ItemLocation:CreateFromEquipmentSlot(slot)` → `C_Item.GetCurrentItemLevel`. 없으면 `C_Item.GetDetailedItemLevelInfo(link)`. 아이템 기본 레벨: 카탈로그(`C_Item.GetItemInfo` 4번째 값, 공식 API, 이용 조건을 확인한 공개 카탈로그) |
| 4 | 캐릭터 식별자를 어떻게 확보하는가? | 1순위 `UnitGUID("player")` → `character_external_refs`. 2순위 자연 키 `(dataEnvironment, region, gameMode, 이름+성 전체 이름)`. realm은 없음(공식 공지) |
| 5 | 전체 캐릭터 랭킹에는 어떤 공급원이 필요한가? | **Blizzard Forever 웹 API(Profile + Game Data)**. 그 전까지는 제출된 캐릭터만 대상 |
| 6 | 사용자 제출로 어디까지 가능한가? | 제출자 본인 캐릭터의 레벨·장비·아이템 레벨·게임 모드·레벨 상승 시각까지. 항상 `COMMUNITY_SUBMITTED`. 전체 랭킹·공식 First 기록은 불가 |
| 7 | Blizzard API가 열리면 어떻게 연결하는가? | `PHASE2-DATA-COLLECTION.md` §7 절차대로 진행. 문서·약관 확인 → Forever namespace 확인 → `BlizzardProvider` 구현 → 검증 상태 결정 → 수집 작업. 사용자 제출 데이터와는 `character_external_refs`로 같은 캐릭터를 연결하고, 공식 데이터를 우선함 |

## 9. 다음 단계 (Phase 2B 제안)

1. **실행 확인 1회**: 테스트 플레이어 한 명이 Collector(또는 Probe)를 실행해 §2 항목을 확정
2. **서버 매핑 설정**: region, game mode, 직업·종족, 슬롯, 품질, 인벤토리 타입 → `config/`
3. **beta Gear Profile 초안**: S3 슬롯 20개 기준. 원거리 슬롯을 포함할지, 셔츠·휘장·탄약을 제외할지 결정 → 검토 후 `APPROVED`
4. **애드온 파서 + 업로드 API**: `providers/addon/parsers/character-export-v1`, 동의 화면, Rate Limit
5. **아이템 카탈로그**: 공급원별 이용 조건 확인. 확인 전에는 Collector 제출 아이템만 사용
6. **명세서 갱신 제안**: §7 realm 없음 / 이름+성 고유 범위, §30 확인 결과 반영 (승인 후)

## 출처

| ID | URL | 확인 방식 |
|---|---|---|
| S1 | https://github.com/Atraeau/WoW-Addons (커밋 `d8c9be3`), https://atraeau.github.io/WoW-Addons/ | 저장소 직접 확인 |
| S2 | https://github.com/Thunderz96/forever-addon-kit (커밋 `8dc2976`, MIT) | 저장소 직접 확인 |
| S3 | https://github.com/Gethe/wow-ui-source/tree/forever (커밋 `a84e2b1`, 1.60.1.70235) | 저장소 직접 확인 |
| S4 | https://ahledger.com/data, https://ahledger.com/wow-forever, https://ahledger.com/about | 접속 차단. 검색 결과 요약만 확인 |
| S5 | https://armorywowforever.com/ | 접속 차단. 검색 결과 요약만 확인 |
| S6 | https://news.blizzard.com/en-us/article/24304161/create-a-name-of-your-own-in-wow-forever, https://www.warcrafttavern.com/forever/news/naming-guidelines-early-name-reservation-in-wow-forever/, https://blizzardwatch.com/2026/09/13/surnames-wow-forever/ | Blizzard 원문은 접속 차단. 검색 결과와 보도로 확인 |
| S7 | https://community.developer.battle.net/documentation/guides/game-data-apis, https://community.developer.battle.net/documentation/world-of-warcraft/profile-apis | 검색 결과로 확인 |
| 기타 | SavedVariables 재로드 버그 관련: https://eu.forums.blizzard.com/en/wow/t/wow-forever-game-not-save-any-addons-settings/629470 (S2 README에서 인용) | 간접 확인 |
