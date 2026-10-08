# Character Export v1 — 로컬 내보내기 형식

> 상태: **초안 v1 (Phase 2A-OFFLINE)**
> - 근거: `docs/FOREVER-API-CAPABILITY.md`의 공개 자료 분석
> - 만드는 쪽: `addon/ForeverRankCollector`
> - JSON Schema: [`docs/schemas/character-export-v1.schema.json`](./schemas/character-export-v1.schema.json)
> - 아직 실제 게임에서 만든 export는 없습니다. 아래 값은 모두 **형식 예시**입니다.

## 1. 목적

`ForeverRankCollector` 애드온이 **로그인한 자신의 캐릭터 상태**를 로컬 파일(SavedVariables)에 남기는 형식입니다.

이 형식은 Phase 2B 이후의 사용자 제출(업로드) API와 서버의 애드온 파서(`providers/addon/parsers`)가 읽습니다.

## 2. 기본 원칙

1. **얻지 못한 값은 넣지 않습니다.**
   - API가 없거나, 오류가 나거나, 값이 비었거나, secret 값이면 그 키를 **생략**합니다.
   - 시도했지만 못 얻은 항목은 `unavailable` 목록에 경로로 적습니다.
   - 기본값·추정값·Mock 값으로 채우지 않습니다.
2. **원본에 가깝게 내보냅니다.**
   - 클라이언트 API가 준 값을 그대로 씁니다. 예: 직업은 `classFile`, game mode는 enum 숫자.
   - 우리 코드(`class_code`, `gameMode` 문자열 등)로 바꾸는 매핑은 **서버**가 설정 파일로 합니다.
3. **해석이 필요한 값은 원문으로 보냅니다.**
   - 마법부여는 문서화된 API가 없어서 `itemLink` 원문만 보내고, 서버가 해석합니다.
4. **순위·평균 장비 레벨은 서버가 계산합니다.**
   - `clientAverageItemLevel`은 게임이 보여 주는 참고값일 뿐 랭킹에 쓰지 않습니다.
5. **세션 단위입니다.**
   - Forever 베타에는 SavedVariables를 다시 읽지 못하는 버그가 보고되어 있습니다.
   - 그래서 export는 **한 세션의 상태와 그 세션 동안의 레벨 상승 기록**만 담습니다. 기록 누적은 서버가 합니다.
6. **자신의 캐릭터만 담습니다.**
   - 다른 플레이어 정보, 계정 정보(Battle.net 계정, BattleTag, 이메일), 채팅, 위치는 담지 않습니다.

## 3. 저장 위치

```text
World of Warcraft\_classic_beta_\WTF\Account\<계정 폴더>\SavedVariables\ForeverRankCollector.lua
```

```lua
ForeverRankCollectorDB = {
  formatVersion = 1,
  latestExport = { ... },        -- 아래 구조의 Lua 테이블
  latestExportJson = "{...}",    -- 같은 내용의 JSON 문자열 (업로드용)
}
```

- 파일은 로그아웃하거나 `/reload` 할 때 저장됩니다.
- 업로드 화면(Phase 2B)은 `latestExportJson`을 읽습니다.
- `<계정 폴더>` 경로는 서버로 보내지 않습니다.

## 4. 구조

```jsonc
{
  "schema": "forever-rank/character-export",
  "schemaVersion": 1,
  "collector": { "name": "ForeverRankCollector", "version": "1.0.0" },

  "observedAt": 1791273972,               // 관측 시각 (Unix 초, UTC)
  "observedAtSource": "GetServerTime",    // "GetServerTime" | "time"
  "trigger": "logout",                    // 아래 표 참고

  "client": {
    "buildVersion": "1.60.1",             // GetBuildInfo() 1
    "buildNumber": "70170",               // GetBuildInfo() 2
    "buildDate": "Oct  1 2026",           // GetBuildInfo() 3
    "interfaceVersion": 16001,            // GetBuildInfo() 4
    "localizedVersion": "…",              // GetBuildInfo() 5
    "locale": "koKR",                     // GetLocale()
    "regionId": 3,                        // GetCurrentRegion()
    "regionName": "KR"                    // GetCurrentRegionName()
  },

  "gameMode": {
    "activeGameMode": 0,                  // C_GameRules.GetActiveGameMode() — Enum.GameMode 숫자
    "gameModeRecordId": 0,                // C_GameRules.GetCurrentGameModeRecordID()
    "isHardcore": false,                  // C_GameRules.IsHardcoreActive()
    "isSelfFoundAllowed": false,          // C_GameRules.IsSelfFoundAllowed()
    "isStandard": true,                   // C_GameRules.IsStandard()
    "foreverExperiencePreset": 0          // C_GameRules.GetForeverExperiencePreset() — Classic 0 / Modern 1
  },

  "character": {
    "guid": "Player-0000-00000000",       // UnitGUID("player")
    "name": "홍길동",                     // UnitNameUnmodified("player") 1 (없으면 UnitName)
    "surname": "아제로스",                // 같은 함수의 2번째 값 (Forever UI는 surname으로 사용)
    "level": 30,                          // UnitLevel("player")
    "classFile": "WARRIOR",               // UnitClass 2
    "classId": 1,                         // UnitClass 3
    "className": "전사",                  // UnitClass 1 (표시용)
    "raceFile": "Orc",                    // UnitRace 2
    "raceId": 2,                          // UnitRace 3
    "raceName": "오크",                   // UnitRace 1 (표시용)
    "faction": "Horde",                   // UnitFactionGroup 1
    "factionName": "호드",                // UnitFactionGroup 2 (표시용)
    "isInGuild": true,                    // IsInGuild()
    "guildName": "아제로스 수호대"        // GetGuildInfo("player") 1
  },

  "gear": [
    {
      "slotName": "HeadSlot",             // 검사한 슬롯 이름
      "slotId": 1,                        // C_PaperDollInfo.GetInventorySlotInfo(slotName) 1
      "itemId": 12345,                    // GetInventoryItemID("player", slotId)
      "itemLink": "|cff…|Hitem:12345:…|h[…]|h|r", // GetInventoryItemLink("player", slotId)
      "itemLevel": 33,                    // 아래 itemLevelSource의 값
      "itemLevelSource": "C_Item.GetCurrentItemLevel",
      "quality": 3,                       // C_Item.GetItemQuality(itemLocation) — Enum.ItemQuality 숫자
      "icon": 133071,                     // GetInventoryItemTexture — fileID
      "inventoryType": 1,                 // C_Item.GetItemInventoryType(itemLocation) — Enum.InventoryType 숫자
      "socketCount": 1,                   // C_Item.GetItemNumSockets(itemLink)
      "gemIds": [23456],                  // C_Item.GetItemGemID(itemLink, i)
      "dataCached": true                  // C_Item.IsItemDataCached(itemLocation)
    }
  ],

  "clientAverageItemLevel": {             // GetAverageItemLevel() — 참고용
    "overall": 31.5,
    "equipped": 31.2,
    "pvp": 31.2
  },

  "levelEvents": [                        // 이 세션에서 받은 PLAYER_LEVEL_UP
    { "level": 30, "observedAt": 1791270000, "event": "PLAYER_LEVEL_UP" }
  ],

  "unavailable": [                        // 시도했지만 얻지 못한 경로
    "client.regionName",
    "gear[HeadSlot].itemLevel"
  ]
}
```

위의 이름, GUID, ID, 숫자는 **모두 형식 예시**입니다. 실제 게임에서 나온 값이 아닙니다. enum 숫자(`regionId`, `activeGameMode`, `quality`, `inventoryType`)의 실제 의미는 아직 확인되지 않았습니다.

### `trigger` 값

| 값 | 의미 |
|---|---|
| `login` | 접속 / `/reload` 직후 (`PLAYER_ENTERING_WORLD`) |
| `manual` | 사용자가 `/frc export` 입력 |
| `level_up` | `PLAYER_LEVEL_UP` 이후 |
| `equipment_changed` | `PLAYER_EQUIPMENT_CHANGED` 이후 |
| `guild_changed` | `PLAYER_GUILD_UPDATE` 이후 |
| `item_data_loaded` | 캐시되지 않았던 아이템 정보가 로드된 뒤(`ITEM_DATA_LOAD_RESULT`) |
| `logout` | 로그아웃 직전(`PLAYER_LOGOUT`). 파일에 남는 마지막 상태 |

## 5. 필드별 출처와 확인 수준

| 필드 | API | 확인 수준 (`FOREVER-API-CAPABILITY.md`) |
|---|---|---|
| `client.*` | `GetBuildInfo`, `GetLocale`, `GetCurrentRegion`, `GetCurrentRegionName` | `CLIENT_API_DOCUMENTED` |
| `gameMode.*` | `C_GameRules.*` | `CLIENT_API_DOCUMENTED` (enum 의미는 `RUNTIME_REQUIRED`) |
| `character.guid` | `UnitGUID` | `CLIENT_API_DOCUMENTED` (형식은 `RUNTIME_REQUIRED`) |
| `character.name`, `surname` | `UnitNameUnmodified` → 없으면 `UnitName` | 문서화 + Forever UI 소스 참조. 성 의미는 `RUNTIME_REQUIRED` |
| `character.level`, `class*`, `race*`, `faction*` | `UnitLevel`, `UnitClass`, `UnitRace`, `UnitFactionGroup` | `CLIENT_API_DOCUMENTED` |
| `character.isInGuild` | `IsInGuild` | `CLIENT_API_DOCUMENTED` |
| `character.guildName` | `GetGuildInfo` | `CLIENT_SOURCE_REFERENCED` |
| `gear[].slotId` | `C_PaperDollInfo.GetInventorySlotInfo` | `CLIENT_API_DOCUMENTED` |
| `gear[].itemId`, `itemLink`, `icon` | `GetInventoryItemID`, `GetInventoryItemLink`, `GetInventoryItemTexture` | `CLIENT_SOURCE_REFERENCED` |
| `gear[].itemLevel` | `C_Item.GetCurrentItemLevel(ItemLocation)` → `C_Item.GetDetailedItemLevelInfo(itemLink)` | `CLIENT_API_DOCUMENTED` |
| `gear[].quality`, `inventoryType`, `dataCached` | `C_Item.GetItemQuality`, `GetItemInventoryType`, `IsItemDataCached` | `CLIENT_API_DOCUMENTED` |
| `gear[].socketCount`, `gemIds` | `C_Item.GetItemNumSockets`, `C_Item.GetItemGemID` | `CLIENT_API_DOCUMENTED` |
| `clientAverageItemLevel` | `GetAverageItemLevel` | `CLIENT_SOURCE_REFERENCED` |
| `levelEvents` | 이벤트 `PLAYER_LEVEL_UP(level, …)` + `GetServerTime` | `CLIENT_API_DOCUMENTED` |

### 요청 초안의 필드와의 대응

| 요청 초안 | v1 필드 | 설명 |
|---|---|---|
| `character.class` | `classFile`, `classId`, `className` | 코드·ID·표시 이름을 모두 원본 그대로 |
| `character.race` | `raceFile`, `raceId`, `raceName` | 같음 |
| `character.faction` | `faction`, `factionName` | 같음 |
| `character.guild` | `isInGuild`, `guildName` | 길드 외부 ID API가 없어 이름만 |
| `gear[].slot` | `slotName`, `slotId` | 슬롯 번호는 실행 시 결정 |
| `gear[].enchant` | (없음) → `itemLink`에서 서버가 해석 | 마법부여를 직접 주는 문서화 API를 찾지 못함 |
| `gear[].gems` | `socketCount`, `gemIds` | `C_Item.GetItemGemID` |

## 6. 서버 쪽 변환 (Phase 2B에서 구현)

> Phase 3C: `gameMode.activeGameMode`는 공식 게임 규칙(Ruleset) 코드로 매핑합니다(값은 미확인, 매핑 비어 있음). 성(`character.surname`)이 없으면 첫 이름만으로 식별하지 않고 `FULL_NAME_REQUIRED`로 처리합니다(`docs/RULESETS.md`).

`providers/addon/parsers/character-export-v1`이 이 형식을 기존 수집 파이프라인의 정규화 관측 데이터(`lib/ingestion/schema.ts`)로 바꿉니다.

| 정규화 필드 | 변환 |
|---|---|
| `dataSource` | `addon` (서버가 부여) |
| `dataEnvironment` | 서버 배포 설정 (`beta` / `live`). export 안의 값은 쓰지 않음 |
| `verificationStatus` | `COMMUNITY_SUBMITTED` |
| `observedAt` | `observedAt` (미래 시각이면 거부) |
| `sourceBuild` | `client.buildVersion` + `.` + `client.buildNumber` |
| `identity.externalId` | `character.guid` (없으면 외부 ID 없이 자연 키로 식별) |
| `identity.region` | `client.regionId` → 설정 `gameScopes` 매핑 (값 확인 전까지 매핑 없음 → 거부) |
| `identity.gameMode` | `gameMode.activeGameMode` → 설정 매핑 (같음) |
| `identity.characterName` | `name`과 `surname`을 합친 전체 이름. 구분자는 실행 확인 후 확정. 그 전까지 이 형식 처리를 보류 |
| `level` | `character.level` |
| `levelReachedAt` | `levelEvents`에서 `level == character.level`인 이벤트의 `observedAt` (있을 때만) |
| `classCode` / `raceCode` / `factionCode` | `classFile` / `raceFile` / `faction` → 설정 `codes` 매핑 |
| `guild` | `guildName`이 있으면 `{ name }`, `isInGuild == false`면 `null`, 둘 다 없으면 생략 |
| `equipment[]` | `slotName` → Gear Profile 슬롯 코드, `itemId` → `externalItemId`, `itemLevel`, `quality` → 품질 코드, `inventoryType` → `itemSlotCode` |

검증 규칙은 `docs/PHASE2-DATA-SOURCE-PLAN.md` §6에 정리했습니다.

## 7. 버전 관리

- `schemaVersion`(Export 형식 버전)과 `collector.version`(Collector 버전)은 서로 다른 값입니다(Phase 4A, `docs/CONTRIBUTOR-GUIDE.md` §5).
  - 현재: Export 형식 `1`, Collector `1.0.0`. 설정은 `config/collector.ts`에 있습니다.
  - 서버는 `schemaVersion`만으로 받을지 정합니다. 같은 형식이면 Collector 버전이 달라도 받습니다.
  - 지원하지 않는 `schemaVersion`은 형식 검증 전에 거부합니다. 한국어 안내와 함께 `EXPORT_SCHEMA_OUTDATED` / `EXPORT_SCHEMA_TOO_NEW` 오류를 냅니다.
- 필드를 **추가**하는 변경은 `schemaVersion`을 유지할 수 있습니다. 서버 파서는 모르는 필드를 무시합니다.
- 필드의 **의미나 형식이 바뀌면** `schemaVersion`을 올리고, 서버에 새 파서를 추가합니다.
- 서버는 `schemaVersion`과 `client.buildNumber`로 파서를 고릅니다. 모르는 조합은 원본만 저장하고 처리하지 않습니다.

## 출처

필드 근거의 상세는 [`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md) §1을 따릅니다.

| 자료 | URL |
|---|---|
| Forever API 문서 덤프 (build 70170) | https://github.com/Atraeau/WoW-Addons (`docs/api.json`) |
| Forever API 캡처 (build 69893), SavedVariables 버그 보고 | https://github.com/Thunderz96/forever-addon-kit |
| Forever UI 소스 (1.60.1.70235): `Blizzard_ObjectAPI/Mainline/ItemLocation.lua`, `Item.lua`, `Blizzard_UIPanels_Game/Camelot/PaperDollFrame.lua·xml`, `Blizzard_FrameXMLUtil/Camelot/NameUtil.lua` | https://github.com/Gethe/wow-ui-source/tree/forever |
| 이름+성, realm 없음 (공식 공지) | https://news.blizzard.com/en-us/article/24304161/create-a-name-of-your-own-in-wow-forever |
