# Phase 2 — 데이터 수집 구조

> 기준 문서: `WOW_FOREVER_RANKING_SPEC.md` §2, §15, §16, §27, §30 / `CLAUDE.md` §6~8
> 상태: **Phase 2A (API Capability Probe) — 게임 내 실행 검증 필요**
>
> 📌 Phase 2A-OFFLINE(2026-10-06)으로 방향을 바꿨습니다. 공개 자료 분석 결과와 최신 계획은 다음 문서를 우선합니다.
> - [`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md)
> - [`CHARACTER-EXPORT-V1.md`](./CHARACTER-EXPORT-V1.md)
> - [`PHASE2-DATA-SOURCE-PLAN.md`](./PHASE2-DATA-SOURCE-PLAN.md)
>
> 이 문서의 원칙(개인정보, 검증, Companion, Blizzard API 연결 절차)은 그대로 유효합니다.

## 1. 현재 확인된 데이터 수집 구조

| 구분 | 상태 |
|---|---|
| Blizzard 공식 웹 API (WoW: Forever용) | **존재 미확인**. `BlizzardProvider`는 엔드포인트 없이 "미구성" 오류만 반환 |
| 게임 클라이언트 애드온 API | **검사 도구만 준비됨** (`addon/ForeverRankProbe`). 실제 결과 없음 |
| 사용자 제출 / Companion | 설계만 있음 (P1) |
| 웹사이트 데이터 | Mock 데이터만 사용 (Phase 1) |

웹사이트 쪽 수집 파이프라인(Phase 1)은 이미 공급원에 의존하지 않는 형태입니다.

```text
원본 저장(ingestion_records) → 입력 검증 → sourceBuild별 파서 → 정규화 관측 데이터
→ dataEnvironment 부여(서버 설정) → 캐릭터 식별 → 현재 상태 / 장비 / milestone / 스냅샷
```

Phase 2에서 할 일은 이 파이프라인 앞단에 **실제 데이터를 넣을 공급원**을 찾는 것입니다.

## 2. Probe 목적

`ForeverRankProbe` 애드온으로 다음 질문에 답합니다.

- 랭킹에 필요한 캐릭터 정보(이름, 레벨, 직업, 종족, 진영, 길드, 서버, 지역, 게임 모드)를 클라이언트에서 읽을 수 있는가?
- 장비 정보(슬롯 목록, 아이템 링크·ID·이름·레벨·품질·아이콘·보석·마법부여)를 읽을 수 있는가?
- 캐릭터를 안정적으로 식별할 값(GUID, 서버)이 있는가?
- 레벨 상승 시각을 직접 알 수 있는가? (`level_milestones`의 `SOURCE_REPORTED` 가능 여부)
- 클라이언트 빌드 번호와 interface 버전을 얻을 수 있는가? (`sourceBuild`, 빌드별 파서 기준)

검사 범위:

- 현재 로그인한 **자신의 캐릭터**만 검사합니다.
- 다른 플레이어 자동 수집, 자동 Inspect, 게임 자동화, 네트워크 통신은 하지 않습니다.

## 3. 확인 대상 API

아래 이름은 다른 WoW 클라이언트에서 쓰이는 **후보**입니다. WoW: Forever에 있는지는 Probe 결과로 판단합니다.

모든 호출은 `pcall`로 감쌉니다. 함수가 있는지(`available`), 호출되는지(`callable`), 반환값(`value`), 오류(`error`)를 기록합니다.

### 캐릭터 / 클라이언트

| 항목 | 후보 API | 랭킹 사이트 용도 |
|---|---|---|
| 캐릭터 이름 | `UnitName("player")` | `characterName` |
| 캐릭터 GUID | `UnitGUID("player")` | `externalId` 후보 |
| 레벨 | `UnitLevel("player")` | `level` |
| 직업 이름 / 코드 / ID | `UnitClass("player")` | `classCode` 매핑 |
| 종족 이름 / 코드 / ID | `UnitRace("player")` | `raceCode` 매핑 |
| 진영 | `UnitFactionGroup("player")` | `factionCode` |
| 길드 | `IsInGuild()`, `GetGuildInfo("player")` | 길드 연결 |
| 서버(realm) | `GetRealmName()`, `GetNormalizedRealmName()` | Realm 필요성 판단 (명세서 §7.5) |
| 지역(region) | `GetCurrentRegion()`, `GetCurrentRegionName()` | `region` |
| 게임 모드 후보 | `WOW_PROJECT_ID`, `C_GameRules.IsHardcoreActive()`, `C_Seasons.HasActiveSeason()`, `C_Seasons.GetActiveSeason()` | `gameMode` 판별 가능성 |
| 클라이언트 언어 | `GetLocale()` | 이름 언어 |
| 빌드 / interface | `GetBuildInfo()` | `sourceBuild` |
| 서버 시각 | `GetServerTime()` (없으면 `time()`) | 관측 시각 |
| 레벨 상승 | 이벤트 `PLAYER_LEVEL_UP` | `level_milestones.reached_at` 후보 |

### 장비

| 항목 | 후보 API |
|---|---|
| 슬롯 이름 → 번호 | `GetInventorySlotInfo(slotName)` (후보 이름 21개) |
| 슬롯 발견 | 슬롯 번호 0~30에 `GetInventoryItemLink("player", n)` |
| 아이템 링크 | `GetInventoryItemLink` |
| 아이템 ID | `GetInventoryItemID` |
| 아이콘 | `GetInventoryItemTexture` |
| 품질 | `GetInventoryItemQuality`, `GetItemInfo` 3번째 값 |
| 이름 | `GetItemInfo` 1번째 값, `C_Item.GetItemInfo` |
| 아이템 레벨 | `GetItemInfo` 4번째 값, `GetDetailedItemLevelInfo`, `C_Item.GetDetailedItemLevelInfo`, `C_Item.GetCurrentItemLevel(ItemLocation)` |
| 보석 | `GetItemGem(link, 1)`, 아이템 링크 필드 |
| 마법부여 | 아이템 링크 3번째 필드 (추정) |
| 장착 여부 | `IsEquippedItem(itemID)` |
| 게임 제공 평균 | `GetAverageItemLevel()` (참고용. 랭킹은 Gear Profile로 직접 계산) |

### 존재 여부만 확인 (호출하지 않음)

| 항목 | 이유 |
|---|---|
| `PaperDollFrame` | 화면 요소를 조작하지 않음 |
| `CanInspect`, `NotifyInspect` | 다른 플레이어 검사 금지. `NotifyInspect`는 서버 요청을 보냄 |

### API 발견

후보 목록 밖의 API도 놓치지 않으려고, 클라이언트에 **실제로 있는 이름**을 함께 기록합니다(`discovery`).

- `_G`의 모든 `C_` 네임스페이스 이름
- 키워드(Item, Inventory, Equip, Guild, Realm, Region, GameRule, Season, Hardcore, Build, PaperDoll, Inspect)가 들어간 함수 이름
- 내장 API 문서(`APIDocumentation`)가 로드되어 있으면 그 시스템 이름

## 4. 확인되지 않은 API

**현재 모든 항목이 미확인입니다.** Probe는 아직 실제 게임에서 실행되지 않았습니다.

특히 확인이 필요한 항목:

| 항목 | 확인할 내용 | 관련 명세 |
|---|---|---|
| 아이템 레벨 | 클라이언트가 개별 아이템 레벨을 주는지, 어느 API가 주는지 | §30-11 |
| 장비 슬롯 | 실제 슬롯 번호와 이름, 원거리·성물·탄약 슬롯 유무 | §30-10 |
| 양손 무기 | 보조 무기 슬롯이 비는지 | §30-12 |
| 게임 모드 | 일반 / 하드코어 / 시즌 같은 구분을 클라이언트가 알려 주는지 | §30-6 |
| Realm | 서버 이름이 있는지, 캐릭터 이름 고유 범위 | §30-4 |
| 지역 | 지역 번호와 실제 지역의 대응 | §30-5 |
| 외부 ID | GUID 형식, 캐릭터 삭제·재생성·이전 시 유지 여부 | §30-7 |
| 레벨 상승 시각 | `PLAYER_LEVEL_UP`이 오는지, 인자가 새 레벨인지 | §8.2 |
| 직업 / 종족 코드 | 영어 코드(classFile, raceFile)와 한국어 이름 | §30-9 |
| 빌드 번호 | `GetBuildInfo`의 빌드 / interface 형식 | §30-14 |
| 마법부여 / 보석 | 아이템 링크 필드의 의미 | — |
| `/api`, `/apiexport` | 클라이언트 명령 존재 여부 | — |

다른 WoW 클라이언트 기준의 해석에는 결과에 "게임 내 실행 검증 필요"를 표시합니다. 예를 들어 `GetItemInfo`의 4번째 값을 아이템 레벨로 보는 것이 그런 해석입니다.

## 5. SavedVariables 구조

> 2026-10-08 재점검: 과거 빌드(69893 / 69913)의 "SavedVariables를 다시 읽지 못함" 버그는 여러 커뮤니티 보고로 확인됐습니다. 최근 고쳐졌다는 커뮤니티 주장이 하나 있지만 공식 확인이 없어 **확인 필요(게임 실행 필요)**로 둡니다(FOREVER-API-CAPABILITY §2-7). Probe·Collector는 한 세션의 결과를 파일로 남기는 방식이라 버그 여부와 관계없이 동작합니다.

변수 이름: `ForeverRankProbeDB`

```lua
ForeverRankProbeDB = {
  schemaVersion = 1,
  probeVersion = "0.1.0",
  timestamp = 1791273972,           -- 마지막 검사 시각 (GetServerTime 또는 time)
  timestampSource = "GetServerTime",
  clientBuild = { version = "…", build = "…", date = "…" },
  interfaceVersion = 16001,         -- GetBuildInfo 4번째 값 (해석은 확인 필요)
  character = {
    name, nameRealmPart, guid, level,
    className, classFile, classId,
    raceName, raceFile, raceId,
    faction, factionName, isInGuild, guildName, guildRealm,
    realm, normalizedRealm, regionId, regionName, locale,
    hardcoreActive, hasActiveSeason, activeSeason,
  },
  capabilities = {
    unitLevel = {
      label = "레벨", group = "character", api = "UnitLevel",
      available = true, callable = true, value = 12, error = nil,
      status = "AVAILABLE", note = nil,
    },
    -- …
  },
  capabilityOrder = { "unitName", "unitGuid", … },
  equipment = {
    slots = {
      { slotId = 1, names = { "HeadSlot" }, itemLink = "…", itemString = "item:…",
        itemStringFields = { "item", "…" }, itemId = …, icon = …, quality = …,
        getItemInfo = { … }, cItemGetItemInfo = { … }, detailedItemLevel = { … },
        cItemDetailedItemLevel = { … }, currentItemLevel = …, firstGem = { … }, isEquippedItem = … },
    },
    slotNameCandidates = { "HeadSlot", … },
  },
  discovery = {
    keywords = { … },
    cNamespaces = { … }, cNamespaceCount = …,
    matchingNamespaceFunctions = { … }, matchingGlobalFunctions = { … },
    apiDocumentationSystems = { … } | apiDocumentationLoaded = false,
  },
  levelUpEvents = { { level = …, args = { … }, time = …, timeSource = "…" } },
  levelUpEventRegistration = { ok = true, error = nil },
}
```

위의 값(`12`, `16001` 등)은 구조를 보여 주는 예시이며 실제 결과가 아닙니다.

`capabilities[*].status` 값:

| 코드 | 의미 |
|---|---|
| `AVAILABLE` | 사용 가능 |
| `NEEDS_CHECK` | 확인 필요 |
| `UNAVAILABLE` | 사용 불가 |
| `NOT_CALLED` | 호출하지 않음 |
| `NOT_COLLECTED` | 수집하지 않음 |

저장 규칙:

- 함수, userdata, 깊은 테이블은 저장하지 않습니다(깊이 3, 항목 40개, 문자열 300자 제한).
- 계정 정보는 저장하지 않습니다.
- 레벨 상승 기록은 최근 200개만 유지합니다.

## 6. 향후 Companion 구조 (Phase 2B 이후 제안)

애드온은 외부와 통신할 수 없습니다. 그래서 데이터는 **사용자가 직접 올리는 방식**으로만 들어옵니다.

```text
[게임 안]
ForeverRank 애드온 (수집용, Probe 결과로 확인된 API만 사용)
  └─ SavedVariables 파일 (내 PC)
        │  사용자가 직접 선택
        ▼
[사용자 PC 또는 웹사이트]
  A안. 웹사이트 업로드 화면: SavedVariables 파일을 선택해 제출
  B안. Companion 앱: 파일 변경을 감지하고, 사용자가 동의한 경우에만 제출
        │  HTTPS
        ▼
[서버]
  POST 제출 API (P1)
  → ingestion_records 원본 저장
  → sourceBuild별 애드온 파서 (providers/addon/parsers)
  → 정규화 관측 데이터
  → dataSource = addon, verificationStatus = COMMUNITY_SUBMITTED
  → 기존 수집 파이프라인 (캐릭터 식별, milestone, 스냅샷)
```

설계 원칙:

- 수집용 애드온은 Probe 결과에서 **사용 가능**으로 확인된 API만 사용합니다.
- 애드온 데이터 형식에 버전(`schemaVersion`)과 클라이언트 빌드를 넣어 파서를 고를 수 있게 합니다.
- 제출 API에는 Rate Limit, payload 크기 제한, 입력 검증을 둡니다.
- 서버는 제출된 `rank` 값을 쓰지 않습니다.
- `dataEnvironment`(beta / live)는 서버 설정이 정합니다. 제출 데이터에 들어 있는 값은 쓰지 않습니다.

## 7. Blizzard 웹 API가 열렸을 때 연결 방법

> 상세 계획과 체크리스트: [`BLIZZARD-API-INTEGRATION-PLAN.md`](./BLIZZARD-API-INTEGRATION-PLAN.md) (Phase 2C)

공식 API가 **발표되고 이용약관을 확인한 뒤에만** 진행합니다. 지금은 엔드포인트를 만들거나 가정하지 않습니다.

1. **문서 확인**
   - 공식 문서에서 WoW: Forever용 namespace, 지역, 캐릭터·장비 엔드포인트, 인증 방식, 호출 제한을 확인합니다.
   - 명세서 §30-1에 결과를 기록합니다.
2. **약관 확인**
   - 랭킹 서비스 구축이 허용되는지, 캐시·재배포 조건이 어떤지 확인합니다.
3. **`BlizzardProvider` 구현**
   - `providers/blizzard/BlizzardProvider.ts`에서 공식 응답을 정규화 관측 데이터로 바꿉니다.
   - 인증 키는 환경변수로만 받습니다.
4. **검증 상태 결정**
   - 명세서 §11에서 `blizzard` 기본 검증 상태(예: `VERIFIED`)를 확정합니다.
   - `defaultVerificationStatus`에 반영합니다.
5. **수집 작업 연결**
   - P1의 BullMQ 작업으로 주기 수집을 합니다.
   - 캐릭터 발견(어떤 캐릭터를 조회할지)은 공식 API가 제공하는 방식만 사용합니다.
6. **애드온 데이터와 관계 정리**
   - 같은 캐릭터를 `character_external_refs`로 공급원별 외부 ID에 연결합니다.
   - 공식 데이터가 있으면 공식 데이터를 우선합니다.

## 8. 개인정보 / 사용자 동의 원칙

- **자신의 캐릭터만**
  - 수집 애드온은 로그인한 자신의 캐릭터만 기록합니다.
  - 다른 플레이어 Inspect나 주변 플레이어 수집은 하지 않습니다.
- **명시적 동의**
  - 데이터는 사용자가 직접 파일을 선택하거나 제출 버튼을 눌러야만 서버로 갑니다.
  - 무엇이 공개되는지(캐릭터 이름, 레벨, 장비, 길드)를 제출 전에 보여 줍니다.
- **수집하지 않는 것**
  - Battle.net 계정, BattleTag, 이메일, 비밀번호, 결제 정보, 채팅 내용
  - 계정 폴더 경로(`WTF\Account\<계정 폴더>`)도 서버로 보내지 않습니다.
- **최소 수집**: 랭킹·Armory에 필요한 필드만 저장합니다.
- **삭제 요청**: 제출자가 자신의 캐릭터 데이터 삭제를 요청할 수 있는 절차를 P1 제출 기능과 함께 만듭니다.
- **공개 범위 안내**: 사이트에 "제출된 캐릭터를 기준으로 한 랭킹입니다."를 표시합니다(명세서 §18).

## 9. 데이터 검증 원칙

- **클라이언트 데이터는 위조할 수 있습니다.**
  - 애드온·사용자 제출 데이터는 `COMMUNITY_SUBMITTED`로만 저장합니다.
  - `VERIFIED`는 공식 공급원 등 신뢰할 수 있는 출처에서만 부여합니다.
  - 공식 First 칭호는 `VERIFIED` / `LOG_VERIFIED`만 받을 수 있습니다.
- **서버에서 다시 계산**
  - 순위, 평균 장비 레벨, 커버리지는 서버가 Gear Profile로 다시 계산합니다.
  - 제출된 계산값은 사용하지 않습니다.
- **일관성 검사**
  - 같은 GUID(외부 ID)의 레벨이 낮아지면 "식별 충돌"로 처리합니다.
  - 관측 시각이 미래이면 거부합니다.
  - 레벨 상승 시각은 직전 관측과 현재 관측 사이에 있어야 합니다.
  - 아이템 레벨 범위가 비정상이면 거부합니다.
  - 알 수 없는 빌드 형식은 파서가 거부합니다.
- **빌드별 파서**
  - `sourceBuild`로 파서를 고릅니다.
  - 모르는 빌드는 원본만 저장하고 처리하지 않습니다.
  - 원본은 `ingestion_records`에 남겨 파서를 고친 뒤 다시 처리합니다.
- **환경 분리**
  - 베타에서 모은 데이터는 `beta`, 정식 출시 후는 `live`로 저장합니다.
  - Mock 데이터와는 DB부터 분리합니다(Phase 1 안전장치).
- **Probe 결과의 위상**
  - Probe 결과는 API 존재와 형식을 확인하는 자료입니다. 랭킹 데이터로 쓰지 않습니다.
  - Probe 파일을 웹사이트 DB에 넣지 않습니다.

## 다음 단계 (Phase 2B 제안)

1. 사용자가 게임에서 `/frp scan` → `/reload` → SavedVariables 파일을 공유
2. 결과로 명세서 §30 항목 갱신. 사용 가능한 API 목록 확정
3. 실제 장비 구조로 beta용 Gear Profile 초안 작성. `APPROVED`는 검토 후 결정
4. 수집용 애드온 데이터 형식(v1)과 서버 파서 설계
5. 제출 API(업로드)와 동의 화면 설계
