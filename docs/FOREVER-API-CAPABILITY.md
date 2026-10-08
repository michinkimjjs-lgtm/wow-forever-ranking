# WoW: Forever API Capability Matrix

> 단계: Phase 2A-OFFLINE (게임 접속 없이 공개 자료로 분석)
> 조사일: 2026-10-06
> 이 문서의 결론은 **공개 자료 기준**입니다. 실제 클라이언트 실행으로 확인한 항목은 없습니다.

## 0. 확인 수준 정의

| 코드 | 의미 | 근거 |
|---|---|---|
| `CLIENT_API_DOCUMENTED` | Forever 클라이언트의 `APIDocumentation`(`/api` 데이터) 덤프에 함수·인자·반환값이 문서화되어 있음 | [S1] build 70170, [S3] build 70235 생성 문서 |
| `CLIENT_SOURCE_REFERENCED` | 문서에는 없지만, Forever UI 소스(Camelot / Forever가 로드하는 파일)에서 사용됨. 또는 실행 중인 클라이언트의 `_G` 덤프에 존재함 | [S3] UI 소스, [S1]·[S2] `_G` 목록 |
| `COMMUNITY_CONFIRMED` | 공개 커뮤니티가 실제 클라이언트에서 측정해 보고함(2인 이상 또는 재현 절차 포함) | [S2] README 등 |
| `RUNTIME_REQUIRED` | 존재는 확인됐지만 반환값의 실제 형식·의미는 게임 실행으로 확인해야 함 | — |
| `UNKNOWN` | 공개 자료로 확인할 수 없음 | — |

규칙:

- 추측으로 "확인됨"을 쓰지 않습니다.
- 한 항목이 여러 수준에 해당하면 **가장 강한 근거**와 **남은 확인 사항**을 함께 적습니다.
  - 예: API는 문서화됨, 하지만 값의 의미는 실행 필요.

**서버 수집 가능성**은 "우리 서버가 전체 캐릭터 데이터를 직접 가져올 수 있는가"를 뜻합니다.

| 표기 | 의미 |
|---|---|
| 클라이언트 전용 | 게임 안 애드온에서만 읽을 수 있음. 서버로는 사용자 제출로만 들어옴 |
| 공식 API 필요 | Blizzard Forever 웹 API가 열려야 서버가 직접 수집 가능. 현재 미공개 |
| 공개 데이터 | 공개 자료로 지금 확보 가능 |

## 1. 조사한 공개 자료 [출처]

| ID | 자료 | 버전 / 시점 | 라이선스 / 이용 조건 | 이번에 쓴 방식 |
|---|---|---|---|---|
| **S1** | [Atraeau/WoW-Addons](https://github.com/Atraeau/WoW-Addons) — `docs/api.json`, [`docs/api/`](https://github.com/Atraeau/WoW-Addons/tree/main/docs/api), 공개 사이트 <https://atraeau.github.io/WoW-Addons/> | 커밋 `d8c9be3` (2026-10-02). 덤프 메타: product `wow_classic_beta`, version `1.60.1`, **build `70170`**, **interface `16001`**, exportedAt 2026-10-01 | 저장소 루트에 **라이선스 파일 없음**(일부 하위 애드온만 개별 라이선스). 코드를 재사용하지 않고, API 이름과 시그니처라는 사실 정보만 참조 | `api.json`을 읽어 함수 존재·인자·반환값 대조 |
| **S2** | [Thunderz96/forever-addon-kit](https://github.com/Thunderz96/forever-addon-kit) — `data/forever_api.json`, README | 커밋 `8dc2976` (2026-09-25). 덤프: version `1.60.1`, **build `69893`**, interface `16001`, project `1`, locale enUS | **MIT** (Copyright 2026 Thunderz) | 함수·네임스페이스 존재를 S1과 교차 확인. README의 실측 결과를 커뮤니티 근거로 인용 |
| **S3** | [Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source) **`forever` 브랜치** | 커밋 `a84e2b1` (2026-10-05), `version.txt` = **1.60.1.70235** | Blizzard UI 소스의 미러. 저작권은 Blizzard에 있음. 코드 복사 금지, 사용 패턴만 참조 | 생성 API 문서(`Blizzard_APIDocumentationGenerated`)와 Forever(Camelot) UI의 아이템·이름 처리 확인 |
| **S4** | [AHledger](https://ahledger.com/) — `/data`, [`/wow-forever`](https://ahledger.com/wow-forever), [`/about`](https://ahledger.com/about) | 2026-10-06 검색 결과 | **이 작업 환경의 네트워크 정책이 접속을 차단**해서 이용 조건을 직접 확인하지 못함 | 검색 결과 요약만 참고 |
| **S5** | [Armory WoW Forever](https://armorywowforever.com/) | 2026-10-06 검색 결과 | 접속 차단(위와 같음) | 검색 결과 요약만 참고 |
| **S6** | Blizzard 공지 [Create a Name of Your Own in WoW: Forever](https://news.blizzard.com/en-us/article/24304161/create-a-name-of-your-own-in-wow-forever) 및 보도 [Warcraft Tavern](https://www.warcrafttavern.com/forever/news/naming-guidelines-early-name-reservation-in-wow-forever/), [Blizzard Watch](https://blizzardwatch.com/2026/09/13/surnames-wow-forever/), [포럼 토론](https://us.forums.blizzard.com/en/wow/t/forever-naming-system/2351318) | 2026-09 | — | Blizzard 원문은 접속 차단. 검색 결과 요약과 보도로 확인 |
| **S7** | Battle.net 개발자 문서 [Game Data APIs](https://community.developer.battle.net/documentation/guides/game-data-apis), [WoW Profile APIs](https://community.developer.battle.net/documentation/world-of-warcraft/profile-apis) | 2026-10-06 검색 | Blizzard 개발자 약관 | Forever용 namespace가 공개되었는지 검색. 발견하지 못함 |

S4·S5·S6 원문을 직접 확인하려면 환경의 네트워크 설정에서 허용 도메인에 다음을 추가해야 합니다.

- `ahledger.com`
- `armorywowforever.com`
- `news.blizzard.com`

## 2. 핵심 결론 (공개 자료 기준)

1. **WoW: Forever 클라이언트는 Retail(12.x) 계열 API를 씁니다.**
   - interface는 `16001`입니다. S1·S2 덤프와 S3 `version.txt`가 모두 1.60.1 계열입니다.
   - S2는 실측 결과로 `WOW_PROJECT_ID == WOW_PROJECT_MAINLINE`을 보고합니다(`COMMUNITY_CONFIRMED`).
2. **예전 Classic 전역 함수가 없습니다.** `GetItemInfo`, `GetDetailedItemLevelInfo`, `GetItemGem`, `IsEquippedItem`은 두 덤프의 `_G` 목록에 모두 없습니다.
   - 같은 기능은 `C_Item.*`에 문서화되어 있습니다.
   - Phase 2A의 `ForeverRankProbe`가 검사하던 전역 후보 일부는 "사용 불가"로 나올 것으로 예상됩니다.
3. **Realm이 없습니다.** 공식 공지(S6)에 따르면 Forever는 서버(realm)가 없는 구조입니다.
   - 캐릭터 이름은 **이름 + 성** 두 부분입니다.
   - **두 부분을 합친 전체 이름이 region 안에서 고유**합니다.
   - 성은 게임 안에서 숨길 수 있습니다.
   - S5는 "게임 모드마다 하나의 세계"이고, "region + game mode + 이름"으로 캐릭터를 찾는다고 설명합니다.
4. **`UnitName`의 두 번째 반환값이 Forever에서는 성(surname)입니다.**
   - API 문서(S1·S3)의 반환값 이름은 `unitServer`입니다.
   - 하지만 Forever UI 소스의 `Blizzard_FrameXMLUtil/Camelot/NameUtil.lua`(S3)는 이 값을 surname으로 다룹니다. 예: `local name, surname = UnitName(unit)`.
   - 이름과 성을 잇는 구분자는 `Constants.CharacterNameSeparatorConsts.CHARACTERNAME_SURNAME_SEPARATOR` 상수입니다. 값은 UI 소스에 없습니다(`RUNTIME_REQUIRED`).
5. **장착 아이템 레벨은 문서화된 API로 얻을 수 있습니다.**
   - 방법: `ItemLocation:CreateFromEquipmentSlot(slot)` → `C_Item.GetCurrentItemLevel(itemLocation)`
   - Forever 캐릭터 창(Camelot `PaperDollFrame.lua`)이 같은 방식으로 `ItemLocation`과 `Item:CreateFromEquipmentSlot`을 사용합니다.
6. **게임 모드를 클라이언트에서 읽을 수 있습니다.**
   - 문서화된 API: `C_GameRules.GetActiveGameMode()`, `GetCurrentGameModeRecordID()`, `IsHardcoreActive()`, `IsSelfFoundAllowed()`, `IsStandard()`, `GetForeverExperiencePreset()`
   - `Enum.ForeverExperiencePreset` = `Classic 0`, `Modern 1` (S1)
   - `Enum.GameMode`의 값 목록은 공개 문서에 없습니다(`RUNTIME_REQUIRED`).
7. **SavedVariables를 다시 읽지 못하는 버그가 보고되었습니다**(S2 README, 2026-09-18~24, 다른 사용자도 재현). 이후 빌드에서 고쳐졌는지는 확인되지 않았습니다.
   - **2026-10-08 재점검 (Phase 3D)** — 과거 확인과 최근 공개 자료를 나눠 적습니다.

     | 시점 | 출처 | 내용 | 판정 |
     |---|---|---|---|
     | 과거 (빌드 1.60.1.69893, 2026-09-17~) | [EU 포럼: "Addon SavedVariables never load on 1.60.1.69893"](https://eu.forums.blizzard.com/en/wow/t/addon-savedvariables-never-load-on-160169893/629799), S2 README(2026-09-24 갱신) | 로그아웃할 때 파일은 쓰지만, 다음 실행의 `ADDON_LOADED`에서 값이 비어 있음 | 여러 사용자 재현 (`COMMUNITY_CONFIRMED`) |
     | 과거 (빌드 1.60.1.69913) | [EU 포럼 스레드](https://eu.forums.blizzard.com/en/wow/t/solvedforever-beta-160169913-savedvariables-fail-to-load-on-client-startupreload-%E2%80%94-all-addon-settings-reset-on-restart/629888) (제목에 [SOLVED] 표시) | `/reload`로는 유지, 클라이언트를 껐다 켜면 초기화 | 커뮤니티 보고 |
     | 최근 | [nobewayo/ForeverSVFix](https://github.com/nobewayo/ForeverSVFix) README (저장소는 2026-09-25 보관 처리됨) | "It seems that Blizzard have fixed the issue."<br>고쳐진 빌드와 날짜는 적혀 있지 않음 | **커뮤니티 단일 출처 주장. Blizzard 공식 확인 없음** |
     | 최근 | S2 README | 수정 기록 없음 ("Not every other row has been re-checked") | 갱신 안 됨 |

   - **현재 판정: 확인 필요 (게임 실행 필요).** "고쳐졌다"로 바꾸지 않습니다.
   - Collector 설계는 버그 여부와 관계없이 동작합니다. 한 세션의 export를 파일로 남기고, 누적은 서버가 합니다.
   - 파일 **쓰기**는 과거 보고에서도 정상이었습니다.
   - 클라이언트가 종료할 때 파일은 쓰지만, 다음 실행 때 읽어 오지 않는다는 내용입니다.
   - 영향: 애드온이 세션을 넘어 기록을 누적한다고 가정하면 안 됩니다. 한 세션의 결과를 파일로 내보내고, 누적은 서버가 해야 합니다.
8. **등록되지 않은 이벤트를 `RegisterEvent`하면 오류가 나고 파일 실행이 중단됩니다**(S2). 이벤트 등록은 반드시 `pcall`로 감쌉니다.
9. **Blizzard WoW Forever 웹 API는 공개되지 않았습니다.**
   - S5는 "Blizzard가 API 접근을 허용하면" 출시하겠다고 안내합니다.
   - S7에서도 Forever namespace를 찾지 못했습니다.

## 3. Capability Matrix — 캐릭터

| 데이터 | API / 소스 | 현재 확인 수준 | 서버 수집 가능성 | 비고 |
|---|---|---|---|---|
| 이름(이름 부분) | `UnitNameUnmodified("player")` 1번째, `UnitName("player")` 1번째 | `CLIENT_API_DOCUMENTED` (S1, S3) | 클라이언트 전용 / 공식 API 필요 | Forever UI가 `UnitNameUnmodified`로 자기 이름을 비교(`NameUtil.IsPlayerMe`) |
| 성(surname) | `UnitNameUnmodified("player")` / `UnitName("player")` 2번째 | `CLIENT_SOURCE_REFERENCED` (S3 Camelot NameUtil) + `RUNTIME_REQUIRED` | 클라이언트 전용 | 문서상 이름은 `unitServer`. Forever UI는 surname으로 사용. 숨김 설정 시 값, 구분자 값은 실행 필요 |
| 전체 이름 | `UnitFullName("player")` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 반환값 `unitName, unitServer`. Forever에서 두 번째 값의 의미는 실행 필요 |
| 성 표시 여부 | `C_PlayerInfo.ShouldDisplaySurname()` | `CLIENT_API_DOCUMENTED` (S3) | 클라이언트 전용 | 캐릭터 표시용. 식별에는 쓰지 않음 |
| GUID | `UnitGUID("player")` | `CLIENT_API_DOCUMENTED` (반환 `WOWGUID?`) | 클라이언트 전용 | 인자 타입 `UnitTokenPvPRestrictedForAddOns`. 형식("Player-…")과 영속성은 실행 필요 |
| 레벨 | `UnitLevel("player")` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 / 공식 API 필요 | — |
| 레벨 상승 시각 | 이벤트 `PLAYER_LEVEL_UP(level, …)`, `PLAYER_LEVEL_CHANGED(oldLevel, newLevel, real)` | `CLIENT_API_DOCUMENTED` (payload 문서화) | 클라이언트 전용 | `level_milestones.SOURCE_REPORTED` 후보. 시각은 `GetServerTime()`으로 기록 |
| 직업 | `UnitClass("player")` → `className, classFilename, classID` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | `classFilename`(영어 코드)을 우리 `class_code`로 매핑. Forever 직업 목록은 실행 또는 공식 자료 필요 |
| 종족 | `UnitRace("player")` → `localizedRaceName, englishRaceName, raceID` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 2번째 값이 영어 코드 |
| 진영 | `UnitFactionGroup("player")` → `factionGroupTag, localized` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | — |
| 길드 | `GetGuildInfo("player")`, `IsInGuild()` | `GetGuildInfo`: `CLIENT_SOURCE_REFERENCED`(S1·S2 `_G`에 존재, 문서 없음) / `IsInGuild`: `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | `GetGuildInfo` 반환 형식은 실행 필요. 길드 외부 ID API는 찾지 못함(`UNKNOWN`) |
| region | `GetCurrentRegion()` → number, `GetCurrentRegionName()` → cstring | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 번호와 지역 대응은 실행 필요 |
| game mode | `C_GameRules.GetActiveGameMode()` → `GameMode`, `GetCurrentGameModeRecordID()`, `IsHardcoreActive()`, `IsSelfFoundAllowed()`, `IsStandard()`, `GetForeverExperiencePreset()` → `ForeverExperiencePreset?` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | `Enum.GameMode` 값 목록은 미공개(`RUNTIME_REQUIRED`). `ForeverExperiencePreset` = Classic 0 / Modern 1 |
| realm 존재 여부 | 공식 공지(S6), `GetRealmName()`, `GetNormalizedRealmName()` | 구조: 공식 공지로 **realm 없음** / API: `CLIENT_API_DOCUMENTED` | — | realm 함수는 남아 있지만 Forever에서 반환값의 의미는 실행 필요 |
| 클라이언트 빌드 | `GetBuildInfo()` → `buildVersion, buildNumber, buildDate, interfaceVersion, localizedVersion, buildInfo` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 예: 1.60.1 / 70170 / 16001 (S1 메타) |
| 클라이언트 언어 | `GetLocale()` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | — |
| 서버 시각 | `GetServerTime()` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 관측 시각 |
| `WOW_PROJECT_ID` | 전역 상수 | `COMMUNITY_CONFIRMED`(S2: `== WOW_PROJECT_MAINLINE`) | — | S1 `_G` 덤프는 상수를 수집하지 않으므로 없다고 판단할 수 없음 |
| 플레이 시간 | `RequestTimePlayed()` → 이벤트 `TIME_PLAYED_MSG(totalTimePlayed, timePlayedThisLevel)` | 이벤트: `CLIENT_API_DOCUMENTED` / 함수: `CLIENT_SOURCE_REFERENCED` | 클라이언트 전용 | 서버에 요청을 보내므로 Collector는 사용하지 않음(선택 기능 후보) |

### 캐릭터 이름의 고유성 (조사 결과)

| 항목 | 내용 | 근거 |
|---|---|---|
| realm | 없음. 게임 모드마다 하나의 세계 | S6 공식 공지 요약, S5 |
| 이름 구조 | 이름(first) + 성(surname). 둘 다 필수. 성은 표시를 숨길 수 있음 | S6 |
| 고유 범위 | **region 안에서 전체 이름(이름+성)이 고유**. 이름만은 겹칠 수 있음 | S6 |
| 클라이언트 표현 | `UnitName` 2번째 값 = surname. 표시용 전체 이름은 구분자 상수로 연결 | S3 Camelot `NameUtil.lua` |

우리 설계에 주는 영향(명세서 반영은 별도 승인 필요):

- 명세서 §7의 "Realm은 필수값으로 가정하지 않음"과 맞습니다. 확인된 공개 정보로는 **realm 컬럼이 필요 없습니다.**
- 자연 키 `(dataEnvironment, region, gameMode, name_normalized)`의 `name_normalized`는 **이름+성 전체 이름**이어야 합니다.
  - 공지는 고유 범위를 "region 안"이라고 하므로, gameMode가 달라도 같은 이름은 쓸 수 없을 수 있습니다.
  - 그래도 gameMode를 키에 포함해도 충돌은 생기지 않습니다(더 좁은 범위).
- 1순위 식별자는 `UnitGUID`입니다. 이름은 바뀔 수 있으므로 외부 ID 매핑을 씁니다.

## 4. Capability Matrix — 장비

### 4-1. 집중 확인 대상 함수

| 함수 | Forever 자료에 존재 | 정확한 인자 | 반환값 | 장비 레벨에 쓸 수 있나 | runtime 검증 |
|---|---|---|---|---|---|
| `C_Item.GetCurrentItemLevel` | ✅ 문서화 (S1 Item 시스템, S2 네임스페이스) | `itemLocation: ItemLocation` | `currentItemLevel: number?` | **예. 1순위.** 장착 슬롯의 실제 아이템 레벨. Forever `ItemMixin:GetCurrentItemLevel`이 장착 아이템에 이 API를 씀(S3) | 값이 "업그레이드 반영 실제 레벨"인지 실행 필요 |
| `C_Item.GetDetailedItemLevelInfo` | ✅ 문서화 | `itemInfo: ItemInfo` (itemID, 이름, 링크) | `actualItemLevel: number, previewLevel: bool, sparseItemLevel: number` | 예. **2순위**(링크 기준). `actualItemLevel` 사용 | 링크로 계산한 값과 `GetCurrentItemLevel`의 차이 확인 필요 |
| `C_Item.GetItemInfo` | ✅ 문서화 | `itemInfo: ItemInfo` | `itemName, itemLink, itemQuality, itemLevel, itemMinLevel, itemType, itemSubType, itemStackCount, itemEquipLoc, itemTexture, sellPrice, classID, subclassID, bindType, expansionID, setID?, isCraftingReagent, itemDescription` | 기본 아이템 레벨(`itemLevel`)만. 장착 인스턴스 레벨이 아닐 수 있음 → 카탈로그용 | 캐시되지 않으면 nil 가능(`ITEM_DATA_LOAD_RESULT` 대기) |
| `C_Item.GetItemInfoInstant` | ✅ 문서화 | `itemInfo: ItemInfo` | `itemID, itemType, itemSubType, itemEquipLoc, icon, classID, subClassID` | 아니오(레벨 없음). 슬롯·아이콘·분류용. 캐시 없이 즉시 반환 | — |
| `C_Item.GetItemID` | ✅ 문서화 | `itemLocation: ItemLocation` | `itemID: number` | 아니오 (ID용) | — |
| `C_Item.GetItemLink` | ✅ 문서화 | `itemLocation: ItemLocation` | `itemLink: string?` | 아니오 (링크용) | 링크 문자열 형식은 실행 필요 |
| `C_Item.GetItemQuality` | ✅ 문서화 | `itemLocation: ItemLocation` | `itemQuality: ItemQuality?` | 아니오 (품질용) | `Enum.ItemQuality` 값은 공개 덤프에 없음(실행 필요) |
| `GetInventoryItemID` | ✅ `_G` (S1·S2), Forever `PaperDollFrame.lua`에서 사용(S3). APIDocumentation에는 없음 | `(unit, slotId)` — S3 사용 예: `GetInventoryItemID("player", slotId)` | itemID (사용 패턴 기준) | 아니오 (ID용) | 반환 형식 실행 필요 |
| `GetInventoryItemLink` | ✅ `_G` (S1·S2), S3에서 사용 | `(unit, slotId)` | 아이템 링크 문자열 (사용 패턴 기준) | 아니오 | 실행 필요 |
| `GetAverageItemLevel` | ✅ `_G` (S1·S2), S3 Forever `PaperDollFrame_SetItemLevel`에서 사용 | 없음 | `avgItemLevel, avgItemLevelEquipped, avgItemLevelPvP` (S3 사용 패턴) | 참고용. 게임 자체 평균. Forever 캐릭터 창은 레벨 10부터 표시(`MIN_PLAYER_LEVEL_FOR_ITEM_LEVEL_DISPLAY = 10`) | 계산 방식 미공개. 우리 랭킹은 Gear Profile로 직접 계산 |
| `ItemLocation` | ✅ S3 `Blizzard_ObjectAPI/Mainline/ItemLocation.lua`. Forever가 로드하는 TOC(`[Family]\ItemLocation.lua`)에 포함되고 Camelot PaperDollFrame에서 사용 | `ItemLocation:CreateFromEquipmentSlot(equipmentSlotIndex)` | `ItemLocationMixin` 객체 | 예 (`GetCurrentItemLevel`의 인자) | S1 `_G` 덤프는 일반 테이블을 수집하지 않으므로 덤프 부재는 근거가 아님 |
| `Item:CreateFromEquipmentSlot` | ✅ S3 `Blizzard_ObjectAPI/Mainline/Item.lua`, Camelot `PaperDollFrame.lua` 1784·1810행에서 사용 | `Item:CreateFromEquipmentSlot(equipmentSlotIndex)` | `ItemMixin` (`GetItemID`, `GetItemLink`, `GetItemQuality`, `GetCurrentItemLevel`, `ContinueOnItemLoad` 등) | 예. 내부적으로 `C_Item.GetCurrentItemLevel` 호출 | 비동기 로드(`ContinueOnItemLoad`) 동작은 실행 필요 |

### 4-2. 장비 데이터 전체

| 데이터 | API / 소스 | 현재 확인 수준 | 서버 수집 가능성 | 비고 |
|---|---|---|---|---|
| 장비 슬롯 목록 | Forever `PaperDollFrame.xml`(Camelot) 슬롯 20개: Head, Neck, Shoulder, Back, Chest, Shirt, Tabard, Wrist, Hands, Waist, Legs, Feet, Finger0, Finger1, Trinket0, Trinket1, MainHand, SecondaryHand, **Ranged**, **Ammo** | `CLIENT_SOURCE_REFERENCED` (S3) | — | Classic식 원거리·탄약 슬롯이 있음. Gear Profile 초안의 근거 |
| 슬롯 이름 → 번호 | `C_PaperDollInfo.GetInventorySlotInfo(slotName)` → `invSlot, slotTexture, checkRelic`. `GetInventorySlotInfoForInvSlot(invSlotValue)`. `IsInventorySlotEnabled(slotName)` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 슬롯 번호 상수(`INVSLOT_*`)는 UI 소스에 정의가 없어 실행 필요 |
| item ID | `GetInventoryItemID`, `C_Item.GetItemID(itemLocation)` | 문서화 + 소스 참조 | 클라이언트 전용 | — |
| item link | `GetInventoryItemLink`, `C_Item.GetItemLink(itemLocation)` | 문서화 + 소스 참조 | 클라이언트 전용 | 링크 안의 item string 필드 구성은 실행 필요 |
| item name | `C_Item.GetItemNameByID`, `C_Item.GetItemInfo` 1번째 | `CLIENT_API_DOCUMENTED` | 공개 데이터(카탈로그) 가능성 | 캐시 필요 |
| item level | `C_Item.GetCurrentItemLevel(ItemLocation)` → `C_Item.GetDetailedItemLevelInfo(link)` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | **확보 경로 확정(공개 자료 기준)**. 실제 값 검증은 실행 필요 |
| quality | `C_Item.GetItemQuality(itemLocation)`, `GetInventoryItemQuality` (S3 사용) | 문서화 + 소스 참조 | 클라이언트 전용 | enum 값 실행 필요 |
| icon | `GetInventoryItemTexture` (S3 사용), `C_Item.GetItemIconByID` | 문서화 + 소스 참조 | 공개 데이터(카탈로그) 가능성 | 반환값은 `fileID`(숫자). 웹 이미지 URL로 바꾸는 매핑은 별도 필요(`UNKNOWN`) |
| inventory type | `C_Item.GetItemInventoryType(itemLocation)`, `GetItemInfoInstant` 4번째(`itemEquipLoc`) | `CLIENT_API_DOCUMENTED` | — | 양손 무기 판정 근거 |
| enchant | 아이템 링크 / item string의 마법부여 필드 | `RUNTIME_REQUIRED` | 클라이언트 전용 | 마법부여 ID를 직접 주는 문서화 API를 찾지 못함. 링크 원문을 내보내고 서버에서 해석 |
| gems | `C_Item.GetItemNumSockets(itemInfo)` → `socketCount`, `C_Item.GetItemGemID(itemInfo, index)` → `gemID`, `C_Item.GetItemGem(hyperlink, index)` → `gemName, gemLink` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 전역 `GetItemGem`은 없음 |
| equipped state | `C_Item.IsEquippedItem(itemInfo)`, `C_Item.DoesItemExist(emptiableItemLocation)` | `CLIENT_API_DOCUMENTED` | — | 장착 슬롯을 직접 읽으므로 장착 상태는 슬롯 존재로 판단 |
| 데이터 로드 | `C_Item.IsItemDataCached(itemLocation)`, `C_Item.RequestLoadItemData(itemLocation)`, 이벤트 `ITEM_DATA_LOAD_RESULT(itemID, success)` | `CLIENT_API_DOCUMENTED` | — | 캐시 안 된 아이템 처리 |
| 장비 변경 감지 | 이벤트 `PLAYER_EQUIPMENT_CHANGED(equipmentSlot, hasCurrent)`, `PLAYER_AVG_ITEM_LEVEL_UPDATE` | `CLIENT_API_DOCUMENTED` | — | — |
| average item level | `GetAverageItemLevel()` | `CLIENT_SOURCE_REFERENCED` | 클라이언트 전용 | 참고값으로만 내보냄 |
| 다른 플레이어 장비 | `NotifyInspect`, `C_PaperDollInfo.GetInspectItemLevel(unit)`, 이벤트 `INSPECT_READY` | 문서화 / `_G` | **사용하지 않음** | 정책상 다른 플레이어 자동 수집 금지 |
| 툴팁 데이터 | `C_TooltipInfo.GetInventoryItem(unit, slot, hideUselessStats?)` → `TooltipData` | `CLIENT_API_DOCUMENTED` | — | 보조 수단. Collector v1에서는 쓰지 않음 |

### 4-3. 공개 덤프에 **없는** 전역 함수 (Classic 시절 API)

두 덤프(S1 build 70170, S2 build 69893)의 `_G` 함수 목록에 모두 없는 함수입니다.

`GetItemInfo`, `GetDetailedItemLevelInfo`, `GetItemGem`, `IsEquippedItem`, `CombatLogGetCurrentEventInfo`

→ `ForeverRankProbe`의 후보 중 이 항목들은 실제 게임에서 "사용 불가"로 나올 가능성이 높습니다. 존재 여부를 검사하는 것이므로 코드는 그대로 둡니다. 대체 API는 `C_Item.*`이고, `ForeverRankCollector`는 대체 API만 사용합니다.

## 5. Capability Matrix — 향후 (던전 / 레이드 / 전투)

| 데이터 | API / 소스 | 현재 확인 수준 | 서버 수집 가능성 | 비고 |
|---|---|---|---|---|
| 보스 전투 시작/종료 | 이벤트 `ENCOUNTER_START(encounterID, encounterName, difficultyID, groupSize)`, `ENCOUNTER_END(…, success, encounterUnitStatus)`, `BOSS_KILL(encounterID, encounterName)` | `CLIENT_API_DOCUMENTED` | 클라이언트 전용 | 클리어 시간 측정 후보. 그룹 전체 기록은 참여자 동의가 필요 |
| 던전 정보 | `GetInstanceInfo()`, `GetSavedInstanceInfo()` (`_G`), `C_RaidLocks.*`, `C_LFGInfo.*`, 이벤트 `UPDATE_INSTANCE_INFO`, `SCENARIO_COMPLETED` | `_G` 존재 / 일부 문서화 | 클라이언트 전용 | 반환 형식은 실행 필요 |
| 던전 도감 | `C_EncounterJournal.*` 22개 함수 | `_G` 존재 | 공개 데이터 가능성 | S2: 베타 게임 규칙 `EncounterJournalDisabled=1`. 실제 사용 가능 여부는 실행 필요 |
| 쐐기 / 도전 모드 | `C_ChallengeMode.*` 29개, 이벤트 `CHALLENGE_MODE_COMPLETED` | `_G` 존재, 이벤트 문서화 | — | Forever에 해당 콘텐츠가 있는지 `UNKNOWN` |
| 전투 로그 | `C_CombatLog.*` 11개 (`IsCombatLogRestricted` 등), 이벤트 `COMBAT_LOG_EVENT_UNFILTERED` | 문서화 / `_G`. 전역 `CombatLogGetCurrentEventInfo`는 **없음** | — | S2: 전투 로그가 제한됨(`COMMUNITY_CONFIRMED`). 로그 기반 검증(`LOG_VERIFIED`)은 현재 어려움 |
| 피해량 측정 | `C_DamageMeter.*` 8개 (`GetCombatSessionFromID`, `GetSessionDurationSeconds` 등) | `_G` 존재 | 클라이언트 전용 | 내장 미터. 전투 시간 측정에 쓸 수 있는지 실행 필요 |
| 클리어 시간 | 위 이벤트와 `GetServerTime()` 조합 | `RUNTIME_REQUIRED` | 사용자 제출 / 공식 API 필요 | 자기 클라이언트 기준 측정값이므로 `COMMUNITY_SUBMITTED` |

## 6. API Export (`/apiexport`, `APIDocumentation`) 분석

| 항목 | 내용 | 근거 |
|---|---|---|
| `/api` | 클라이언트 내장 API 문서 명령. 데이터는 `Blizzard_APIDocumentation` + `Blizzard_APIDocumentationGenerated` 애드온 | S3 파일 목록, S1 docs/README |
| `/apiexport` | **클라이언트 기본 명령이 아닙니다.** S1의 `WowApiExport` 애드온이 등록하는 명령 | S1 `src/WowApiExport` |
| export 내용 | `APIDocumentation.systems`의 Functions / Events / Tables + `_G` 목록. `_G` 목록에는 함수와 `C_*` 네임스페이스의 함수 멤버만 들어 있음 | S1 export 애드온 소스(읽기만 함) |
| `_G` 목록의 한계 | 일반 테이블(`ItemLocation`, `Item`, `Enum`), 상수(`WOW_PROJECT_ID`, `INVSLOT_*`), 프레임은 수집하지 않음 | 위와 같음 |
| 공개 덤프 규모 | S1: 410 시스템, 6,598 함수, 1,806 이벤트, 797 타입, `_G` 함수 5,994 / S2: 함수 6,045, 프레임 11,417, 네임스페이스 269 | S1 meta, S2 JSON |
| 교차 확인 | 두 덤프에 공통인 전역 함수 5,956개. 이 문서의 대상 함수는 두 덤프의 결과가 모두 같음 | 이번 분석 |
| 최신 생성 문서 | S3 `forever` 브랜치(1.60.1.70235)의 `Blizzard_APIDocumentationGenerated` 641개 파일 | S3 |

결론:

- 이번 목적에 필요한 API 목록과 시그니처는 공개 덤프로 충분합니다. 사용자가 게임에서 `/apiexport`를 할 필요는 없습니다.
- 다만 다음 세 가지는 공개 덤프로 알 수 없어 실제 실행이 필요합니다.
  - 반환값의 실제 형식(GUID, 링크, 구분자)
  - enum 값(`GameMode`, `ItemQuality`, `InventoryType`)
  - 슬롯 번호

## 7. 게임 접속 없이 확정한 것 / 확정하지 못한 것

**확정 (공개 자료 근거가 있음)**

- interface `16001`, Retail 계열 API, Classic 전역 함수 부재
- realm 없음, 이름+성 구조, region 안에서 전체 이름 고유 (공식 공지)
- 캐릭터·장비·게임 모드·빌드·레벨 상승 이벤트를 읽는 **API 경로와 시그니처**
- 장착 아이템 레벨 확보 경로: `ItemLocation` → `C_Item.GetCurrentItemLevel`
- Forever 캐릭터 창의 장비 슬롯 20개 이름
- SavedVariables 재로드 버그 보고, 이벤트 등록 오류 동작(커뮤니티 실측)

**확정하지 못함 (`RUNTIME_REQUIRED` / `UNKNOWN`)**

| 항목 | 이유 |
|---|---|
| GUID 실제 형식과 영속성 | 값 형식은 실행해야 알 수 있음 |
| 성 구분자 값, 성을 숨겼을 때 `UnitName` 반환값 | 상수가 클라이언트 C 쪽에 있음 |
| `Enum.GameMode`, `Enum.ItemQuality`, `Enum.InventoryType` 값 | 공개 덤프에 없음 |
| 장비 슬롯 번호 | 런타임에 `GetInventorySlotInfo`로 결정 |
| 아이템 링크 / item string 필드 구성 (마법부여·보석 위치) | 실행 필요 |
| region 번호 ↔ 지역 대응, Forever 직업·종족 전체 목록 | 실행 또는 공식 자료 필요 |
| SavedVariables 버그가 현재 빌드에서 고쳐졌는지 | 커뮤니티 도구 README 한 곳이 "고쳐진 것 같다"고 함(빌드·날짜 없음). 공식 확인 없음 (2026-10-08 재점검, §2-7) |
| 길드 외부 ID | 해당 API를 찾지 못함 |
| AHledger 데이터의 다운로드 형식·이용 조건 | 네트워크 차단으로 직접 확인 못 함 |

## 8. 확인 상태 4분류 (2026-10-08, Phase 3D)

| 분류 | 뜻 | 항목 |
|---|---|---|
| **확정** | 공식 자료 또는 여러 공개 자료로 확인 | interface 16001, Retail 계열 API, Classic 전역 함수 부재<br>realm 없음, 이름 + 성, 전체 이름이 region 안에서 고유 (Blizzard 공지)<br>공식 게임 규칙 4종과 하드코어 출시 후 제공 (`docs/RULESETS.md`)<br>장착 아이템 레벨 API 경로, Forever 캐릭터 창 슬롯 이름 20개<br>과거 빌드(69893 / 69913)의 SavedVariables 재로드 버그 보고 |
| **확인 필요** | 공개 자료가 엇갈리거나 하나뿐 | SavedVariables 버그가 고쳐졌는지 (§2-7)<br>같은 전체 이름이 다른 규칙에 존재할 수 있는지<br>제3자 서비스 이용 조건 (`docs/DATA-SOURCE-POLICY.md` §0)<br>Blizzard 한국어 원문 표기 |
| **게임 실행 필요** | 실제 클라이언트에서 값을 봐야 함 | `Enum.GameMode` / `Enum.ItemQuality` / `Enum.InventoryType` 값<br>region 번호, GUID 형식, 이름과 성 구분자, 숨긴 성의 반환값<br>장비 슬롯 번호, 아이템 링크 필드, SavedVariables 저장 형식(Lua 이스케이프)<br>직업·종족 목록과 클라이언트 한국어 명칭 |
| **공식 API 필요** | 서버가 직접 수집하려면 Blizzard API가 있어야 함 | 전체 캐릭터 목록·전체 랭킹(모집단), 다른 플레이어 데이터<br>공식 캐릭터 ID, 길드 외부 ID<br>공식 아이템 카탈로그 (`docs/BLIZZARD-API-INTEGRATION-PLAN.md`) |

게임 접속 없이 검증한 것(테스트 fixture, mock 경로):

- 제출 흐름 전체(검증 → 정규화 → 식별 → Gear Profile → 중복 → 충돌 → 저장 → 랭킹)
- 규칙별 식별, 이름 + 성 식별, mock 상태 유지
- `tests/mock-export-flow.test.ts`, `tests/fixtures/character-export/mock/`

위 검증은 **가짜 게임 값**으로 한 것입니다. 실제 값이 맞는지는 "게임 실행 필요" 항목으로 남습니다.
