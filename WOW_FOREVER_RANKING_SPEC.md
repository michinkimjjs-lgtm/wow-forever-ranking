# WoW 포에버 랭킹 사이트 — 기획서 / 아키텍처 / 데이터 명세서

## 문서 정보

- 문서 버전: v2 (설계 확정본)
- 확정일: 2026-10-06
- 개발 규칙 요약: `CLAUDE.md`
- 이 문서와 `CLAUDE.md`가 충돌하면 **이 문서의 상세 규칙**을 따르고, 두 문서를 함께 수정한다.

### v2 주요 변경

- `environment` 개념을 `dataEnvironment`(mock / beta / live)와 `dataSource`(mock / blizzard / addon / user_submission)로 분리
- Mock 데이터 운영 유입 방지 안전장치(다중 방어) 추가
- 캐릭터 식별 규칙 확정(내부 UUID + 외부 ID 매핑 + 자연 키). Realm은 필수값으로 가정하지 않음
- `level_milestones` 테이블 추가. 실제 달성 시각과 최초 관측 시각을 구분
- 장비 슬롯 구성(Gear Profile)을 설정으로 분리. 미확정 규칙은 운영 데이터에 적용하지 않음
- 오래된 데이터 정책(기본 7일) 추가
- 검증 상태 코드와 한국어 표기 통일
- 시간 표시 형식 통일: `2026년 10월 6일 오후 3:42`
- 장비 랭킹 동점 규칙 추가, 모든 랭킹에 최종 결정 기준 추가
- 던전 / 공격대 / First 기록 / PvP 확장 테이블의 공통 필드 규칙 정리
- 실제 WoW: Forever 데이터로 확인이 필요한 항목 목록 추가

---

## 문서 목적

이 문서는 **월드 오브 워크래프트: 포에버(WoW: Forever)** 전용 랭킹·Armory 웹서비스의 개발 기준을 정의한다.

이 사이트의 기본 사용자와 화면 언어는 **한국어**다.

서비스 목표:

- 현재 최고 레벨 캐릭터 랭킹
- 장착 평균 아이템 레벨 랭킹
- 최고 단일 장착 아이템 랭킹
- 캐릭터 Armory
- 길드 정보
- 성장 이력
- 향후 던전/공격대 클리어 타임
- World First 기록

핵심 원칙:

1. 외부 데이터 공급원 하나에 웹앱이 직접 결합되지 않는다.
2. Mock 데이터와 실제 데이터는 **어떤 쿼리에서도** 섞이지 않는다.
3. 모든 주요 랭킹에 데이터 최신 시각을 표시한다.
4. 랭킹 규칙은 코드에 숨기지 않고 문서화한다.
5. 향후 던전/공격대/로그 데이터가 추가되어도 기존 테이블을 다시 설계하지 않는다.
6. 사용자에게 노출되는 사이트 UI는 한국어를 기본 언어로 한다.
7. 영어 지원은 향후 추가할 수 있는 다국어 구조로 설계한다.
8. **확인되지 않은 게임 구조나 API를 임의로 만들어내지 않는다.** 미확인 사항은 설정값이나 "확인 필요" 항목으로 남긴다(§30).
9. 순위는 항상 서버가 계산한다. 클라이언트가 보낸 순위 값은 신뢰하지 않는다.

---

# 1. 제품 포지셔닝

서비스 정의:

> WoW: Forever의 성장, 장비, 캐릭터, 던전, 공격대 기록을 추적하는 독립 랭킹/Armory 플랫폼

참고 서비스:

- Raider.IO — 랭킹 및 필터 UI 참고
- WOWF.IO — WoW: Forever 콘텐츠 구조 참고
- WoW Forever Armory 계열 서비스 — Armory 구성 참고
- Classic Armory 계열 사이트 — 캐릭터/길드 탐색 UX 참고

단순 복제는 하지 않는다.

### 핵심 차별화

- WoW: Forever 전용
- 최초 레벨 달성 기록
- 장비 성장 그래프
- 데이터 갱신 시각
- 직업 / 진영 / 길드별 세분화
- 향후 던전/공격대 World First

---

# 2. 데이터 확보 전략

WoW: Forever는 베타 단계에서 클라이언트와 애드온 환경이 빠르게 변할 수 있다. 따라서 특정 웹 API가 항상 존재한다고 가정하지 않는다.

데이터 공급원(`dataSource`)은 다음 네 가지로 고정한다.

| dataSource | 설명 | 상태 |
|---|---|---|
| `mock` | 개발용 테스트 데이터 | 현재 사용 |
| `blizzard` | Blizzard 공식 웹/API | **존재 여부 미확인.** 제공되면 우선 검토 |
| `addon` | 사용자 동의 기반 Companion Addon이 만든 데이터 | P1. 애드온 API 범위 미확인 |
| `user_submission` | 사용자가 웹 폼 등으로 직접 제출한 데이터 | P1 |

규칙:

- 존재가 확인되지 않은 API 엔드포인트는 구현하지 않는다. `BlizzardProvider`는 인터페이스 자리만 두고, 호출하면 "미구성" 오류를 반환한다.
- 장기적으로 전체 랭킹을 만들려면 **데이터 발견과 수집 문제**를 별도로 해결해야 한다.
- `addon`/`user_submission` 데이터만으로 만든 랭킹은 "제출된 캐릭터 기준" 랭킹이다. 화면에 이 사실을 안내한다(§18).

---

# 3. MVP 범위

## P0 — 반드시 구현

1. 홈
2. 레벨 랭킹
3. 장비 랭킹
4. 최고 단일 아이템 랭킹
5. 캐릭터 검색
6. 캐릭터 상세 Armory
7. 길드 기본 정보
8. 데이터 최신 시각
9. Mock 데이터 기반 개발과 운영 유입 방지 안전장치
10. Provider 추상화
11. `character_snapshots`, `level_milestones` 저장(그래프 UI는 P1)

## P1 — 출시 전후 우선 구현

1. 사용자 캐릭터 제출
2. Forever Companion Addon 데이터 수집 구조
3. 실제 데이터 검증
4. 직업/진영/길드 필터 고도화
5. 레벨 달성 이력 화면
6. 장비 변화 이력 화면(레벨/장비 성장 그래프)
7. 통계 대시보드
8. Redis 캐시와 BullMQ 작업 큐 도입

## P2 — 콘텐츠 확장

1. 던전 클리어 타임
2. 파티 구성
3. 보스 처치
4. 공격대 클리어 타임
5. World First
6. Class First / Faction First / Guild First
7. PvP 랭킹

---

# 4. 사이트 정보 구조

```text
홈
│
├─ 랭킹
│  ├─ 레벨 랭킹
│  ├─ 장비 랭킹
│  ├─ 최고 아이템
│  ├─ 직업별 랭킹
│  ├─ 진영별 랭킹
│  └─ 길드별 랭킹
│
├─ 캐릭터
│  ├─ 캐릭터 검색
│  └─ 캐릭터 상세
│
├─ 길드
│  └─ 길드 상세
│
├─ 던전
│  ├─ 클리어 랭킹
│  └─ 기록 상세
│
├─ 공격대
│  ├─ 클리어 랭킹
│  ├─ 보스 기록
│  └─ World First
│
└─ 통계
   ├─ 캐릭터 분포
   ├─ 레벨 분포
   ├─ 장비 분포
   └─ 성장 통계
```

MVP에서는 **던전 / 공격대 메뉴를 "준비 중" 상태**로 둔다.

직업별/진영별/길드별 랭킹은 별도 랭킹이 아니라 기본 랭킹에 필터를 적용한 화면이다.

---

# 5. 홈 화면 설계

## 상단 KPI

- 현재 최고 레벨
- 최고 평균 장비 레벨
- 최고 단일 아이템 레벨
- 추적 캐릭터 수(전체)와 랭킹 대상 캐릭터 수(최근 확인)
- 최근 데이터 갱신 시각

KPI는 현재 배포의 `dataEnvironment` 안에서, 랭킹 대상 조건(§10)을 만족하는 캐릭터로만 계산한다.

## 핵심 카드

- 최고 레벨 Top 10
- 최고 장비 Top 10
- 최고 아이템 Top 10
- 최근 업데이트된 캐릭터
- 최근 레벨 상승 캐릭터(`level_milestones` 기준)

### 사용자에게 보여줄 한국어 문구 예시

```text
현재 최고 레벨
최고 장비 레벨
최고 아이템
추적 캐릭터
랭킹 대상 캐릭터
최근 데이터 갱신
전체 랭킹 보기
```

Mock 환경에서는 모든 페이지 상단에 다음 안내를 **항상** 표시한다. 이 안내는 끌 수 없다.

```text
베타 테스트 데이터
현재는 테스트 데이터가 표시되고 있습니다.
```

---

# 6. 데이터 환경 분리

## 6.1 용어

| 필드 | 값 | 의미 |
|---|---|---|
| `dataEnvironment` | `mock` / `beta` / `live` | 데이터가 속한 영역. 서로 다른 영역의 데이터는 비교·합산하지 않는다 |
| `dataSource` | `mock` / `blizzard` / `addon` / `user_submission` | 데이터를 가져온 공급원 |
| `verificationStatus` | §11 참고 | 데이터 신뢰 수준 |

- `beta`: WoW: Forever 베타 서버에서 관측한 실제 데이터
- `live`: 정식 출시 후 서버에서 관측한 실제 데이터
- `mock`: 개발용 가짜 데이터. 실제 데이터가 아니다

## 6.2 불변 규칙

다음 세 조건은 항상 함께 성립하거나 함께 성립하지 않는다.

```text
dataEnvironment = mock
⇔ dataSource = mock
⇔ verificationStatus = MOCK
```

- `beta`/`live` 행은 `dataSource = mock`이나 `verificationStatus = MOCK`을 가질 수 없다.
- `mock` 행은 실제 공급원(`blizzard`, `addon`, `user_submission`)을 가질 수 없다.
- 이 규칙은 모든 게임 데이터 테이블에 DB CHECK 제약으로 건다.

## 6.3 배포와 DB 분리

- 모든 배포는 환경변수 `APP_DATA_ENVIRONMENT`(`mock` | `beta` | `live`) 하나를 반드시 가진다. 값이 없거나 잘못되면 앱은 시작하지 않는다.
- 한 배포는 기본 `dataEnvironment` 하나를 가지고, 모든 요청은 정확히 하나의 `dataEnvironment`로 범위가 고정된다.
- **mock 데이터는 전용 데이터베이스에만 저장한다.** mock DB와 실제 DB는 같은 데이터베이스를 공유하지 않는다.
- `beta`와 `live`는 같은 데이터베이스에 함께 저장할 수 있다. 단, 모든 쿼리·고유 인덱스·캐시 키·통계에 `dataEnvironment`를 포함하고, 두 영역의 랭킹을 합산하지 않는다.

## 6.4 Mock 운영 유입 방지 안전장치

한 가지 장치가 실패해도 다른 장치가 막도록 여러 겹으로 설계한다.

1. **DB 식별 표식**
   - 모든 DB에 단일 행 테이블 `database_identity`를 둔다.
   - `allowed_data_environments` 값으로 이 DB가 받을 수 있는 영역을 기록한다. mock DB는 `{mock}`, 실제 DB는 `{beta, live}`.
   - 이 값은 DB를 만들 때 초기화 명령으로 한 번만 설정한다.
2. **DB 트리거**
   - 모든 게임 데이터 테이블에 INSERT/UPDATE 트리거를 건다.
   - 행의 `data_environment`가 `database_identity.allowed_data_environments`에 없으면 쓰기를 거부한다.
   - 즉 실제 DB에는 mock 행이 물리적으로 들어갈 수 없다.
3. **DB CHECK 제약**: §6.2 불변 규칙.
4. **앱 시작 검사**
   - 앱은 시작할 때 `APP_DATA_ENVIRONMENT`가 `database_identity.allowed_data_environments`에 포함되는지 확인한다.
   - 일치하지 않으면 시작하지 않는다.
5. **Provider 등록 제한**
   - `MockProvider`는 `APP_DATA_ENVIRONMENT = mock`일 때만 등록된다.
   - `beta`/`live` 배포에서 `MockProvider`를 요청하면 즉시 오류가 난다.
   - 반대로 mock 배포에서는 실제 Provider를 등록하지 않는다.
6. **Seed 스크립트 이중 확인**: Mock seed는 다음을 모두 만족할 때만 실행된다.
   - `APP_DATA_ENVIRONMENT = mock`
   - `database_identity`가 `{mock}`
   - 실행 인자 `--confirm-mock`
   - 하나라도 어긋나면 아무것도 쓰지 않고 종료한다.
7. **수집 파이프라인**
   - 저장할 행의 `dataEnvironment`는 **서버 설정에서 부여**한다. 외부 payload에 들어 있는 환경 값은 사용하지 않는다.
   - payload가 mock을 주장하는데 실제 배포로 들어오면 거부한다.
8. **조회 계층**
   - 모든 데이터 조회 함수는 `dataEnvironment`를 포함한 범위 인자를 **필수 인자**로 받는다. 기본값은 없다.
   - 범위 없이 게임 데이터 테이블을 조회하는 코드를 금지하고, 테스트로 확인한다.
9. **캐시 키**: 모든 캐시 키 앞에 `dataEnvironment`를 붙인다(예: `beta:rankings:level:...`).
10. **화면 표시**: mock 배포는 모든 페이지에 Mock 안내(§5)를 서버에서 렌더링한다.
11. **테스트**: 다음을 자동 테스트로 확인한다.
    - 실제 DB에 mock 행 쓰기가 거부되는지
    - seed 스크립트가 실제 DB에서 거부되는지
    - 랭킹 쿼리 결과에 다른 영역의 데이터가 섞이지 않는지

## 6.5 URL과 dataEnvironment

- 사이트 URL에는 기본 `dataEnvironment`를 넣지 않는다. 배포 설정에서 결정된다.
- 정식 출시 후 `live`가 기본이 되고 `beta` 데이터를 보존 목적으로 보여줄 때는 `/beta/...` 접두사를 사용한다.
- mock은 URL 접두사로 노출하지 않는다. 별도 배포(별도 도메인)에서만 보인다.

---

# 7. 캐릭터 식별

## 7.1 원칙

- 캐릭터 이름만으로 캐릭터를 식별하지 않는다.
- 확인되지 않은 Blizzard API나 게임 서버 구조를 식별 규칙에 넣지 않는다.
- **Realm(서버)은 필수값으로 가정하지 않는다.** 실제 데이터 구조에서 필요성이 확인되면 §7.5 절차로 추가한다.

## 7.2 식별 요소

| 요소 | 컬럼 | 설명 |
|---|---|---|
| 내부 ID | `characters.id` (UUID) | 시스템 내부 기본 키. 절대 바뀌지 않는다 |
| 외부 ID | `character_external_refs.external_id` | 공급원별 캐릭터 ID. 공급원마다 다를 수 있으므로 별도 매핑 테이블에 저장 |
| 지역 | `region` | 값 목록은 설정으로 관리. 실제 값 미확인 |
| 게임 모드 | `game_mode` | 값 목록은 설정으로 관리. 실제 값 미확인 |
| 데이터 영역 | `data_environment` | §6 |
| 표시 이름 | `character_name` | 공급원이 준 원래 이름 그대로 |
| 정규화 이름 | `name_normalized` | 유니코드 NFC 정규화 후 소문자화. 검색과 중복 판정에 사용 |
| 슬러그 | `slug` | URL용 식별자. 한글 이름은 로마자로 바꾸지 않고 정규화 이름을 URL 인코딩해 사용 |

## 7.3 식별 순서

수집한 관측 데이터를 기존 캐릭터와 연결할 때 다음 순서를 따른다.

1. `(data_environment, data_source, external_id)`가 일치하는 외부 ID 매핑이 있으면 그 캐릭터다.
2. 외부 ID가 없거나 매핑이 없으면, 자연 키 `(data_environment, region, game_mode, name_normalized)`로 찾는다.
3. 둘 다 없으면 새 캐릭터를 만든다.

## 7.4 고유성과 예외

- 고유 인덱스: `(data_environment, region, game_mode, slug)`
- 고유 인덱스: `character_external_refs (data_environment, data_source, external_id)`
- 이름 변경: 외부 ID가 있는 공급원에서만 기존 캐릭터와 연결한다. 외부 ID가 없으면 새 캐릭터로 취급한다.
- 레벨 감소 관측(삭제 후 같은 이름으로 재생성 가능성 등)
  - 현재 상태에 반영하지 않는다.
  - 해당 수집 기록을 "식별 충돌"로 표시해 운영자가 검토한다.
- 같은 영역·지역·게임 모드에서 이름이 같은 캐릭터가 실제로 여러 명 존재한다는 것이 확인되면, Realm 등 추가 식별 요소가 필요하다는 신호로 본다(§7.5).

## 7.5 Realm이 필요하다고 확인된 경우

기존 테이블을 다시 만들지 않고 다음 순서로 확장한다.

1. 마이그레이션으로 `realm` 컬럼(nullable)을 추가한다.
2. 새 고유 인덱스 `(data_environment, region, realm, game_mode, slug)`를 만든 뒤 기존 인덱스를 제거한다.
3. URL을 `/characters/{region}/{realm}/{slug}` 형태로 추가하고, 기존 URL은 새 URL로 영구 이동(301)시킨다.

## 7.6 URL

```text
/characters/{region}/{gameMode}/{slug}
```

- API는 내부 UUID 조회와 자연 키 조회를 모두 제공한다(§17).

---

# 8. 레벨 랭킹 규칙과 레벨 달성 기록

## 8.1 레벨 랭킹 정렬

```text
1. level DESC
2. 현재 레벨 milestone의 effectiveReachedAt ASC (NULL은 마지막)
3. firstSeenAt ASC
4. characterName ASC
5. id ASC (결과를 항상 같게 만들기 위한 최종 기준. 화면 의미는 없음)
```

같은 레벨이면 해당 레벨에 더 먼저 도달(또는 먼저 관측)한 캐릭터가 높은 순위다.

게임의 최대 레벨은 코드에 고정하지 않는다. 필요한 경우 게임 모드·빌드별 설정값으로 둔다.

## 8.2 level_milestones

`levelReachedAt` 한 값만으로 최초 달성을 표현하지 않는다. 레벨별 달성 기록을 별도 테이블에 저장한다.

캐릭터·레벨 쌍마다 기록이 하나 있다.

| 컬럼 | 설명 |
|---|---|
| `id` | UUID |
| `character_id` | 캐릭터 |
| `data_environment` | §6 |
| `level` | 달성한 레벨 |
| `timing_basis` | 시각을 어떻게 알게 되었는지(아래 표) |
| `reached_at` | 공급원이 제공한 **실제 달성 시각**. `SOURCE_REPORTED`일 때만 값이 있다 |
| `first_observed_at` | 이 레벨 이상인 상태가 **처음 관측된 시각**. 항상 값이 있다 |
| `previous_observed_at` | 이 레벨에 도달하기 직전(더 낮은 레벨) 마지막 관측 시각. 실제 달성 시각이 이 값과 `first_observed_at` 사이에 있음을 뜻한다 |
| `effective_reached_at` | 정렬에 쓰는 시각. `SOURCE_REPORTED`면 `reached_at`, 아니면 `first_observed_at` (생성 컬럼) |
| `data_source` | 이 기록의 근거가 된 공급원 |
| `verification_status` | §11 |
| `source_build` | 클라이언트 빌드 |
| `snapshot_id` | 근거가 된 스냅샷 |
| `ingestion_record_id` | 근거가 된 수집 기록 |
| `created_at`, `updated_at` | |

`timing_basis` 값:

| 코드 | 의미 | 한국어 표기 |
|---|---|---|
| `SOURCE_REPORTED` | 공급원이 실제 달성 시각을 제공함 | 달성 시각 확인됨 |
| `FIRST_OBSERVED` | 해당 레벨 상태를 처음 관측한 시각만 앎 | 최초 확인 시각 |
| `INFERRED` | 관측 사이에 여러 레벨이 올라 중간 레벨은 직접 관측하지 못함 | 추정 |

## 8.3 milestone 기록 규칙

- 레벨 L에서 L+n으로 올라간 것이 관측되면 다음과 같이 기록한다.
  - L+1 ~ L+n-1: `INFERRED`
  - L+n: `FIRST_OBSERVED` 또는 `SOURCE_REPORTED`
- 같은 캐릭터·레벨에 더 좋은 근거가 들어오면 기록을 갱신한다.
  - 근거 우선순위: `SOURCE_REPORTED` > `FIRST_OBSERVED` > `INFERRED`
  - 근거 수준이 같으면 더 이른 시각을 채택한다.
- milestone은 삭제하지 않는다.
- `characters`의 현재 레벨 도달 시각은 milestone에서 파생한 캐시 값이다. 원본은 항상 `level_milestones`다.

## 8.4 활용과 제한

- "최초 10/20/30/…레벨" 기록과 레벨 성장 그래프는 `level_milestones`로 계산한다.
- `SOURCE_REPORTED`와 `FIRST_OBSERVED`/`INFERRED`는 정확도가 다르다. 화면에 근거를 함께 표시한다.
- "World First" 같은 공식 최초 기록 칭호는 검증 상태가 `VERIFIED` 또는 `LOG_VERIFIED`인 기록에만 부여한다(§23).

---

# 9. 장비 랭킹 규칙

## 9.1 평균 장비 레벨

현재 장착 중인 장비 중 **랭킹 대상 슬롯**의 아이템 레벨 평균을 사용한다. 어떤 슬롯을 셀지는 Gear Profile(§9.4)이 정한다.

```text
averageItemLevel = 계산 대상 아이템 레벨 합 / 분모
```

- 분모는 Gear Profile의 빈 슬롯 정책과 양손 무기 정책으로 정해진다.
- 저장 값은 소수점 둘째 자리에서 반올림한 값(`numeric(6,2)`)이다. 정렬과 화면 표시가 같은 값을 사용한다.

화면 표시 예:

```text
평균 장비 레벨 61.42
```

## 9.2 최고 단일 아이템

랭킹 대상 슬롯에 장착한 아이템 중 가장 높은 아이템 레벨을 사용한다.

```text
최고 아이템 65
```

## 9.3 정렬

장비 랭킹:

```text
1. averageItemLevel DESC
2. highestItemLevel DESC
3. characterName ASC
4. id ASC (최종 기준)
```

최고 아이템 랭킹:

```text
1. highestItemLevel DESC
2. averageItemLevel DESC
3. characterName ASC
4. id ASC (최종 기준)
```

## 9.4 Gear Profile (장비 슬롯 구성)

슬롯 정의를 코드에 하드코딩하지 않는다. 버전 관리되는 설정 파일 `config/gear-profiles/*`로 관리하고, 앱 시작 시 스키마 검증을 거친다.

Gear Profile 항목:

| 항목 | 설명 |
|---|---|
| `id`, `version` | 프로필 식별자와 버전. 계산 결과에 함께 저장해 재현할 수 있게 한다 |
| `status` | `DRAFT`(초안, 실제 데이터 미확인) / `APPROVED`(실제 데이터로 확인됨) |
| `appliesTo` | 적용 범위: `dataEnvironments`, `gameModes`, `sourceBuilds` |
| `slots` | 슬롯 목록. 슬롯마다 `code`, 한국어 라벨 키 `labelKey`, `rankable`(랭킹 대상 여부), `group`(armor / jewelry / weapon / cosmetic 등), `displayOrder` |
| `excludedSlots` | 랭킹 계산에서 제외할 슬롯(예: 외형용 슬롯) |
| `twoHandWeaponPolicy` | 양손 무기 처리 방식(아래) |
| `emptySlotPolicy` | 미착용 슬롯 처리 방식(아래) |
| `minimumCoverage` | 최소 데이터 커버리지(아래) |
| `highestItemRequiresCoverage` | 최고 아이템 랭킹에도 최소 커버리지를 적용할지 여부 |

`twoHandWeaponPolicy` 선택지:

| 코드 | 의미 |
|---|---|
| `COUNT_ONCE` | 양손 무기를 한 번만 세고, 보조 무기 슬롯은 분모에서 뺀다 |
| `COUNT_TWICE` | 양손 무기 아이템 레벨을 주 무기와 보조 무기 두 슬롯 값으로 센다 |
| `OFFHAND_AS_EMPTY` | 보조 무기 슬롯을 빈 슬롯으로 보고 `emptySlotPolicy`를 적용한다 |

`emptySlotPolicy` 선택지:

| 코드 | 의미 |
|---|---|
| `EXCLUDE_FROM_DENOMINATOR` | 빈 슬롯을 분모에서 뺀다 |
| `COUNT_AS_ZERO` | 빈 슬롯을 아이템 레벨 0으로 센다 |

`minimumCoverage`:

- `minRankableSlotRatio`(0~1)와 `minRankableSlotCount` 중 하나 이상을 지정한다.
- 커버리지 = 아이템 레벨을 알고 있는 장착 랭킹 대상 슬롯 수 ÷ 예상 랭킹 대상 슬롯 수(양손 무기 정책 반영)
- 기준에 못 미치는 캐릭터는 장비 랭킹에서 제외한다. Armory에는 "장비 정보 부족"으로 표시한다.
- 아이템 레벨을 모르는 아이템은 계산에 넣지 않고 커버리지만 낮춘다.

## 9.5 미확정 구조 처리

- WoW: Forever의 실제 장비 슬롯 구조와 아이템 레벨 제공 여부는 **아직 확인되지 않았다**(§30).
- `beta`/`live`에 적용할 `APPROVED` 프로필이 없으면 다음과 같이 처리한다.
  - 장비 랭킹과 최고 아이템 랭킹을 계산하지 않는다.
  - 화면에 "장비 랭킹 준비 중"을 표시한다.
  - Armory는 장착 아이템 목록만 보여주고, 평균 값 자리에 "계산 기준 확인 중"을 표시한다.
- `mock` 환경은 `DRAFT` 프로필(`mock-provisional`)을 사용할 수 있다. 이 프로필의 슬롯 목록과 정책은 개발용 가정이며 실제 게임 규칙이 아니다.

## 9.6 기타 규칙

- 가방 속 미착용 아이템은 저장하지도 계산하지도 않는다.
- 공급원의 슬롯 ID를 표준 슬롯 코드로 바꾸는 매핑은 빌드별 파서(§15)가 담당한다.
- MVP에서는 자체 Gear Score를 만들지 않는다.

---

# 10. 랭킹 공통 규칙

## 10.1 서버 계산

- 랭킹은 `lib/ranking/`의 Ranking Engine이 서버에서 계산한다.
- 클라이언트 요청이나 수집 payload에 `rank`, `position` 같은 순위 값이 있어도 사용하지 않는다.
  - 조회 API는 해당 파라미터를 받지 않는다.
  - 수집 스키마는 이런 필드를 제거하고 수집 기록에 경고로 남긴다.

## 10.2 순위 번호

- 모든 랭킹은 최종 기준(`id ASC`)까지 포함해 완전히 정렬된다. 그래서 동순위는 없고, 순위는 정렬 결과의 위치(1, 2, 3, …)다.
- 순위는 필터를 적용한 결과 안에서 매긴다(예: 직업 필터를 쓰면 직업 내 순위).
- Armory의 "현재 랭킹"은 기본 범위(현재 dataEnvironment, 해당 gameMode, 전체 지역) 기준 순위다.

## 10.3 랭킹 대상 조건

다음 조건을 모두 만족하는 캐릭터만 현재 랭킹에 포함한다.

1. 요청 범위의 `dataEnvironment`에 속함
2. 요청 범위의 `gameMode`에 속함
3. 최근 확인 조건(§10.4) 만족
4. 검증 상태가 `ranking.allowedVerificationStatuses`(§25)에 포함됨
5. 장비/최고 아이템 랭킹은 추가로 다음을 만족
   - 적용 가능한 Gear Profile이 있음
   - 최소 커버리지 충족

## 10.4 오래된 데이터 정책

- 기본값: 마지막 관측(`last_seen_at`) 후 **7일 이상** 지난 캐릭터는 현재 랭킹에서 제외한다.
- 장비/최고 아이템 랭킹은 장비 마지막 관측 시각(`gear_observed_at`)에도 같은 기준을 적용한다.
- 정책 값은 설정 `ranking.staleAfterDays`로 바꿀 수 있고, `dataEnvironment`별로 다르게 지정할 수 있다.
- 제외는 조회 조건일 뿐이다. 캐릭터, 장비, 스냅샷, milestone 데이터는 **삭제하지 않는다.**
- 화면 안내:
  - 랭킹 페이지: "최근 7일 이내에 확인된 캐릭터만 표시됩니다."
  - Armory: "현재 랭킹 제외 · 7일 이상 확인되지 않음", 순위 자리에 "-"
- mock seed는 실행 시각을 기준으로 상대 시각을 만들어, 최근 데이터와 오래된 데이터를 모두 포함한다.

## 10.5 계산 시점

- Phase 1에서는 요청할 때 SQL로 계산하고, 결과는 캐시 인터페이스(인메모리 구현)로 짧게 보관한다.
- 실제 수집이 연결되면(P1) Redis 캐시와 BullMQ 갱신 작업으로 바꾼다. Ranking Engine 인터페이스는 바꾸지 않는다.

---

# 11. 검증 상태

| DB 코드 | 한국어 UI | 의미 |
|---|---|---|
| `VERIFIED` | 검증됨 | 공식 공급원 등 신뢰할 수 있는 출처로 확인됨 |
| `LOG_VERIFIED` | 로그 검증 | 전투 로그 등으로 확인됨(향후) |
| `COMMUNITY_SUBMITTED` | 커뮤니티 제출 | 사용자/애드온이 제출했고 별도 검증 전 (Phase 2D에서 "사용자 제출" → "커뮤니티 제출"로 변경) |
| `UNVERIFIED` | 미검증 | 출처를 확인할 수 없음 |
| `MOCK` | 테스트 데이터 | Mock 데이터 |

기본 부여 규칙:

- `mock` → `MOCK` (다른 값 불가)
- `blizzard` → 공식 API 존재가 확인된 후 결정. 현재는 기본값을 정하지 않는다.
- `addon`, `user_submission` → `COMMUNITY_SUBMITTED`
- 출처 검증에 실패한 데이터 → `UNVERIFIED`

캐릭터의 검증 상태는 현재 상태를 만든 최신 관측의 검증 상태다.

랭킹 필터 "검증된 데이터만"은 `VERIFIED`, `LOG_VERIFIED`만 포함한다.

---

# 12. 캐릭터 Armory

URL:

```text
/characters/{region}/{gameMode}/{slug}
```

필수 정보:

- 캐릭터명
- 레벨
- 종족
- 직업
- 진영
- 길드
- 평균 장비 레벨
- 최고 아이템 레벨
- 현재 랭킹(또는 랭킹 제외 사유)
- 마지막 확인
- 데이터 출처
- 검증 상태
- 현재 레벨 달성 시각과 근거(§8.2)

### 장비 슬롯

표시할 슬롯과 순서는 Gear Profile의 `slots`를 따른다. 아래는 일반적인 WoW 슬롯 예시이며, 실제 WoW: Forever 구조는 확인이 필요하다.

```text
머리
목
어깨
등
가슴
손목
손
허리
다리
발
반지 1
반지 2
장신구 1
장신구 2
주 무기
보조 무기 / 대체 무기
```

실제 데이터에 존재하지 않는 슬롯은 억지로 렌더링하지 않는다.

---

# 13. 캐릭터 성장 이력

핵심 테이블:

```text
character_snapshots
level_milestones
```

`character_snapshots` 최소 저장 데이터:

- character_id
- data_environment
- level
- average_item_level
- highest_item_level
- gear_coverage
- gear_profile_id / gear_profile_version
- normalized_data (정규화된 캐릭터·장비 상태)
- ingestion_record_id (원본 payload 참조)
- content_hash
- observed_at
- data_source
- verification_status
- source_updated_at
- source_build

스냅샷 저장 정책:

- 관측된 내용(`content_hash`)이 이전 스냅샷과 다를 때 새 스냅샷을 저장한다.
- 내용이 같아도 마지막 스냅샷 후 `snapshot.heartbeatHours`(기본 24시간)가 지났으면 저장한다.
- 그 외 관측은 `characters.last_seen_at`만 갱신한다.

활용:

```text
레벨 성장 그래프 (level_milestones)
장비 성장 그래프 (character_snapshots)
최근 24시간 성장량
최초 레벨 달성 기록 (level_milestones)
```

---

# 14. DB 설계

## 14.1 공통 규칙

- 기본 키는 UUID다.
- 시각은 모두 `timestamptz`로 저장하고 UTC 기준으로 다룬다.
- 모든 게임 데이터 테이블은 다음을 가진다.
  - `data_environment`
  - §6.2 CHECK 제약(해당 컬럼이 있는 경우)
  - §6.4 쓰기 트리거
- 직업·종족·진영·슬롯·품질은 영어 **코드**로 저장한다. 한국어 이름은 `locales/ko`에서 표시한다.
- 스키마 변경은 Drizzle migration으로만 한다. 파괴적 변경(컬럼 삭제, 타입 축소)은 하지 않는다.

## 14.2 Enum

```text
data_environment:      mock | beta | live
data_source:           mock | blizzard | addon | user_submission
verification_status:   VERIFIED | LOG_VERIFIED | COMMUNITY_SUBMITTED | UNVERIFIED | MOCK
milestone_timing_basis: SOURCE_REPORTED | FIRST_OBSERVED | INFERRED
ingestion_status:      ACCEPTED | REJECTED | IDENTITY_CONFLICT
```

## 14.3 database_identity

```text
id                         (항상 1, 단일 행)
allowed_data_environments  data_environment[]
created_at
```

## 14.4 ingestion_records

수집한 원본 데이터 기록. 재처리와 감사에 사용한다.

```text
id
data_environment
data_source
source_build
parser_version
received_at
payload            (jsonb, 원본)
payload_hash
status             (ingestion_status)
warnings           (jsonb, 예: 제거된 rank 필드)
rejection_reason
```

## 14.5 guilds

```text
id
data_environment
region
game_mode
name
name_normalized
slug
faction_code
first_seen_at
last_seen_at
data_source
verification_status
source_updated_at
source_build
created_at
updated_at

UNIQUE (data_environment, region, game_mode, slug)
```

## 14.6 guild_external_refs

```text
id
guild_id
data_environment
data_source
external_id
first_seen_at
last_seen_at

UNIQUE (data_environment, data_source, external_id)
```

## 14.7 characters

캐릭터의 현재 상태. 랭킹 조회용으로 일부 값을 미리 계산해 저장한다.

```text
id
data_environment
region
game_mode
character_name
name_normalized
slug
faction_code
race_code
class_code
level
current_level_reached_at      (level_milestones에서 파생된 캐시)
current_level_timing_basis    (level_milestones에서 파생된 캐시)
average_item_level            numeric(6,2), null 허용
highest_item_level            null 허용
gear_coverage                 numeric(4,3), null 허용
gear_profile_id
gear_profile_version
gear_observed_at
guild_id                      null 허용
first_seen_at
last_seen_at
data_source
verification_status
source_updated_at
source_build
created_at
updated_at

UNIQUE (data_environment, region, game_mode, slug)
INDEX  (data_environment, game_mode, name_normalized)
INDEX  랭킹 정렬용 (data_environment, game_mode, level DESC, ...)
INDEX  (data_environment, game_mode, average_item_level DESC, ...)
INDEX  (data_environment, game_mode, highest_item_level DESC, ...)
INDEX  (data_environment, last_seen_at)
```

`external_id` 컬럼은 두지 않는다. 외부 ID는 `character_external_refs`에 저장한다.

## 14.8 character_external_refs

```text
id
character_id
data_environment
data_source
external_id
first_seen_at
last_seen_at

UNIQUE (data_environment, data_source, external_id)
```

## 14.9 items

아이템 기본 정보.

```text
id
data_environment
external_item_id
name
name_locale            (예: ko-KR, 공급원이 준 이름의 언어)
slot_code              (아이템 자체의 장착 부위)
quality_code
base_item_level        null 허용
icon_url               null 허용
description            null 허용
data_source
source_updated_at
source_build
created_at
updated_at

UNIQUE (data_environment, external_item_id)
```

## 14.10 character_items

캐릭터의 **현재 장착** 장비만 저장한다. 과거 장비는 `character_snapshots.normalized_data`에 남는다.

```text
id
character_id
data_environment
slot_code              (Gear Profile의 표준 슬롯 코드)
item_id
item_level             null 허용 (관측된 개별 아이템 레벨)
enchant                jsonb, null 허용
gems                   jsonb, null 허용
observed_at
data_source
source_build

UNIQUE (character_id, slot_code)
```

기존 설계의 `equipped` 컬럼은 없앤다. 이 테이블에는 장착 아이템만 있기 때문이다.

## 14.11 character_snapshots

```text
id
character_id
data_environment
observed_at
level
average_item_level
highest_item_level
gear_coverage
gear_profile_id
gear_profile_version
guild_id
normalized_data        jsonb
content_hash
ingestion_record_id
data_source
verification_status
source_updated_at
source_build
created_at

INDEX (character_id, observed_at DESC)
```

## 14.12 level_milestones

§8.2 참고.

```text
UNIQUE (character_id, level)
INDEX  (data_environment, level, effective_reached_at)
```

## 14.13 향후 테이블

§22 ~ §24 참고. 모두 기존 `characters`/`guilds`를 참조하는 **새 테이블**로 추가한다.

---

# 15. 데이터 수집 아키텍처

```text
   ┌─ BlizzardProvider (미구성, 공식 API 확인 후)
   ├─ AddonProvider   (P1, 사용자 동의 애드온 데이터)
   ├─ 사용자 제출      (P1)
   └─ MockProvider    (mock 배포 전용)
                ↓
        ingestion_records (원본 저장)
                ↓
        입력 스키마 검증 (금지 필드 제거)
                ↓
        빌드별 파서 → 정규화 관측 데이터
                ↓
        dataEnvironment 부여 (서버 설정)
                ↓
        캐릭터 식별 (§7.3)
                ↓
        현재 상태 / 장비 / milestone / 스냅샷 갱신
        (Gear Profile 적용)
                ↓
          PostgreSQL
                ↓
          Ranking Engine
                ↓
        캐시 (Phase 1: 인메모리 → P1: Redis)
                ↓
          Next.js API / 페이지
```

규칙:

- UI는 Provider나 외부 API를 직접 호출하지 않는다. UI는 내부 API와 서버 데이터 계층만 사용한다.
- 관측 시각(`observed_at`)이 캐릭터의 `last_seen_at`보다 이전이면(늦게 도착한 오래된 데이터)
  - 현재 상태를 덮어쓰지 않는다.
  - 스냅샷과 milestone 보정에만 사용한다.

---

# 16. Provider 인터페이스

예시:

```typescript
interface CharacterDataProvider {
  readonly dataSource: DataSource
  getCharacter(input: CharacterLookup): Promise<ProviderCharacter | null>
  getCharacterGear(input: CharacterLookup): Promise<ProviderGear | null>
}
```

- 모든 Provider는 **정규화 관측 데이터** 형태로 결과를 넘긴다. 여기에는 `dataEnvironment`가 들어 있지 않다. `dataEnvironment`는 서버가 부여한다.
- 애드온·사용자 제출처럼 서버가 데이터를 받는 방식은 `getCharacter` 대신 빌드별 파서를 통해 같은 정규화 형태로 바꾼다.
- `BlizzardProvider`
  - 공식 API가 확인되기 전까지 엔드포인트를 구현하지 않는다.
  - 호출하면 "미구성" 오류를 반환한다.
  - 구조(Phase 2C): 설정(환경변수, URL 기본값 없음) → capability registry(`config/blizzard/capabilities.ts`, 확인 전 모두 `UNKNOWN`) → endpoint registry(`config/blizzard/endpoints.ts`, 확인 전 비어 있음) → 인증 → 응답 정규화. 상세: `docs/BLIZZARD-API-INTEGRATION-PLAN.md`
- 모든 Provider는 `getCapabilities()`로 기능 상태(`AVAILABLE` / `UNAVAILABLE` / `UNKNOWN` / `RUNTIME_REQUIRED`)를 알린다. 추측으로 `AVAILABLE`을 쓰지 않는다.
- 같은 캐릭터가 여러 공급원에 있으면 검증 상태 `VERIFIED → LOG_VERIFIED → COMMUNITY_SUBMITTED → UNVERIFIED → MOCK` 순, 같으면 최근 관측을 우선한다. 데이터 출처만으로 `VERIFIED`가 되지 않는다.
- 정적 게임 데이터(아이템·직업·종족·진영·게임 모드·던전·공격대·보스)는 버전별 데이터셋으로 가져온다(`docs/STATIC-GAME-DATA.md`). 실제 영역에는 이용 조건을 확인한 데이터셋만 저장한다.

권장 폴더:

```text
providers/
├─ types.ts
├─ registry.ts          (dataEnvironment에 따라 등록 가능한 Provider 제한)
├─ mock/
│  └─ MockCharacterProvider.ts
├─ blizzard/
│  └─ BlizzardProvider.ts
└─ addon/
   ├─ AddonProvider.ts
   └─ parsers/          (sourceBuild별 파서)
```

---

# 17. API 설계

초기 API:

```text
GET /api/v1/rankings/level
GET /api/v1/rankings/gear
GET /api/v1/rankings/highest-item
GET /api/v1/characters/search
GET /api/v1/characters/:id
GET /api/v1/characters/:region/:gameMode/:slug
GET /api/v1/guilds/:id
```

목록 API 공통 파라미터:

| 파라미터 | 설명 |
|---|---|
| `page` | 1부터 시작 |
| `pageSize` | 기본 50, 최대 100 |
| `gameMode` | 기본값은 설정 |
| `region` | 선택 |
| `class` | 직업 코드 |
| `faction` | 진영 코드 |
| `guild` | 길드 ID |
| `verifiedOnly` | `true`면 `VERIFIED`, `LOG_VERIFIED`만 |
| `dataEnvironment` | 선택. 해당 배포가 허용하는 실제 영역(`beta`/`live`)만 지정 가능. 실제 배포에서 `mock` 지정은 오류 |

알 수 없는 파라미터나 잘못된 값은 400 오류로 응답한다.

성공 응답:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 100,
    "dataEnvironment": "beta",
    "isMockData": false,
    "lastUpdatedAt": "2026-10-06T06:42:00Z",
    "generatedAt": "2026-10-06T06:44:10Z",
    "policy": {
      "staleAfterDays": 7,
      "gearProfile": { "id": "example", "version": 1, "status": "APPROVED" }
    }
  }
}
```

- `lastUpdatedAt`: 응답 범위 데이터 중 가장 최근 관측 시각(UTC)
- `data`의 각 항목에 서버가 계산한 `rank`가 포함된다.

오류 응답:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "요청 값이 올바르지 않습니다."
  }
}
```

- `code`는 영어 코드다.
- `message`는 한국어 사용자 문구다(locale 파일에서 가져온다).

---

# 18. 한국어 UI 명세

## 상단 메뉴

```text
홈
랭킹
캐릭터
길드
통계
```

## 랭킹 하위 메뉴

```text
레벨 랭킹
장비 랭킹
최고 아이템
```

## 향후 메뉴

```text
던전
공격대
World First
```

World First는 게임 고유 용어로 사용하되 설명 문구는 한국어로 작성한다.

## 버튼

```text
검색
캐릭터 검색
필터
필터 적용
초기화
전체 랭킹 보기
상세 보기
```

## 상태

```text
데이터 갱신
마지막 확인
검증됨
로그 검증
커뮤니티 제출
미검증
테스트 데이터
데이터 없음
준비 중
장비 랭킹 준비 중
계산 기준 확인 중
장비 정보 부족
현재 랭킹 제외
```

## 안내

```text
현재는 테스트 데이터가 표시되고 있습니다.
최근 7일 이내에 확인된 캐릭터만 표시됩니다.
제출된 캐릭터를 기준으로 한 랭킹입니다.
```

"최근 7일"의 숫자는 설정값에서 가져온다.

## 오류

```text
데이터를 불러오지 못했습니다.
잠시 후 다시 시도해 주세요.
검색 결과가 없습니다.
요청 값이 올바르지 않습니다.
```

---

# 19. 다국어 설계

기본 언어:

```text
ko-KR
```

- 모든 사용자 문자열은 `locales/ko/*`에 두고, 컴포넌트에 직접 쓰지 않는다.
- 직업·종족·진영·슬롯·검증 상태·근거(`timing_basis`)의 한국어 이름도 코드→문구 매핑으로 `locales/ko`에 둔다.
- 게임 고유명사는 실제 게임 클라이언트의 한국어 명칭을 우선한다(확인 필요, §30).

URL은 MVP에서는 언어 접두사 없이 사용한다.

```text
/rankings/level
/characters/{region}/{gameMode}/{slug}
```

향후 영어가 추가되면 `/ko/...`, `/en/...` 등으로 확장한다.

---

# 20. 시간 표시

- DB는 UTC(`timestamptz`)로 저장한다.
- 사용자 화면은 대한민국 표준시(KST, `Asia/Seoul`)로 표시한다.
- 서버의 시스템 시간대에 의존하지 않는다. 형식 지정 시 시간대를 명시한다.

절대 시각 형식:

```text
2026년 10월 6일 오후 3:42
```

- 12시간제, 오전/오후 표기
- 시는 앞에 0을 붙이지 않는다.
- 분은 두 자리다.

상대 시각 형식:

```text
방금 전
2분 전
3시간 전
5일 전
```

화면 예:

```text
데이터 갱신: 2026년 10월 6일 오후 3:42
마지막 확인: 2분 전
```

---

# 21. 검색 UI

```text
캐릭터명을 입력하세요
```

결과 예:

```text
홍길동
레벨 30 · 전사 · 호드
길드: 아제로스 수호대
```

- 검색은 서버에서 수행한다. 항상 현재 `dataEnvironment` 범위 안에서만 검색한다.
- 검색 대상은 `name_normalized`다. 입력값도 같은 방식(NFC + 소문자화)으로 정규화한다.
- 부분 일치 검색은 PostgreSQL `pg_trgm` 사용을 기본으로 한다.
- 오래된 캐릭터도 검색 결과에는 나온다(랭킹에서만 제외).

---

# 22. 던전 확장 설계

모든 확장 테이블은 다음 공통 필드를 가진다.

- `data_environment`
- `data_source`
- `verification_status`
- `source_build`
- 시각 정보
- §6.4 쓰기 트리거

```text
dungeons
- id
- data_environment
- game_mode
- external_id
- name
- slug
- difficulty_code
- source_build
```

```text
dungeon_runs
- id
- data_environment
- region
- game_mode
- dungeon_id
- difficulty_code
- duration_ms
- started_at
- completed_at
- deaths
- wipe_count
- guild_id (null 허용)
- data_source
- verification_status
- source_build
- ingestion_record_id
- created_at
```

```text
dungeon_run_players
- run_id
- character_id
- role_code
- class_code (기록 당시)
- level (기록 당시)
```

이를 통해 다음을 구현한다.

- 던전별 최고 기록
- 전체 최고 기록
- 직업별 최고 기록
- 길드별 최고 기록
- 파티 구성
- 기록 상세

---

# 23. 공격대 확장 설계와 First 기록

```text
raids
- id, data_environment, game_mode, external_id, name, slug, difficulty_code, source_build

raid_bosses
- id, raid_id, external_id, name, slug, order_index

raid_kills
- id, data_environment, region, game_mode, raid_boss_id, difficulty_code
- started_at, killed_at, duration_ms, guild_id (null 허용)
- data_source, verification_status, source_build, ingestion_record_id, created_at

raid_kill_participants
- raid_kill_id, character_id, role_code, class_code (기록 당시)
```

공격대 클리어 기록은 보스 처치 기록을 모아 계산한다.

### First 기록

```text
first_records
- id
- data_environment
- game_mode
- region (null 허용)
- record_type     LEVEL | DUNGEON_CLEAR | RAID_BOSS_KILL | RAID_CLEAR
- category        WORLD_FIRST | GUILD_FIRST | CLASS_FIRST | FACTION_FIRST
- scope_key       (예: 직업 코드, 진영 코드, 길드 ID. WORLD_FIRST는 null)
- target_key      (예: 레벨 숫자, dungeon_id, raid_boss_id, raid_id)
- achieved_at
- character_id / guild_id / dungeon_run_id / raid_kill_id / level_milestone_id (해당하는 것만)
- data_source
- verification_status
- computed_at
```

- First 기록은 원본 테이블(`level_milestones`, `dungeon_runs`, `raid_kills`)에서 서버가 계산해 만든다.
- 공식 칭호로 표시하는 First 기록은 `VERIFIED` 또는 `LOG_VERIFIED`만 대상으로 한다.

---

# 24. 기타 확장

- **레벨 성장 그래프:** `level_milestones`로 그린다. 스키마 변경 없음.
- **장비 성장 그래프:** `character_snapshots`로 그린다. 스키마 변경 없음.
- **PvP 랭킹:** 새 테이블로 추가한다.
  - `pvp_seasons`
  - `pvp_ratings` (character_id, bracket_code, rating, observed_at, data_environment, data_source, verification_status, source_build)

---

# 25. 설정 목록

설정은 저장소의 `config/` 아래 버전 관리 파일로 둔다. 앱 시작 시 스키마 검증을 거치고, 잘못되면 앱이 시작하지 않는다. 비밀 값은 환경변수로만 받는다.

| 설정 | 기본값 | 설명 |
|---|---|---|
| `APP_DATA_ENVIRONMENT` (환경변수) | 없음(필수) | `mock` / `beta` / `live` |
| `DATABASE_URL` (환경변수) | 없음(필수) | mock과 실제는 서로 다른 DB |
| `ranking.staleAfterDays` | 7 | dataEnvironment별 지정 가능 |
| `ranking.allowedVerificationStatuses` | beta/live: `VERIFIED`, `LOG_VERIFIED`, `COMMUNITY_SUBMITTED`, `UNVERIFIED` / mock: `MOCK` | 랭킹 포함 검증 상태 |
| `ranking.defaultPageSize` / `maxPageSize` | 50 / 100 | |
| `gameScopes.regions` | 미확정 | mock은 개발용 임시 값 사용 |
| `gameScopes.gameModes` / `defaultGameMode` | 미확정 | mock은 개발용 임시 값 사용 |
| `gameScopes.maxLevel` | 미확정 | 게임 모드·빌드별. 표시용 |
| `gearProfiles` | mock: `mock-provisional` | §9.4 |
| `snapshot.heartbeatHours` | 24 | §13 |
| `codes.classes` / `races` / `factions` / `qualities` | 미확정 | 코드 목록. 한국어 이름은 locale |

---

# 26. SEO

주요 페이지는 검색 엔진에 노출 가능하도록 한다.

예:

```text
WoW 포에버 레벨 랭킹 | Forever Rank
WoW 포에버 장비 랭킹 | Forever Rank
WoW 포에버 캐릭터 Armory | Forever Rank
```

- 페이지별로 한국어 title / description / canonical / Open Graph / 구조화 데이터를 구성한다.
- mock 배포는 검색 엔진에 노출하지 않는다(`noindex`).

---

# 27. 보안

- 모든 입력값 검증
- 공개 데이터 제출 API Rate Limit과 payload 크기 제한
- Battle.net 비밀번호 수집 금지
- 불필요한 개인정보 수집 금지
- 외부 ID 검증
- 가능한 경우 데이터 출처 검증
- 사용자 제출 데이터에 대한 검증 상태 관리
- 클라이언트가 보낸 순위 값은 사용하지 않음(§10.1)
- 수집 데이터의 `dataEnvironment`는 서버가 부여(§6.4)

---

# 28. 외부 사이트 사용 원칙

- 외부 사이트를 무단 스크래핑하여 핵심 서비스 데이터로 사용하지 않는다.
- 특정 제3자 API의 이용약관이 경쟁 서비스 구축을 제한하면, 그 API를 핵심 랭킹 데이터 공급원으로 사용하지 않는다.
- 공식 Blizzard 데이터가 사용 가능해지면 우선 검토한다.

---

# 29. 베타 환경 대응

WoW: Forever 베타 클라이언트와 애드온 API는 변경될 수 있다.

따라서:

- `sourceBuild`를 저장한다.
- 빌드별 파서를 분리한다.
- 장비 슬롯은 Gear Profile로 구성한다.
- Provider와 Ranking Engine을 분리한다.
- `beta`와 `live` 데이터를 `dataEnvironment`로 분리한다.
- 원본 payload를 `ingestion_records`에 보관해 파서가 바뀌면 재처리한다.

---

# 30. 실제 데이터 확인이 필요한 항목

아래 항목은 **확인 전까지 코드에서 확정값으로 하드코딩하지 않는다.** 설정값, 초안(`DRAFT`) 값, 또는 "준비 중" 상태로 처리한다.

| 번호 | 항목 | 영향 범위 |
|---|---|---|
| 1 | Blizzard 공식 웹/API 존재 여부, 범위, 이용약관 | BlizzardProvider, `blizzard` 기본 검증 상태 |
| 2 | 애드온 API로 얻을 수 있는 데이터(레벨, 장비, 아이템 레벨, 길드, 레벨업 시각 등)와 저장 방식 | AddonProvider, 파서, `SOURCE_REPORTED` 가능 여부 |
| 3 | 사용자 동의 기반 애드온 수집이 Blizzard 정책상 허용되는지 | P1 수집 전략 전체 |
| 4 | Realm(서버) 개념 존재 여부와 캐릭터 이름 고유 범위 | 캐릭터 식별, URL(§7.5) |
| 5 | region 값 목록 | `gameScopes.regions` |
| 6 | gameMode 값 목록(예: 일반/하드코어 구분 여부) | `gameScopes.gameModes`, 랭킹 범위 |
| 7 | 캐릭터·길드 외부 ID 제공 여부와 이름 변경·서버 이전 처리 | 식별 순서(§7.3) |
| 8 | 최대 레벨 | `gameScopes.maxLevel` |
| 9 | 직업·종족·진영 목록과 클라이언트 한국어 명칭 | `codes.*`, `locales/ko` |
| 10 | 장비 슬롯 목록, 원거리/성물 등 추가 슬롯, 외형 슬롯 | Gear Profile `slots` |
| 11 | 아이템 레벨 데이터 제공 여부(개별 아이템 단위) | 장비 랭킹 성립 여부 |
| 12 | 양손 무기·보조 무기 처리 방식 | `twoHandWeaponPolicy` |
| 13 | 적절한 최소 커버리지 기준 | `minimumCoverage` |
| 14 | 클라이언트 빌드 번호 체계 | `source_build`, 파서 분리 기준 |
| 15 | 정식 출시 시 베타 데이터 처리(초기화 여부) | `beta`/`live` 전환 |
| 16 | "WoW", "Warcraft" 상표 사용 범위와 서비스명 "Forever Rank" | 사이트명, SEO |
| 17 | Blizzard Forever API의 인증 방식, API base, namespace, 호출 한도, 응답 형식 | `BlizzardProvider` 설정·endpoint·정규화 |
| 18 | 정적 데이터 공급원(아이템 카탈로그 등)의 이용 조건, attribution, 재배포 가능 여부 | `static_datasets` 가져오기 |
| 19 | 클라이언트 `Enum.InventoryType` / `Enum.ItemQuality` 값의 의미 | Item Catalog → 슬롯·품질 코드 매핑 |
| 20 | 제3자 Forever 서비스(WoWCensus, ForeverDB 등)의 이용 조건 원문 | 사용하지 않음. 확인돼도 핵심 공급원으로 고정하지 않음 (`docs/DATA-SOURCE-POLICY.md`) |
| 21 | 성(surname) 숨김 캐릭터의 이름 공개 가능 범위 | 캐릭터 이름 표시 |
| 22 | 커뮤니티 랭킹 2단계·"전체 서버" 표시 기준값, 모집단 수 근거 | `config/community-ranking.ts` (`docs/DATA-COVERAGE-MODEL.md`) |
| 23 | Collector SavedVariables의 Lua 문자열 이스케이프 형식 (.lua 업로드 추출) | `lib/submissions/preview.ts` |
| 24 | 제출 데이터 보관 기간, 삭제 요청 창구, 관련 법령 검토 | `docs/PRIVACY-DATA-POLICY.md` |
| 25 | `Enum.GameMode` 숫자와 공식 Ruleset(일반 / 전쟁 / 롤플레잉 / 하드코어)의 대응. Ruleset 이름·공개 상태는 공식 자료로 확인됨 | `config/rulesets.ts`, `config/export-mapping.ts` (`docs/RULESETS.md`) |
| 26 | 같은 전체 이름이 다른 Ruleset에 있을 수 있는지, 숨긴 성이 export에 담기는지 | 캐릭터 식별 (`docs/RULESETS.md` §3) |

---

# 31. MVP 완료 기준

다음이 모두 동작해야 한다.

```text
홈
├─ 최고 레벨
├─ 최고 장비
└─ 최고 아이템

랭킹
├─ 레벨 랭킹
├─ 장비 랭킹
└─ 최고 아이템

캐릭터
├─ 검색
└─ 상세 Armory

길드
└─ 상세 정보
```

그리고 다음을 모두 충족해야 한다.

- 모든 사용자 UI가 한국어
- Mock 데이터 명확히 표시, Mock 운영 유입 방지 안전장치 동작(테스트로 확인)
- 페이지네이션
- 필터
- 데이터 최신 시각(KST 형식)
- 오래된 데이터 정책 적용
- API
- DB migration
- 입력값 검증
- 테스트
- typecheck
- lint
- 문서 갱신

---

# 32. 개발 단계

## 장기 개발 방향

```text
1단계  한국어 UI + Mock 데이터
2단계  레벨 / 장비 / 최고 아이템 랭킹
3단계  캐릭터 Armory / 길드
4단계  실제 데이터 공급원 연결
5단계  데이터 자동 수집
6단계  성장 이력 / 통계
7단계  던전 랭킹
8단계  공격대 랭킹
9단계  World First
10단계 영문 및 다국어 확장
```

## Phase 1 범위 (기반 + 첫 수직 기능)

Phase 1은 mock 환경만 사용한다. §30의 미확인 항목에 의존하지 않는다.

1. Next.js + TypeScript + Tailwind + shadcn/ui 프로젝트 초기화, lint / typecheck / test 설정
2. `locales/ko` 구조와 KST 시간 표시 유틸리티
3. 설정 모듈과 스키마 검증
   - `APP_DATA_ENVIRONMENT`
   - `ranking.*`
   - `gameScopes`(mock 임시 값)
   - `mock-provisional` Gear Profile
4. Drizzle 스키마와 migration
   - §14 MVP 테이블 전체
   - enum, CHECK 제약, 쓰기 트리거, `database_identity`
5. Mock 안전장치(§6.4)와 관련 테스트
6. MockProvider, 결정적(같은 입력 → 같은 결과) mock 데이터 생성기, 수집 파이프라인(§15)
7. Ranking Engine 3종(레벨 / 장비 / 최고 아이템)과 단위 테스트
8. API: `GET /api/v1/rankings/level`, `/gear`, `/highest-item`
9. UI: 레벨 랭킹 페이지(한국어, Mock 안내, 데이터 갱신 시각, 페이지네이션)

## Phase 2 (MVP 완성)

- 장비 / 최고 아이템 랭킹 페이지
- 홈
- 캐릭터 검색
- Armory
- 길드 상세
- 필터
- SEO
