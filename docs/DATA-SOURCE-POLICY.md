# 데이터 출처 정책

> 단계: Phase 2D (2026-10-07)
>
> 관련 문서:
> - [`COMMUNITY-RANKING-PLAN.md`](./COMMUNITY-RANKING-PLAN.md)
> - [`DATA-COVERAGE-MODEL.md`](./DATA-COVERAGE-MODEL.md)
> - [`BLIZZARD-API-INTEGRATION-PLAN.md`](./BLIZZARD-API-INTEGRATION-PLAN.md)
> - [`STATIC-GAME-DATA.md`](./STATIC-GAME-DATA.md)
>
> 이 문서는 법률 자문이 아닙니다. 외부 약관은 원문을 직접 확인한 뒤에만 "허용"으로 판단합니다.

## 0. 외부 공급원 조사 (2026-10-07)

### 조사 방법과 한계

- 이 작업 환경의 네트워크 정책이 다음 사이트의 직접 접속을 막았습니다.
  - `wowcensus.io`, `foreverdb.net`, `wowforeverarmory.com`, `forever.raider.io`, `raider.io`
- 그래서 **검색 결과 요약**으로만 조사했습니다. 이용 조건 원문은 확인하지 못했습니다.
- GitHub 저장소 2곳은 Phase 2A-OFFLINE에서 직접 확인했습니다([`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md) §1).
- 원문을 확인하려면 환경의 허용 도메인에 위 사이트들을 추가해야 합니다.
- 확인하지 못한 항목은 **"확인 필요"**로 표시합니다. 확인 필요인 공급원은 사용하지 않는 것으로 간주합니다.

### 공급원별 정리

| 항목 | WoWCensus | ForeverDB | WoW Forever Armory | Raider.IO Forever API | Atraeau/WoW-Addons | Thunderz96/forever-addon-kit |
|---|---|---|---|---|---|---|
| 주소 | wowcensus.io | foreverdb.net | wowforeverarmory.com | forever.raider.io/api | github.com/Atraeau/WoW-Addons | github.com/Thunderz96/forever-addon-kit |
| 수집 데이터 | 인구 추적: realm 인구, 진영 비율, 종족/직업 분포 | 게임 데이터베이스: 아이템(약 22,069개)·주문(약 31,731개)·특성 등<br>Helper 업로드: 퀘스트·드롭·상인·보스 전투 기록 | 특성 계산기, 빌드 공유와 빌드 통계 | 확인 필요 (직접 접속 차단) | 클라이언트 API 문서 덤프 (함수·인자·반환값) | 클라이언트 API 덤프, 실측 메모(README) |
| 수집 방식 | 게임 안 `/who` 검색 결과 (검색 요약) | 자체 애드온 + ForeverDB Helper 업로드 | 사용자가 만든 빌드 | 확인 필요 | 클라이언트 `/api` 출력 | 클라이언트 덤프 |
| 캐릭터 데이터 | 집계에 쓰임. 개인 단위 공개 여부 확인 필요 | Armory 스냅샷(이름 포함)은 사용자가 공개하기 전까지 비공개.<br>공유 데이터는 캐릭터를 이름 대신 뒤섞은 코드로 보냄 (검색 요약) | 없음 (빌드만) | 확인 필요 | 없음 | 없음 |
| 장비 데이터 | 확인 필요 | 아이템 DB 있음. 개인 장비는 비공개 Armory | 없음 | 확인 필요 | 없음 (API 이름만) | 없음 |
| 레벨 데이터 | 레벨별 인구 (집계) | 확인 필요 | 레벨별 빌드 경로 (게임 데이터) | 확인 필요 | 없음 | 없음 |
| 개인 / 집계 | **집계** 중심 | 게임 데이터 + 개인 비공개 | 집계 (빌드 통계) | 확인 필요 | 해당 없음 | 해당 없음 |
| 공개 API | 발견 못 함 | 발견 못 함 | 발견 못 함 | 있음 (이름 그대로 API) | 정적 문서 | 정적 JSON |
| 이용 조건 | 확인 필요 | 확인 필요 | 확인 필요 | **경쟁 서비스 구축 금지** (사용자 제공 정보).<br>Raider.IO 일반 이용약관도 경쟁 목적·무단 상업 이용 금지, 자동 수집은 공개 API로만 허용 (검색 요약) | 저장소 루트에 라이선스 없음 | MIT |
| 재배포 | 확인 필요 → 불가로 간주 | 확인 필요 → 불가로 간주 | 확인 필요 → 불가로 간주 | 불가 | 코드·문서 재배포 불가로 간주. API 이름 같은 사실 정보만 참조 | MIT 조건(저작권 고지)으로 가능. 우리는 코드를 복사하지 않음 |
| 경쟁 서비스에서 사용 | 사용 안 함 | 사용 안 함 | 사용 안 함 | **사용 금지** | 사실 정보 참조만 | 사실 정보 참조만 |
| attribution | 확인 필요 | 확인 필요 | 확인 필요 | 해당 없음 (사용 안 함) | 참조 출처를 문서에 표기 | 참조 출처를 문서에 표기 (MIT 고지는 코드 재사용 시) |

참고:

- Forever용 `/who` 기반 census 애드온이 CurseForge에 여러 개 있습니다(Forever Census, Forever Class Census 등).
  - `/who`는 **다른 플레이어**의 정보를 모읍니다.
  - 우리 Collector는 다른 플레이어 데이터를 수집하지 않으므로 이 방식을 쓰지 않습니다.
- 검색 결과에는 WoW Census 관련 설명(CensusPlus 애드온, "30일 내 활동한 10레벨 이상")도 나왔습니다.
  - 이것은 예전 WarcraftRealms 시절 서비스 설명일 수 있습니다.
  - wowcensus.io의 현재 정책으로 단정하지 않습니다.
- WoW Forever Armory(wowforeverarmory.com)는 특성 계산기입니다. 비슷한 이름의 Armory WoW Forever(armorywowforever.com)는 "Blizzard가 API 접근을 허용하면 출시"한다고 안내합니다.
  - 공식 API가 없다는 점에서 우리 조사 결과(FOREVER-API-CAPABILITY §2-9)와 같습니다.

출처(검색 결과):

- [WoWCensus](https://wowcensus.io/), [Forever Census (CurseForge)](https://www.curseforge.com/wow/addons/forever-census), [Forever Class Census (CurseForge)](https://www.curseforge.com/wow/addons/forever-class-census)
- [ForeverDB](https://foreverdb.net/), [ForeverDB Helper](https://foreverdb.net/helper), [ForeverDB addon](https://foreverdb.net/addons)
- [WoW Forever Armory](https://wowforeverarmory.com/), [stats](https://wowforeverarmory.com/stats), [Armory WoW Forever](https://armorywowforever.com/)
- [Raider.IO Terms of Use](https://raider.io/terms-of-use), [Raider.IO Developer API (classic)](https://classic.raider.io/api)
- [Atraeau/WoW-Addons](https://github.com/Atraeau/WoW-Addons), [Thunderz96/forever-addon-kit](https://github.com/Thunderz96/forever-addon-kit)

## 1. 허용 데이터 출처

| 출처 | 조건 | dataSource | 검증 상태 |
|---|---|---|---|
| Blizzard 공식 API (공개되면) | 공식 문서·약관 확인 후 ([`BLIZZARD-API-INTEGRATION-PLAN.md`](./BLIZZARD-API-INTEGRATION-PLAN.md)) | `blizzard` | 정책 결정 필요. 출처만으로 `VERIFIED` 아님 |
| 사용자 본인 캐릭터의 Collector export | 사용자가 직접 실행하고 직접 제출. 동의 화면 필수 | `user_submission` / `addon` | `COMMUNITY_SUBMITTED` |
| 정적 게임 데이터셋 | 이용 조건 URL·확인 날짜가 있는 `PERMITTED` 데이터셋만 ([`STATIC-GAME-DATA.md`](./STATIC-GAME-DATA.md)) | 데이터셋 `source` | 해당 없음 |
| 공개 API 문서의 사실 정보 | 함수 이름·시그니처 같은 사실만 참조. 코드·문서 복사 금지 | 해당 없음 | 해당 없음 |
| mock | 개발 전용 DB | `mock` | `MOCK` |

## 2. 금지 데이터 출처

- 제3자 랭킹·Armory·census 서비스의 데이터 (Raider.IO, WoWCensus, ForeverDB, 기타)
  - 이용 조건이 허용한다고 원문으로 확인되기 전까지 금지
  - Raider.IO Forever API는 경쟁 서비스 구축 금지 조건 때문에 **핵심 공급원으로 영구 제외**
- 웹페이지 scraping으로 얻은 데이터 (§4)
- 다른 플레이어를 대상으로 한 `/who`, inspect, 채팅 로그 수집
- 계정 정보, 비밀번호, 결제 정보
- 출처를 밝힐 수 없는 데이터 (출처 불명 CSV 등)

## 3. 외부 API 사용 기준

외부 API를 쓰려면 다음을 **모두** 만족해야 합니다.

1. 이용약관 원문을 직접 읽고 확인한 날짜와 URL을 기록했다.
2. 경쟁 서비스·랭킹 서비스 구축을 금지하지 않는다.
3. 우리 용도(저장, 캐시 기간, 화면 표시, 상업적 이용)를 허용한다.
4. 요구하는 attribution을 지킬 수 있다.
5. 호출 한도를 지킬 수 있다.
6. 그 API가 사라져도 사이트가 동작한다. 특정 외부 API를 핵심 공급원으로 고정하지 않는다.

하나라도 불확실하면 쓰지 않습니다.

## 4. scraping 금지

- 외부 사이트의 HTML·내부 API·검색 결과를 자동으로 읽어 데이터로 쓰지 않습니다.
- `robots.txt`가 허용하거나 페이지가 공개되어 있다는 이유만으로 재사용 권한이 있다고 가정하지 않습니다.
- 사람이 직접 확인하는 조사(약관 읽기, 기능 비교)는 허용합니다. 그 결과를 데이터로 저장하지는 않습니다.

## 5. attribution

- 정적 데이터셋은 `static_datasets.attribution`에 공급원이 요구하는 문구를 저장합니다.
- 화면 표시 위치(아이템 화면, 푸터)는 P1에서 만듭니다. attribution을 표시할 수 없으면 그 데이터를 쓰지 않습니다.
- 공식 API 데이터는 Blizzard가 요구하는 문구를 따릅니다(확인 필요).
- 참조한 공개 자료(API 문서 덤프 등)는 문서에 출처를 적습니다.

## 6. 데이터 재배포

- 우리 DB의 데이터를 제3자에게 대량으로 제공(덤프, bulk API)하지 않습니다. 원 공급원의 조건과 개인정보 문제 때문입니다.
- 공개 API(`/api/v1/*`)는 화면과 같은 범위의 데이터만, 페이지 단위로 제공합니다.
- 외부에서 받은 데이터는 원 공급원 조건보다 넓게 재배포하지 않습니다.

## 7. 사용자 제출 데이터

- **본인 캐릭터만** 제출합니다. Collector는 플레이어 자신(`"player"`)의 정보만 읽습니다.
- 애드온은 인터넷 통신을 하지 않습니다. 제출은 사용자가 웹 화면 또는 별도 Uploader로 직접 합니다.
- 제출 전 동의 화면에 표시할 내용:
  - 저장하는 항목
  - 공개되는 항목
  - 보존 기간
  - 삭제 방법
- 제출 데이터는 항상 `COMMUNITY_SUBMITTED`로 저장합니다. 순위·평균 장비 레벨은 서버가 다시 계산합니다.
- 원본 export는 `ingestion_records`에 보관해 다시 처리할 수 있게 합니다.
- 제출자 식별: 계정을 만들지 않고, Uploader 설치마다 임의로 만든 익명 키를 쓰는 방식을 검토합니다(P1).
  - 같은 제출자가 여러 번 보낸 데이터를 독립 동의로 세지 않기 위해서입니다([`COMMUNITY-RANKING-PLAN.md`](./COMMUNITY-RANKING-PLAN.md) §7).

## 8. 삭제 요청

- 캐릭터 소유자는 공개 표시 중단을 요청할 수 있습니다.
- 소유 확인 방법(확인 필요): 게임 안에서 Collector로 일회용 코드를 포함한 export를 다시 제출하는 방식을 검토합니다.
- 처리:
  - 화면·API에서 숨깁니다.
  - 원본 payload를 삭제하거나 익명화합니다.
  - 순위는 다시 계산합니다.
- 현재 스키마에는 숨김 플래그가 없습니다. 실제 제출을 받기 전(P1)에 기존 테이블을 다시 설계하지 않고 별도 테이블로 추가합니다.

## 9. 개인정보

- 저장: 공개 캐릭터 정보(이름, 레벨, 직업, 종족, 진영, 길드, 장착 장비), 게임 GUID, 관측 시각
- 저장하지 않음: 계정 이름, BattleTag, 이메일, 비밀번호, IP 주소의 장기 보관, SavedVariables 폴더 경로(계정 이름이 들어 있음)
- Forever는 성(surname)을 게임 안에서 숨길 수 있습니다.
  - 숨긴 성을 사이트에 표시해도 되는지는 **확인 필요**입니다.
  - 확인 전에는 제출자가 공개에 동의한 이름만 표시합니다.
- 요청 로그의 IP는 rate limit 용도로만 짧게 보관합니다(P1에서 기간 결정).

## 10. 검증 상태

| 코드 | 화면 | 부여 조건 |
|---|---|---|
| `VERIFIED` | 검증됨 | 공식 공급원으로 확인. 기준은 공식 API 단계에서 명세서 §11에 확정 |
| `LOG_VERIFIED` | 로그 검증 | 전투 로그 등으로 확인 (향후) |
| `COMMUNITY_SUBMITTED` | 커뮤니티 제출 | 사용자·애드온 제출 (기본) |
| `UNVERIFIED` | 미검증 | 출처를 확인할 수 없음 |
| `MOCK` | 테스트 데이터 | mock 전용 |

- 데이터 출처만으로 `VERIFIED`가 되지 않습니다.
- 여러 사람이 같은 값을 제출해도 검증 상태는 그대로입니다. "독립 제출 일치" 정보는 따로 표시합니다.
- 화면의 출처 구분은 검증 상태와 별개입니다.
  - 공식: `blizzard`
  - 커뮤니티 제출: `addon`, `user_submission`
  - 테스트 데이터: `mock`

## 11. 데이터 보존 기간

| 데이터 | 보존 |
|---|---|
| 캐릭터, 장비, 스냅샷, milestone | 삭제하지 않음 (랭킹 제외는 7일 기준). 삭제 요청은 §8 |
| 원본 payload (`ingestion_records`) | 재처리를 위해 보관. 기간은 실제 제출 시작 전 결정 (확인 필요) |
| 정적 데이터셋 | 버전별 영구 보관 (실제 영역은 삭제 금지) |
| 요청 로그 / IP | rate limit 용도로 단기 보관 (P1에서 결정) |
| mock 데이터 | 개발 중 언제든 초기화 |
