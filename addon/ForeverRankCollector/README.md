# Forever Rank Collector

**로그인한 내 캐릭터**의 레벨·장비·게임 모드·빌드 정보를 로컬 파일로 내보내는 애드온입니다.
내보내기 형식은 [`docs/CHARACTER-EXPORT-V1.md`](../../docs/CHARACTER-EXPORT-V1.md)를 따릅니다.

> ⚠️ **게임 내 실행 검증 필요**
> 사용하는 API는 공개 자료(Forever 클라이언트의 API 문서 덤프와 Forever UI 소스)로 존재와 시그니처를 확인했습니다. 근거는 [`docs/FOREVER-API-CAPABILITY.md`](../../docs/FOREVER-API-CAPABILITY.md)에 있습니다.
> 하지만 이 애드온 자체는 아직 실제 게임에서 실행해 보지 않았습니다.

## 하는 일 / 하지 않는 일

| 하는 일 | 하지 않는 일 |
|---|---|
| 내 캐릭터의 이름·성·GUID·레벨·직업·종족·진영·길드 이름 기록 | 다른 플레이어 정보 수집, Inspect |
| 장착 장비의 아이템 ID·링크·아이템 레벨·품질·아이콘·보석 기록 | 가방·은행 아이템 수집 |
| 게임 모드, 클라이언트 빌드, 지역 번호 기록 | 계정 정보(Battle.net 계정, BattleTag, 이메일), 채팅, 위치 수집 |
| 레벨 상승 이벤트 시각 기록 | 외부 서버 전송 (애드온에는 통신 기능이 없음) |
| 결과를 SavedVariables 파일에 저장 | 게임 플레이 자동화 |
| 얻지 못한 값은 비워 두고 목록(`unavailable`)에 적음 | 값 추정, 기본값 채우기 |

## 자동으로 갱신되는 시점

아래 이벤트가 오면 내 캐릭터 정보를 다시 읽어 내보내기 내용을 갱신합니다. 게임 조작은 하지 않습니다.

| 시점 | 이벤트 |
|---|---|
| 접속 / `/reload` 후 3초 | `PLAYER_ENTERING_WORLD` |
| 레벨 상승 | `PLAYER_LEVEL_UP` (시각도 기록) |
| 장비 변경 | `PLAYER_EQUIPMENT_CHANGED` |
| 길드 변경 | `PLAYER_GUILD_UPDATE` |
| 아이템 정보 로드 완료 | `ITEM_DATA_LOAD_RESULT` (기다리던 아이템일 때만) |
| 로그아웃 직전 | `PLAYER_LOGOUT` |

클라이언트에 없는 이벤트는 등록 오류를 기록하고 건너뜁니다.

## 명령

| 명령 | 설명 |
|---|---|
| `/frc` | 도움말 |
| `/frc export` | 지금 상태로 내보내기 내용을 갱신하고 요약을 보여 줍니다 |
| `/frc status` | 마지막 내보내기 요약 (캐릭터, 장비 수, 아이템 레벨 확인 수, 얻지 못한 항목 수) |
| `/frc clear` | 저장된 내보내기 내용을 지웁니다 |

## 설치 (Windows)

1. `ForeverRankCollector` 폴더를 통째로 복사합니다.
2. WoW 설치 폴더의 `Interface\AddOns` 아래에 붙여 넣습니다.

```text
World of Warcraft
└── _classic_beta_            ← 실제 폴더 이름은 설치 상태에 맞게 바꾸세요
    └── Interface
        └── AddOns
            └── ForeverRankCollector
                ├── ForeverRankCollector.toc
                ├── Core.lua
                ├── Json.lua
                ├── Collector.lua
                └── README.md
```

- 공개 자료(forever-addon-kit)에 따르면 베타의 제품 폴더는 `_classic_beta_`, interface는 `16001`입니다.
- 캐릭터 선택 화면에서 "오래된 애드온"으로 보이면 "오래된 애드온 불러오기"를 켭니다.

## 결과 파일

로그아웃하거나 `/reload` 하면 다음 파일에 저장됩니다.

```text
World of Warcraft\_classic_beta_\WTF\Account\<계정 폴더>\SavedVariables\ForeverRankCollector.lua
```

- `ForeverRankCollectorDB.latestExportJson`: 업로드용 JSON 문자열
- `ForeverRankCollectorDB.latestExport`: 같은 내용의 Lua 테이블

파일에는 캐릭터 이름·성·GUID·길드 이름·장비 링크가 들어 있습니다. 계정 정보는 없습니다. `<계정 폴더>` 경로는 공유하지 마세요.

### 알려진 베타 문제

공개 커뮤니티 자료(forever-addon-kit, 2026-09)에 다음 버그가 보고되어 있습니다.

> 클라이언트가 SavedVariables를 종료할 때 쓰기만 하고, 다음 실행 때 다시 읽지 않는다.

이 버그가 남아 있으면 다음과 같이 동작합니다.

- 파일에는 **마지막 세션의 상태**만 남습니다.
- 이전 세션의 레벨 상승 기록은 이어지지 않습니다.

그래서 이 애드온은 세션 단위로 내보내고, 기록 누적은 서버가 맡습니다. 버그가 고쳐졌는지는 게임 내 실행 검증 필요입니다.

## 개발자용: 게임 밖 검사

`addon/` 폴더에서 다음을 실행합니다. `jsonschema`가 설치된 파이썬이 필요합니다.

```bash
PYTHON=python3 ./tests/run.sh
```

검사 내용:

- `luac5.1` 문법 검사
- `luacheck` 정적 분석
- `tests/collector_harness.lua`로 오프라인 실행 검사(가짜 API)
- 생성된 JSON을 `docs/schemas/character-export-v1.schema.json`으로 스키마 검증

하네스의 가짜 API와 값은 테스트용입니다. 실제 WoW: Forever 반환값이 아닙니다.
