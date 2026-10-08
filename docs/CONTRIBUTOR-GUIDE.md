# Contributor 흐름 — 내 캐릭터 랭킹 등록 (Phase 4A)

> 단계: Phase 4A (2026-10-08)
>
> 목표: 처음 온 WoW: Forever 플레이어가 "무엇을 하면 내 캐릭터를 랭킹에 등록할 수 있는지" 3분 안에 이해하고, Collector 다운로드부터 파일 제출까지 끝낼 수 있게 한다.
>
> 관련 문서:
> - `docs/SUBMISSION-SYSTEM.md` (제출 처리)
> - `docs/CHARACTER-EXPORT-V1.md` (Export 형식)
> - `docs/PRIVACY-DATA-POLICY.md` (개인정보)
> - `docs/ADMIN-REVIEW.md` (관리자 검토)
> - `addon/ForeverRankCollector/README.md` (ZIP에 들어가는 사용자 안내)

이번 단계의 원칙:

- 사용자가 게임에 접속하지 않아도 사이트의 안내 흐름은 끝까지 동작한다.
- 실제 게임 데이터나 Blizzard API는 쓰지 않는다.
- 실제 게임에서 확인하지 못한 동작은 화면에 **"실제 게임에서 확인 필요"**로 표시한다.

## 1. 화면 흐름

```text
/contribute                 내 캐릭터 랭킹 등록 (5단계 개요, 현재 랭킹 기준, 용어 설명)
  ↓
/contribute/download        Forever Rank Collector (버전, Export 형식 버전, 파일 크기, SHA-256, 수집 범위)
  ↓
/contribute/install         설치 방법 10단계
  ↓
/contribute/how-to-use      게임 내 명령어, Export 파일 위치와 이름 규칙
  ↓
/submit                     제출 전에 확인하세요 → 파일 선택 → 미리보기 → 동의 → 제출
```

- 모든 안내 화면과 `/submit`에 같은 단계 버튼이 있습니다.
  - 버튼: [Collector 다운로드] [설치 방법] [사용 방법] [캐릭터 데이터 제출]
  - 구현: `components/contribute/contribute-nav.tsx`
  - 모바일에서는 2열, 넓은 화면에서는 4열입니다. 버튼 높이는 44px 이상입니다.
- 화면 아래에 이전 / 다음 단계 버튼이 있습니다.
- 랭킹 등록 안내로 가는 입구:
  - 머리글 메뉴 "랭킹 등록"
  - 홈의 "내 캐릭터 랭킹 등록" 카드
  - 바닥글
  - 준비 중 화면
  - `/submit`의 "랭킹 등록 안내 보기"
- 현재 랭킹 기준은 "Forever Rank가 확인한 캐릭터 기준"으로 표시합니다(`RankingBasisNotice`).
  - "전체 서버" 표현은 쓰지 않습니다(`docs/COMMUNITY-RANKING-PLAN.md`).
- 문구는 모두 `locales/ko/contribute.ts`에 있습니다.
  - 어려운 용어(애드온, Export 파일, SavedVariables, `/reload`, 게임 규칙, GUID)에는 짧은 설명을 붙였습니다.

## 2. Collector 다운로드 파일

| 항목 | 값 |
|---|---|
| Collector 버전 | `1.0.0` |
| Export 형식 버전 | `1` |
| 다운로드 경로 | `/downloads/ForeverRankCollector.zip` |
| 설정 | `config/collector.ts` |
| 생성 스크립트 | `scripts/build-collector.ts` (`npm run collector:build`) |
| 배포 정보 | `lib/collector/release-manifest.json` (자동 생성, 손으로 고치지 않음) |

ZIP 구성:

```text
ForeverRankCollector/
  ForeverRankCollector.toc
  Core.lua
  SavedVariables.lua
  Collector.lua
  Export.lua
  README.md
```

생성 규칙:

- 자동 생성
  - `npm run dev`와 `npm run build` 전에 `predev` / `prebuild`가 ZIP과 manifest를 다시 만듭니다.
  - ZIP(`public/downloads/`)은 생성물이라 저장소에 넣지 않습니다(`.gitignore`).
  - manifest는 저장소에 넣습니다.
  - 테스트가 "애드온 원본으로 새로 만든 manifest = 저장된 manifest"를 확인합니다. 애드온을 고치고 manifest를 갱신하지 않으면 테스트가 실패합니다.
  - CI에서 확인만 하려면 `npm run collector:check`를 씁니다.
- 고정된 결과(SHA-256)
  - 압축하지 않는 STORE 방식 ZIP을 직접 만듭니다(`lib/collector/zip.ts`, 외부 라이브러리 없음).
  - 파일 시각은 설정의 배포 날짜로 고정합니다.
  - 줄바꿈은 LF로 통일합니다(`.gitattributes`의 `addon/** text eol=lf`).
  - 그래서 같은 원본이면 항상 같은 바이트와 SHA-256이 나옵니다.
- 보안
  - 원본 폴더의 파일이 설정 목록과 정확히 같아야 합니다.
  - 확장자는 `.toc` / `.lua` / `.md`만 허용합니다. 실행 파일(.exe)은 넣지 않고 만들지도 않습니다.
  - 다른 파일이 섞이면 빌드가 실패합니다.
- 버전 검사
  - 다음 값이 설정과 다르면 빌드가 실패합니다.
    - TOC의 `## Version`
    - `Core.lua`의 `ns.VERSION` / `ns.EXPORT_SCHEMA_VERSION` / `ns.EXPORT_SCHEMA`
    - `README.md`의 버전 표기
  - TOC가 불러오는 Lua 파일 목록과 ZIP의 Lua 파일 목록이 다를 때도 실패합니다.
- 다운로드 화면 표시
  - Collector 버전, Export 형식 버전, 지원 클라이언트, 애드온 인터페이스 번호(실제 게임에서 확인 필요)
  - 파일 이름, 파일 크기, SHA-256, 배포 날짜, ZIP 안 파일 목록
  - SHA-256 확인 명령(윈도우): `certutil -hashfile ForeverRankCollector.zip SHA256`
  - "이 파일은 WoW: Forever 애드온입니다." 안내
  - ZIP 파일이 아직 없으면(빌드 전) 버튼 대신 준비 중 안내

### 애드온 파일 구성 변경 (Phase 4A)

| 파일 | 내용 |
|---|---|
| `Core.lua` | 버전(`VERSION`, `EXPORT_SCHEMA`, `EXPORT_SCHEMA_VERSION`), 공용 도구, 이벤트, `/frc` 명령 |
| `SavedVariables.lua` | 저장소(`ForeverRankCollectorDB`) 준비·초기화. 저장소 형식 버전 `FORMAT_VERSION`은 Export 형식 버전과 별개 |
| `Collector.lua` | 내 캐릭터 정보 수집 (클라이언트, 게임 규칙, 캐릭터, 장비, 레벨 상승) |
| `Export.lua` | JSON 인코더(이전 `Json.lua`)와 Export 조립 / 갱신 / 요약 출력 |

- 수집 동작과 Export 형식은 바뀌지 않았습니다.
  - 오프라인 하네스(`addon/tests/run.sh`)와 JSON Schema 검증을 그대로 통과합니다.
- `/frc` 도움말 첫 줄에 Collector 버전과 Export 형식 버전을 보여 줍니다.
- 명령어는 새로 만들지 않았습니다: `/frc`, `/frc export`, `/frc status`, `/frc clear`.

## 3. 설치 안내 (`/contribute/install`)

1. ZIP 다운로드
2. 압축 해제
3. WoW Forever AddOns 폴더 열기 — 실제 게임에서 확인 필요
4. ForeverRankCollector 폴더 복사
5. 게임 실행
6. 애드온 활성화 — 실제 게임에서 확인 필요
7. 캐릭터 접속
8. Export 명령 실행 — 실제 게임에서 확인 필요
9. 생성된 파일 확인 — 실제 게임에서 확인 필요
10. 사이트에서 업로드

- 경로는 `(WoW: Forever 클라이언트 폴더)\Interface\AddOns\...` 같은 **예시**로만 보여 줍니다.
  - "사용자의 설치 방식에 맞게 바꿔서 찾으세요"를 함께 안내합니다.
- 특정 클라이언트 폴더 이름(`_classic_beta_` 등)이나 드라이브 경로는 하드코딩하지 않습니다(테스트로 확인).
- 폴더가 두 번 겹친 경우, 애드온이 꺼진 경우, 파일이 생기지 않는 경우를 "잘 안 될 때"로 안내합니다.

## 4. 사용 방법 (`/contribute/how-to-use`)

| 명령어 | 설명 |
|---|---|
| `/frc` | 도움말과 Collector 버전 |
| `/frc export` | 지금 상태로 Export 내용을 만들고 요약 표시 |
| `/frc status` | 마지막 Export 요약 |
| `/frc clear` | 저장된 Export 내용 삭제 |

- 테스트가 확인하는 것:
  - 안내하는 명령어는 `Core.lua`의 슬래시 명령 처리에 실제로 있는 것뿐이다.
  - 다른 안내 문구에도 없는 `/frc` 명령어가 없다.
- Export 파일
  - 위치: `(WoW: Forever 클라이언트 폴더)\WTF\Account\(계정 폴더)\SavedVariables\ForeverRankCollector.lua`
  - 파일 이름은 애드온 이름을 따라 항상 `ForeverRankCollector.lua`입니다.
  - 마지막으로 접속한 캐릭터의 내용으로 바뀌므로 캐릭터마다 따로 제출합니다.
  - `.lua` 파일을 그대로 올리거나, Export 내용만 꺼낸 `.json` 파일을 올릴 수 있습니다.
- 저장 시점(`/reload`, 로그아웃)과 파일 위치는 공개 자료 기준이며 "실제 게임에서 확인 필요"로 표시합니다.
- 알려진 베타 문제(SavedVariables를 다시 읽지 않는 문제)를 함께 안내합니다.

## 5. 버전 관리

| 구분 | 현재 값 | 어디에 있나 | 뜻 |
|---|---|---|---|
| Collector 버전 | `1.0.0` | `config/collector.ts`, TOC `## Version`, `Core.lua` `ns.VERSION`, README, manifest | 애드온 배포 버전. 애드온을 고치면 올린다 |
| Export 형식 버전 | `1` | `config/collector.ts`, `Core.lua` `ns.EXPORT_SCHEMA_VERSION`, Export 파일 `schemaVersion`, JSON Schema | 파일 형식 번호. 서버가 읽을 수 있는지 판단 |
| 저장소 형식 버전 | `1` | `SavedVariables.lua` `ns.FORMAT_VERSION` | 애드온 내부 저장소 구조. 사이트와 무관 |

- 서버는 **Export 형식 버전만으로** 파일을 받을지 정합니다.
  - 받는 버전: `supportedExportSchemaVersions`, 현재 `[1]`
  - 같은 형식이면 Collector 버전이 달라도 받습니다. 예: 이전 Collector `0.1.0`이 만든 파일도 형식 `1`이라 받습니다.
- 지원하지 않는 버전은 형식 검증보다 먼저 확인합니다(`lib/submissions/export-version.ts`).
  - 브라우저(파일 선택 직후)와 서버(`submitCharacterExport`, `processMockCharacterExport`) 모두 같은 함수를 씁니다.

| 경우 | 오류 코드 | 화면 문구 |
|---|---|---|
| 지원하는 버전보다 오래됨 | `EXPORT_SCHEMA_OUTDATED` | "지원하지 않는 오래된 Export 형식(버전 0)입니다. 최신 Collector 1.0.0(Export 형식 1)를 받아 Export 파일을 다시 만들어 주세요." |
| 지원하는 버전보다 새로움 | `EXPORT_SCHEMA_TOO_NEW` | "아직 지원하지 않는 새 Export 형식(버전 2)입니다. …" |

- API는 400 `VALIDATION_FAILED`로 응답하고, `issues[].message`에 한국어 문구를 담습니다.
- Export 형식을 바꿀 때:
  1. 새 형식 문서를 씁니다(`docs/CHARACTER-EXPORT-V2.md` 등).
  2. 서버 파서를 추가합니다.
  3. `supportedExportSchemaVersions`에 추가합니다.
  4. 애드온 `ns.EXPORT_SCHEMA_VERSION`을 올립니다.
  5. Collector 버전을 올립니다.
  6. `npm run collector:build`를 실행합니다.
  - 이전 형식 지원을 끝낼 때는 목록에서 빼면 됩니다. 그러면 "오래된 형식" 안내가 나갑니다.

## 6. 실제 데이터가 없는 상태의 흐름 확인

- mock 배포(테스트 데이터 환경)의 `/contribute/how-to-use`에 "테스트용 예시 파일 받기"가 보입니다.
  - 경로: `GET /contribute/test-export`
- 예시 파일의 내용:
  - 테스트 fixture `01-valid-character`와 같은 가짜 데이터입니다(`lib/collector/test-export.template.json`).
  - 관측 시각만 요청 시각 기준으로 바꿉니다.
  - `collector.version`은 `1.0.0-mock-fixture`(mock fixture 표식)입니다.
- mock 배포의 `/submit`은 예시 파일을 **검증만** 합니다.
  - 응답의 검증 상태는 `MOCK`(테스트 데이터)이고 `testFixture: true`입니다.
  - 저장하지 않습니다. 저장 요청은 mock 배포에서 원래 거부됩니다.
- fixture는 절대 `COMMUNITY_SUBMITTED` / `VERIFIED`가 되지 않습니다.
  - beta / live 배포는 예시 파일을 내려 주지 않습니다(404).
  - beta / live는 검증 전용 제출이어도 `MOCK_FIXTURE_REJECTED`로 거부합니다.
  - 브라우저도 파일 선택 단계에서 "테스트용 데이터 파일은 제출할 수 없습니다"를 보여 줍니다.
  - fixture 허용(`allowMockFixture`)은 `dryRun`이고 DB가 없을 때만 쓰입니다. 저장 단계에 fixture가 오면 예외로 멈춥니다.
- 오래된 형식 fixture `13-outdated-schema-version.json`을 추가했습니다(`EXPORT_SCHEMA_OUTDATED`).

## 7. 제출 전 확인 (`/submit`)

파일 선택 영역 **위에** "제출 전에 확인하세요"를 표시합니다.

- 본인 캐릭터 데이터만 제출
- 계정 정보 제출 금지
- 비밀번호 제출 금지
- 개인정보 포함 여부 확인 (미리보기로 확인 가능)
- 제출 데이터는 커뮤니티 랭킹에 사용될 수 있음
- 삭제 요청 방법 (제출 번호 보관, 창구는 정식 공개 전에 안내)

## 8. 관리자 화면 (`/admin/submissions`)

- 표에 "제출 경로 · 데이터 출처" 열을 추가했습니다.
  - 공개 제출 화면에서 올린 파일: **웹 업로드** · **커뮤니티 제출**
- 상세 보기에는 다음을 표시합니다.
  - 제출 경로, 데이터 출처, 검토 상태(예: 검토 대기)
  - Collector 버전, Export 형식 버전
  - 이 두 값은 Phase 4A부터 제출 요약(`summary`)에 저장합니다. 이전 기록은 "-"로 보입니다.

## 9. SEO

| 경로 | title |
|---|---|
| `/` | WoW 포에버 랭킹 \| Forever Rank |
| `/contribute` | 내 캐릭터 랭킹 등록 \| Forever Rank |
| `/contribute/download` | Forever Rank Collector 다운로드 \| Forever Rank |
| `/contribute/install` | Collector 설치 방법 \| Forever Rank |
| `/contribute/how-to-use` | Collector 사용 방법 \| Forever Rank |
| `/submit` | 캐릭터 데이터 제출 \| Forever Rank |

- 모든 페이지에 한국어 description, canonical, Open Graph(`ko_KR`)를 넣습니다.
- 테스트 데이터 배포(mock)를 실제 랭킹으로 오해하지 않게 하는 장치:
  - 제목 앞에 `[테스트 데이터]`를 붙입니다.
  - 설명 앞에 "테스트 데이터 화면입니다. 실제 WoW 포에버 랭킹이 아닙니다."를 붙입니다.
  - `noindex, nofollow`를 넣습니다.
  - `robots.txt`가 전체 경로를 막습니다.
- 실제 배포의 `robots.txt`는 `/admin`, `/api/`, `/contribute/test-export`만 막습니다.

## 10. 실제 게임에서 확인이 필요한 항목

| 항목 | 화면 표시 |
|---|---|
| 애드온 인터페이스 번호(`## Interface: 16001`)가 정식 클라이언트와 맞는지 | 다운로드 화면 |
| 클라이언트 폴더와 `Interface\AddOns` 위치, Battle.net 앱의 "탐색기에서 보기" | 설치 3단계 |
| 캐릭터 선택 화면의 애드온 목록, "오래된 애드온 불러오기" 표시 | 설치 6단계 |
| `/frc export` 실행 결과와 요약 출력 | 설치 8단계, 사용 방법 |
| `/reload` / 로그아웃 때 SavedVariables 저장, 파일 위치와 이름 | 설치 9단계, 사용 방법 |
| SavedVariables를 다시 읽지 않는 베타 문제 해결 여부 | 사용 방법 |
| 클라이언트가 Lua 문자열(`latestExportJson`)을 저장하는 이스케이프 방식 | (서버 파서, `docs/CHARACTER-EXPORT-V1.md`) |
