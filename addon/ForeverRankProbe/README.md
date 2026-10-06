# Forever Rank Probe

WoW: Forever 클라이언트에서 **우리 랭킹 사이트에 필요한 캐릭터 정보를 어떤 API로 읽을 수 있는지** 검사하는 애드온입니다.

> ⚠️ 이 애드온은 아직 실제 게임 클라이언트에서 실행해 보지 않았습니다.
> 아래에 적힌 모든 동작은 **게임 내 실행 검증 필요** 상태입니다.
> (게임 밖에서는 Lua 5.1 문법 검사, 정적 분석, 가짜 API로 만든 오프라인 하네스만 통과했습니다.)

## 하는 일 / 하지 않는 일

| 하는 일 | 하지 않는 일 |
|---|---|
| 현재 로그인한 **자신의 캐릭터**만 검사 | 다른 플레이어 정보 수집, 자동 Inspect |
| 후보 API가 클라이언트에 **있는지**, **호출되는지**, **무엇을 돌려주는지** 기록 | 존재하지 않는 API의 값을 지어내기 |
| 결과를 SavedVariables 파일(내 PC)에 저장 | 외부 서버로 전송 (애드온은 통신 기능이 없음) |
| 레벨 상승 이벤트가 오면 시각을 기록 | 게임 플레이 자동화, 자동 실행 |
| `/frp scan`을 입력할 때만 검사 | 계정 정보, BattleTag, 비밀번호 수집 |

## 설치 (Windows)

1. 이 폴더(`ForeverRankProbe`)를 통째로 복사합니다.
2. WoW 설치 폴더의 `Interface\AddOns` 아래에 붙여 넣습니다.

```text
World of Warcraft
└── _classic_beta_            ← 실제 폴더 이름은 설치 상태에 따라 다를 수 있습니다
    └── Interface
        └── AddOns
            └── ForeverRankProbe
                ├── ForeverRankProbe.toc
                ├── Core.lua
                ├── Probe.lua
                ├── SavedVariables.lua
                └── README.md
```

- 기본 설치 위치 예: `C:\Program Files (x86)\World of Warcraft\_classic_beta_\Interface\AddOns\`
- WoW: Forever 베타가 쓰는 실제 폴더 이름(`_classic_beta_` 등)은 **Battle.net 앱 → 게임 설정 → 폴더 열기**로 확인하고 위 경로를 바꿔 사용하세요.
- `Interface\AddOns` 폴더가 없으면 직접 만들어도 됩니다.

### interface 버전

`ForeverRankProbe.toc`의 `## Interface: 16001`은 작업 지시로 받은 값이며 아직 확인되지 않았습니다.

캐릭터 선택 화면의 **애드온** 목록에 "오래된 애드온"으로 표시되면 다음 중 하나를 하세요.

- "오래된 애드온 불러오기"를 켭니다.
- 게임 안에서 `/run print((select(4, GetBuildInfo())))`의 결과로 `## Interface:` 값을 바꿉니다. 이 명령이 동작하는지도 게임 내 실행 검증 필요입니다.

## 사용 방법

| 명령 | 설명 |
|---|---|
| `/frp` | 도움말 |
| `/frp scan` | 현재 캐릭터에서 쓸 수 있는 API를 검사합니다 |
| `/frp report` | 마지막 검사 결과를 채팅창에 요약합니다 |
| `/frp reset` | 저장된 검사 결과를 지웁니다 |

보고 예시 (형식 예시이며 실제 결과가 아님):

```text
[Forever Rank Probe] 검사 결과 요약
[사용 가능]
  캐릭터 이름 (UnitName)
  레벨 (UnitLevel)
[확인 필요]
  아이템 레벨 (GetItemInfo 4번째 값)
[사용 불가]
  외부 서버 API
[호출하지 않음]
  Inspect: NotifyInspect (NotifyInspect)
[수집하지 않음]
  계정 정보 (Battle.net 계정, BattleTag 등)
```

상태 구분:

| 구분 | 의미 |
|---|---|
| 사용 가능 | 함수가 있고, 호출에 성공했고, 값을 돌려줌. 값의 의미는 사람이 확인해야 합니다 |
| 확인 필요 | 호출은 됐지만 값이 비었거나, 일부 슬롯에서만 값이 나왔거나, 의미가 추정임 |
| 사용 불가 | 함수가 없거나 호출 중 오류가 남 |
| 호출하지 않음 | 서버 요청을 보내는 API라서 존재 여부만 확인 |
| 수집하지 않음 | 민감 정보라 호출하지도 저장하지도 않음 |

## 검사 결과 파일 찾기

SavedVariables는 **게임을 종료하거나 `/reload` 할 때** 파일로 저장됩니다.

```text
World of Warcraft\_classic_beta_\WTF\Account\<계정 폴더>\SavedVariables\ForeverRankProbe.lua
```

결과를 공유하기 전에 확인할 것:

- 파일에는 **캐릭터 이름, GUID, 서버 이름, 길드 이름, 장비 링크**가 들어 있습니다. 공유해도 괜찮은지 직접 확인하세요.
- `<계정 폴더>` 이름은 계정 식별자일 수 있으니, 경로가 아니라 **파일 내용만** 공유하세요.
- 이 파일에는 계정 정보와 비밀번호가 들어 있지 않습니다.

## 실제 API 목록 확보 (API export)

이 애드온은 후보 API를 직접 호출해 보는 것과 별개로, **클라이언트에 실제로 있는 이름**도 기록합니다(`discovery`).

- `_G`의 `C_` 네임스페이스 목록
- 장비·아이템·길드·서버·지역·게임 규칙 관련 키워드가 들어간 함수 이름
- 클라이언트 내장 API 문서(`APIDocumentation`)가 로드되어 있으면 그 시스템 이름

추가로 확인할 수 있는 방법이 있습니다. 둘 다 클라이언트에 있는지 게임 내 실행 검증 필요입니다.

1. **`/api` 명령** (다른 WoW 클라이언트의 내장 API 문서)
   - 예: `/api search ItemLevel`, `/api system list`
   - 명령이 있다면 결과 화면을 캡처해 공유해 주세요.
2. **`/apiexport` 같은 내보내기 명령**
   - 클라이언트가 지원한다면 내보낸 파일을 그대로 공유해 주세요.
   - 지원하지 않으면 위의 `discovery` 결과가 대신 쓰입니다.

> 이 애드온은 존재하지 않는 API를 목록에 추가하지 않습니다. 목록에는 클라이언트의 `_G`에서 실제로 찾은 이름만 들어갑니다.

## 개발자용: 게임 밖 검사

저장소의 `addon/` 폴더에서 실행합니다.

```bash
./tests/run.sh
```

`tests/run.sh`가 하는 일:

- `luac5.1 -p`로 문법을 검사합니다.
- `luacheck`로 정적 분석을 합니다(설정 `.luacheckrc`).
- `tests/harness.lua`로 오프라인 실행 검사를 합니다.

`tests/harness.lua`가 쓰는 가짜 API는 테스트용입니다. 실제 WoW: Forever API의 존재나 반환값을 뜻하지 않습니다.
