# Forever Rank Collector

- 버전: 1.0.0
- Export 형식 버전: 1 (Character Export v1)
- 지원 클라이언트: WoW: Forever

이 파일은 **WoW: Forever 애드온**입니다. 실행 파일(.exe)이 아니며, 설치 프로그램도 없습니다.
게임이 애드온 폴더의 Lua 파일을 읽어 실행합니다.

**로그인한 내 캐릭터**의 레벨·장비·게임 규칙·클라이언트 빌드 정보를 내 컴퓨터의 파일로 저장합니다.
그 파일을 Forever Rank 사이트의 "캐릭터 데이터 제출" 화면에서 직접 올리면 랭킹 등록을 요청할 수 있습니다.

> ⚠️ **실제 게임에서 확인 필요**
> 사용하는 게임 기능은 공개 자료(WoW: Forever 클라이언트 API 문서와 UI 소스)로 확인했습니다.
> 하지만 이 애드온은 아직 실제 게임에서 실행해 보지 않았습니다. 동작이 다르면 사이트에 알려 주세요.

## 하는 일 / 하지 않는 일

| 하는 일 | 하지 않는 일 |
|---|---|
| 내 캐릭터의 이름·성·GUID(게임 안 고유 식별값)·레벨·직업·종족·진영·길드 이름 기록 | 다른 플레이어 정보 수집, 살펴보기(Inspect) |
| 장착 장비의 아이템 번호·링크·아이템 레벨·품질·아이콘·보석 기록 | 가방·은행 아이템 수집 |
| 게임 규칙, 클라이언트 빌드, 지역 번호 기록 | Battle.net 계정, 비밀번호, 인증 정보, 결제 정보, 이메일, 채팅, 위치 수집 |
| 레벨 상승 시각 기록 | 외부 서버로 데이터 전송 (애드온에는 통신 기능이 없음) |
| 결과를 내 컴퓨터의 SavedVariables 파일에 저장 | 게임 플레이 자동화 |
| 얻지 못한 값은 비워 두고 목록(`unavailable`)에 적음 | 값 추정, 기본값 채우기 |

## 파일 구성

```text
ForeverRankCollector/
├── ForeverRankCollector.toc   애드온 정보 (게임이 가장 먼저 읽는 파일)
├── Core.lua                   버전, 공용 도구, 이벤트, /frc 명령
├── SavedVariables.lua         저장소 (ForeverRankCollectorDB)
├── Collector.lua              내 캐릭터 정보 읽기
├── Export.lua                 Export 파일 내용 만들기 (JSON)
└── README.md                  이 안내
```

## 설치

1. `ForeverRankCollector.zip`의 압축을 풉니다.
2. WoW: Forever 클라이언트 폴더 안의 `Interface\AddOns` 폴더를 엽니다. 없으면 만듭니다.
3. `ForeverRankCollector` 폴더를 통째로 `AddOns` 폴더에 복사합니다.

```text
(WoW: Forever 클라이언트 폴더)
└── Interface
    └── AddOns
        └── ForeverRankCollector
            ├── ForeverRankCollector.toc
            └── ...
```

- 클라이언트 폴더 위치와 이름은 설치 방식에 따라 다릅니다. Battle.net 앱의 게임 설정에서 "탐색기에서 보기"로 찾을 수 있습니다.
- `AddOns` 폴더 바로 아래에 `ForeverRankCollector` 폴더가 있어야 합니다. `ForeverRankCollector\ForeverRankCollector\...`처럼 두 번 겹치면 게임이 읽지 못합니다.
- 캐릭터 선택 화면의 "애드온" 목록에서 Forever Rank Collector를 켭니다. "오래된 애드온"으로 보이면 "오래된 애드온 불러오기"를 켭니다(실제 게임에서 확인 필요).

## 명령

| 명령 | 설명 |
|---|---|
| `/frc` | 도움말과 버전 |
| `/frc export` | 지금 상태로 Export 내용을 갱신하고 요약을 보여 줍니다 |
| `/frc status` | 마지막 Export 요약 (캐릭터, 장비 수, 아이템 레벨 확인 수, 얻지 못한 항목 수) |
| `/frc clear` | 저장된 Export 내용을 지웁니다 |

접속, 레벨 상승, 장비 변경, 길드 변경, 로그아웃 때도 자동으로 갱신합니다. 게임 조작은 하지 않습니다.

## Export 파일

`/frc export` 후 **로그아웃하거나 `/reload`를 입력하면** 게임이 다음 파일에 저장합니다(실제 게임에서 확인 필요).

```text
(WoW: Forever 클라이언트 폴더)\WTF\Account\(계정 폴더)\SavedVariables\ForeverRankCollector.lua
```

- 파일 이름은 애드온 이름을 따라 `ForeverRankCollector.lua`입니다.
- `(계정 폴더)`는 계정마다 다른 이름입니다. 폴더 이름은 다른 사람에게 공유하지 마세요.
- 사이트에는 이 `.lua` 파일을 그대로 올리면 됩니다. 사이트가 파일 안의 `latestExportJson` 값만 읽습니다.
- 파일에는 캐릭터 이름·성·GUID·길드 이름·장비 정보가 들어 있습니다. 계정 정보는 없습니다.

### 알려진 베타 문제

공개 커뮤니티 자료(2026-09)에 "클라이언트가 SavedVariables를 다음 실행 때 다시 읽지 않는다"는 보고가 있습니다.
이 문제가 남아 있으면 파일에는 **마지막 세션의 상태**만 남고, 이전 세션의 레벨 상승 기록은 이어지지 않습니다.
그래서 이 애드온은 세션 단위로 내보내고, 기록 누적은 서버가 맡습니다. 해결 여부는 실제 게임에서 확인 필요입니다.

## 버전

- Collector 버전은 애드온 배포 버전입니다. `/frc` 도움말 첫 줄과 `ForeverRankCollector.toc`의 `## Version`에서 확인합니다.
- Export 형식 버전은 Export 파일 안의 `schemaVersion` 값입니다. 사이트가 지원하지 않는 오래된 형식은 제출할 때 안내 문구와 함께 거부됩니다.
- 사이트의 Collector 다운로드 화면에 최신 버전, 파일 크기, SHA-256이 표시됩니다.

## 개발자용: 게임 밖 검사

저장소의 `addon/` 폴더에서 다음을 실행합니다. `jsonschema`가 설치된 파이썬이 필요합니다.

```bash
PYTHON=python3 ./tests/run.sh
```

- `luac5.1` 문법 검사, `luacheck` 정적 분석
- `tests/collector_harness.lua`로 오프라인 실행 검사(가짜 API). 가짜 API의 값은 실제 WoW: Forever 반환값이 아닙니다.
- 생성된 JSON을 `docs/schemas/character-export-v1.schema.json`으로 스키마 검증

다운로드 ZIP은 저장소 루트에서 `npm run collector:build`로 만듭니다.
