# WoW: Forever 게임 규칙 (Ruleset)

> 단계: Phase 3C (2026-10-07)
>
> 구현:
> - 설정 `config/rulesets.ts`
> - 코드 `lib/domain/enums.ts` (`RULESET_CODES`)
> - 도우미 `lib/config/index.ts` (`getRulesets`, `rulesetOfGameMode`, `gameModeForRuleset`)
> - 화면 `components/ranking/ruleset-filter.tsx`

## 0. 공식 근거

| 자료 | URL | 확인 날짜 | 확인 내용 |
|---|---|---|---|
| Choose Your Ruleset in World of Warcraft: Forever | <https://news.blizzard.com/en-us/article/24302070/choose-your-ruleset-in-world-of-warcraft-forever> | 2026-10-07 | 규칙 4종: Normal, PvP, Roleplaying, Hardcore.<br>Hardcore는 출시 후 제공.<br>규칙이 다른 플레이어와 파티·던전·공격대를 함께 할 수 없음.<br>PvP 규칙은 계정당 한 진영.<br>전장은 하드코어를 뺀 규칙끼리 섞일 수 있음 |
| Create a Name of Your Own in WoW: Forever | <https://news.blizzard.com/en-us/article/24304161/create-a-name-of-your-own-in-wow-forever> | 2026-10-07 | realm 없는 구조.<br>이름 + 성(두 이름) 체계.<br>**전체 이름이 region 안에서 고유**.<br>첫 이름은 다른 캐릭터와 같을 수 있음 |
| World of Warcraft: Forever Deep Dive Panel Recap | <https://news.blizzard.com/en-us/article/24303313/world-of-warcraft-forever-deep-dive-panel-recap> | 2026-10-07 | 게임 시스템 소개(캠핑, 전문 기술, Legacy 시스템, 비행 탈것·레벨 스케일링 없음).<br>Ruleset 내부 값이나 API 정보는 없음 |

확인 방법과 한계:

- 이 작업 환경에서는 `news.blizzard.com` 직접 접속이 네트워크 정책으로 막혀 있습니다. 그래서 **검색 결과 요약**으로 내용을 확인했습니다.
- 한국어 규칙 이름(일반 / 전쟁 / 롤플레잉 / 하드코어)은 한국어 공지를 옮긴 게시물(인벤, 루리웹 뉴스, "WOW: 포에버에서 나만의 규칙을 선택하세요")에서 확인했습니다.
- Blizzard 한국어 원문 URL은 직접 확인하지 못했습니다(확인 필요).
- 게임 클라이언트 안의 한국어 표기는 게임 내 실행 검증이 필요합니다.

## 1. 구조

| 코드 | 한국어 | 공개 상태 | 클라이언트 `Enum.GameMode` 값 | 진영 규칙 |
|---|---|---|---|---|
| `normal` | 일반 | `AVAILABLE` | **미확인** (`UNKNOWN`, null) | 양 진영 |
| `pvp` | 전쟁 | `AVAILABLE` | **미확인** | 계정당 한 진영 |
| `roleplaying` | 롤플레잉 | `AVAILABLE` | **미확인** | 양 진영 |
| `hardcore` | 하드코어 | `POST_LAUNCH` (출시 후 제공) | **미확인** | 양 진영 |

공개 상태:

| 상태 | 뜻 |
|---|---|
| `AVAILABLE` | 출시 시 제공 |
| `POST_LAUNCH` | 출시 후 제공 예정 |
| `UNKNOWN` | 공식 자료로 확인할 수 없음 |

중요한 구분:

- **공개 상태는 공식 발표 기준이고, 클라이언트 내부 값과 무관합니다.**
- `Enum.GameMode`의 실제 숫자는 공개 문서에 없습니다(FOREVER-API-CAPABILITY §2-6). 추측해서 넣지 않습니다.
- 설정 검증이 막는 것:
  - `clientGameMode`는 `CONFIRMED`일 때만 숫자를 가질 수 있습니다.
  - `config/export-mapping.ts`의 `gameModeByActiveGameMode`는 계속 비어 있습니다. 값은 공식 Ruleset 코드만 허용합니다.

## 2. 축 분리

| 축 | 값 | 저장 위치 |
|---|---|---|
| 데이터 영역 | `mock` / `beta` / `live` | `data_environment` |
| 지역 | 설정 `gameScopes.regions` (beta / live 미확인) | `region` |
| 게임 규칙 | `normal` / `pvp` / `roleplaying` / `hardcore` | `game_mode` |

- **기존 `game_mode` 컬럼을 그대로 씁니다.** 실제 영역(beta / live)에서는 이 컬럼에 Ruleset 코드를 저장합니다.
  - 그래서 스키마 변경이나 기존 데이터 변경이 없습니다.
  - API의 `gameMode` 파라미터도 계속 동작합니다.
- 지역과 규칙을 한 문자열로 합치지 않습니다(예: `kr-normal` 금지).
  - beta / live의 gameMode 코드가 공식 Ruleset 코드가 아니면 설정 검증이 거부합니다.
- mock은 개발용 코드를 Ruleset에 연결합니다(테스트 데이터).
  - `standard` → 일반, `alternate` → 전쟁
  - 롤플레잉·하드코어 mock 데이터는 없습니다.
- 데이터 영역과 규칙은 서로 다른 축입니다. beta / live 각각 안에서 규칙별로 나뉩니다.
- Ruleset 정보는 공식 자료에서 온 정적 정보라서 DB 표가 아니라 설정 파일(`config/rulesets.ts`)로 관리합니다.

## 3. 캐릭터 식별: region + ruleset + 전체 이름

- Forever는 realm이 없습니다. Realm 컬럼을 추가하지 않습니다.
- 공식 설명:
  - 캐릭터 이름은 이름 + 성입니다.
  - **전체 이름이 region 안에서 고유**합니다.
  - 첫 이름은 다른 캐릭터와 겹칠 수 있습니다.
- 자연 키는 `(data_environment, region, game_mode = ruleset, name_normalized = 전체 이름)`입니다.
  - 공식 설명은 "region 안에서 고유"입니다. 그런데 규칙이 다르면 서로 다른 세계이고 랭킹도 따로 계산하므로, 식별에 규칙도 포함합니다.
  - 같은 전체 이름이 서로 다른 규칙에 있을 수 있는지는 확인 필요입니다.
- **첫 이름만으로 식별하지 않습니다.**
  - Character Export에 성이 없으면 `FULL_NAME_REQUIRED`로 정규화하지 않습니다.
  - 공개 제출은 버리지 않고 검토 대기(매핑 대기)로 보관합니다.
  - 이유: 게임에서 성을 숨긴 경우 export에 성이 담기는지는 Runtime verification required입니다.
- 전체 이름 = 이름 + 구분자 + 성(`buildFullName`). 구분자(`CHARACTERNAME_SURNAME_SEPARATOR`)는 미확인이라 설정값(`nameSeparator`)으로만 받습니다.
- 외부 ID(GUID, 공식 캐릭터 ID)가 있으면 그것이 우선합니다(명세서 §7.3).

## 4. 랭킹과 화면

- 랭킹은 **규칙별로 따로** 계산합니다.
  - 공식 자료에서도 규칙이 다르면 함께 플레이할 수 없습니다.
  - 그래서 랭킹 화면에는 규칙을 합친 "전체" 선택이 없습니다.
  - 캐릭터 검색은 "게임 규칙: 전체"로 모든 규칙에서 찾을 수 있습니다.
- 랭킹 화면의 "게임 규칙" 선택(`RulesetFilter`):
  - 공식 규칙 4개를 항상 보여 줍니다.
  - 이 데이터 영역에 데이터가 연결된 규칙만 링크입니다(`?ruleset=normal`).
  - 연결되지 않은 규칙은 "데이터 준비 중"으로, 하드코어는 "출시 후 제공"으로 표시합니다.
- 데이터가 없는 규칙을 요청한 경우:
  - 화면: "이 게임 규칙의 데이터는 준비 중입니다"
  - API: 200 + `meta.status = "unavailable"`, `unavailableReason = "RULESET_NOT_AVAILABLE"`, `meta.ruleset`
- beta / live는 region 설정이 미완료라서 지금도 "데이터 설정 준비 중"입니다. 규칙 4개는 모두 "데이터 준비 중"으로 표시됩니다.
- 랭킹 API `meta.ruleset`에 요청 범위의 규칙을 담습니다.

## 5. 아직 확인되지 않은 항목

| 항목 | 상태 | 확인 방법 |
|---|---|---|
| `Enum.GameMode` 숫자와 규칙의 대응 | 미확인 | Collector export의 `gameMode.activeGameMode` (게임 내 실행) |
| region 코드 목록과 `GetCurrentRegion()` 값 | 미확인 | Collector export |
| 같은 전체 이름이 다른 규칙에 있을 수 있는지 | 미확인 | 공식 FAQ 또는 실제 데이터 |
| 이름과 성 사이 구분자 | 미확인 | 게임 내 실행 |
| 숨긴 성이 export에 담기는지 | 미확인 | 게임 내 실행 |
| 클라이언트의 한국어 규칙 표기 | 미확인 (한국어 공지 기준 표기 사용) | 한국어 클라이언트 |
| 하드코어 출시 시점과 규칙 이동(하드코어 → 다른 규칙) 처리 | 미확인 | 공식 발표 |
| 규칙별 최대 레벨 | 미확인 | 공식 발표 / 실제 데이터 |
