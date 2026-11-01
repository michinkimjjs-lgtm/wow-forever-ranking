# CurseForge에 Forever Rank Collector 등록하기

> 작성: 2026-11-01. CurseForge 공식 안내("Creating and Submitting a Project", 2024-09 수정)와 WoW 애드온 FAQ(2026-07 수정)를 기준으로 정리했습니다. 화면 구성은 바뀔 수 있습니다.

## 0. 먼저 알아 둘 것

- **CurseForge의 WoW: Forever 분류:** 이미 다른 Forever 애드온들이 "Forever" 게임 버전(1.60.1)으로 올라와 있습니다. 우리 애드온의 TOC도 `## Interface: 16001`이라 맞습니다.
- **영어 필수:** 제목·요약·설명은 반드시 **영어**로 써야 합니다. 한국어는 영어 아래에 덧붙일 수 있습니다.
- **로고:** 게임 이미지나 남의 이미지는 쓸 수 없습니다. 사이트 아이콘으로 만든 `docs/curseforge/logo-400.png`를 씁니다.
- **아직 게임에서 실행해 보지 않은 애드온입니다.**
  - 첫 파일은 **Beta**로 올리는 것을 권합니다. Beta는 CurseForge 앱이 기본으로 자동 설치하지 않아, 검증 전 버전이 널리 퍼지지 않습니다.
  - 게임이 열리고 실제 동작을 확인한 뒤 **Release**로 다시 올립니다. 앱 목록에 나오려면 Release 파일이 하나 이상 있어야 합니다.
- **올리는 파일:** `public/downloads/ForeverRankCollector.zip`(빌드할 때 자동 생성)
  - ZIP 맨 위에 `ForeverRankCollector/` 폴더 하나가 있고, 그 안에 TOC·Lua·README가 들어 있습니다(확인 완료).
  - 개발용 진단 애드온 `ForeverRankProbe`는 올리지 않습니다.
- **심사:** 업로드한 파일은 운영팀 검토를 거쳐 공개됩니다. 검토 시간은 매일 한국 시간 오후 4시~밤 11시(CET 오전 8시~오후 3시), 들어온 순서대로입니다. 늦게 올리면 다음 날 검토될 수 있습니다.

## 1. 계정 만들기

1. https://www.curseforge.com 에서 가입하거나 로그인합니다.
2. https://authors.curseforge.com 에 들어가 작성자(Author) 약관에 동의합니다.

## 2. 프로젝트 만들기

1. https://authors.curseforge.com/#/projects/create/choose-game 에서 **World of Warcraft**를 고릅니다.
2. 아래 값을 입력합니다(그대로 붙여 넣을 문구는 §4).

| 칸 | 넣을 값 |
|---|---|
| Name | `Forever Rank Collector` |
| Summary | §4-1 |
| Description | §4-2 (다음 단계 Description 탭) |
| Project License | 권장: `All Rights Reserved` (다른 사람이 고친 판을 재배포하지 못하게). 공개 소스로 하려면 `MIT` |
| Class | `Addons` |
| Main category | `Data Export` (목록에 없으면 `Miscellaneous`) |
| Additional categories | 넣지 않아도 됩니다(관계없는 분류를 넣으면 반려될 수 있음) |
| Logo Image | `docs/curseforge/logo-400.png` |

3. Next → Description 탭에 §4-2를 붙여 넣습니다. → Next → License 탭을 확인합니다.

## 3. 파일 올리기 (이 단계를 마쳐야 심사가 시작됩니다)

프로젝트 대시보드 → **Files** 탭 → 업로드.

| 칸 | 넣을 값 |
|---|---|
| Upload file | `ForeverRankCollector.zip` |
| Display Name | `Forever Rank Collector 1.0.0` |
| Release Type | **Beta** (게임에서 확인 후 Release) |
| Changelog | §4-3 |
| Supported Version | **Forever** 쪽 버전(1.60.1)만 선택. Retail·Classic은 선택하지 않습니다 |
| Related Projects | 없음 |

## 4. 붙여 넣을 문구

### 4-1. Summary

```text
Exports your own character's level and equipped gear to a local file for the Forever Rank community ranking. No network access.
```

### 4-2. Description

```markdown
**Forever Rank Collector** saves information about **your own logged-in character** in WoW: Forever to a local SavedVariables file. You can then upload that file yourself on the Forever Rank website (https://foreverrank.co.kr) to request a listing in the community level and gear rankings.

> **Pre-release:** The Forever Rank website is not accepting submissions yet. This addon was built from the public WoW: Forever client API and UI source and has not been tested in the live game yet. Please report any problems.

## What it records
- Your character's name, in-game character ID (GUID), level, class, race, faction and guild name
- Equipped items: item ID, item level, quality and icon (no bag or bank items)
- Game ruleset, client build and region number
- The time of each level-up while the addon is running

## What it does NOT do
- No network access: the addon cannot send data anywhere. Nothing leaves your computer unless you upload the file yourself.
- Does not inspect or collect other players.
- Does not read account, password, payment, email or chat data.
- Does not automate gameplay.

## Commands
- `/frc export` – update the export with your current character
- `/frc status` – show a summary of the last export
- `/frc clear` – delete the saved export

## Where the file is saved
`WTF\Account\<account>\SavedVariables\ForeverRankCollector.lua` in your WoW: Forever folder (written when you log out or `/reload`).

Forever Rank is an unofficial, non-commercial fan site and is not affiliated with Blizzard Entertainment.

---

**한국어 안내:** 로그인한 내 캐릭터의 레벨·장착 장비 정보를 내 컴퓨터의 파일로 저장하는 애드온입니다. 외부로 데이터를 보내는 기능이 없으며, 저장된 파일을 Forever Rank 사이트에 직접 올려 랭킹 등록을 요청할 수 있습니다(사이트 등록은 아직 준비 중입니다).
```

### 4-3. Changelog (1.0.0)

```text
1.0.0 (pre-release)
- First public build for WoW: Forever (Interface 16001)
- Exports level, class, race, faction, guild and equipped gear (Character Export v1)
- Slash commands: /frc export, /frc status, /frc clear
- Not yet tested in the live game
```

## 5. 심사 뒤

- **승인:** 공개되고 주소가 생깁니다(예: `https://www.curseforge.com/wow/addons/forever-rank-collector`). 이 주소를 사이트의 "랭킹 등록 → Collector 받기" 안내에 함께 적을 수 있습니다.
- **수정 요청·반려:** 이유가 메일과 대시보드로 옵니다. 대부분 설명·로고 문제입니다.
- **새 버전:** TOC의 `## Version`과 `addon/ForeverRankCollector/README.md`의 버전을 올리고(`docs/CONTRIBUTOR-GUIDE.md`의 버전 규칙), 빌드로 ZIP을 다시 만든 뒤 Files 탭에 새 파일로 올립니다. 사이트 다운로드 파일과 CurseForge 파일의 버전을 같게 유지합니다.

## 6. 우리가 정한 것 / 운영자가 고를 것

| 항목 | 정한 값 | 비고 |
|---|---|---|
| 첫 파일 종류 | Beta | 게임 확인 전 |
| 지원 버전 | Forever만 | |
| 라이선스 | All Rights Reserved 권장 | 운영자 선택 |
| 로고 | 사이트 아이콘(금색 별) | 게임 이미지 사용 불가 |
