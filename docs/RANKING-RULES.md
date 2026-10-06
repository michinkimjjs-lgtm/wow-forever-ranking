# 랭킹 규칙

기준: 명세서 §8 ~ §11. 구현: `lib/ranking/`. 규칙을 바꾸려면 명세서를 먼저 고친다.

## 1. 공통

- 순위는 **서버가 계산**한다. API는 `rank` 파라미터를 받지 않고, 수집 payload의 `rank` / `position` / `ranking` / `rankPosition` 필드는 제거하고 경고로 남긴다.
- 모든 랭킹은 **하나의 dataEnvironment + 하나의 gameMode** 안에서 계산한다. 영역이나 게임 모드가 다른 데이터는 합산하지 않는다.
- 마지막 정렬 기준 `id ASC`까지 포함해 완전히 정렬한다. 그래서 동순위는 없다.
- 순위는 필터를 적용한 결과 안에서의 위치(1, 2, 3, …)다. 다음 페이지 순위는 이어서 매긴다.

## 2. 랭킹 대상 조건

| 조건 | 레벨 | 장비 | 최고 아이템 |
|---|---|---|---|
| 같은 dataEnvironment / gameMode | ✓ | ✓ | ✓ |
| 마지막 관측(`last_seen_at`)이 7일 이내 | ✓ | ✓ | ✓ |
| 검증 상태가 허용 목록에 있음 (mock: MOCK / beta·live: MOCK 외 전부) | ✓ | ✓ | ✓ |
| 적용 가능한 Gear Profile이 있고 같은 id / version으로 계산됨 | | ✓ | ✓ |
| 장비 관측(`gear_observed_at`)이 7일 이내 | | ✓ | ✓ |
| 최소 커버리지 충족 (mock-provisional: 75%) | | ✓ | ✓ (`highestItemRequiresCoverage`) |

- 7일 기준은 `config/ranking.ts`의 `staleAfterDays`로 영역별로 바꿀 수 있다.
- 제외된 캐릭터의 데이터는 삭제하지 않는다. 검색과 Armory에서는 계속 보이고 "현재 랭킹 제외"로 표시한다.
- "검증된 데이터만" 필터는 `VERIFIED`, `LOG_VERIFIED`만 포함한다.

## 3. 레벨 랭킹

```text
1. level DESC
2. 현재 레벨 milestone의 effective_reached_at ASC (NULL은 마지막)
3. first_seen_at ASC
4. character_name ASC (COLLATE "C", 유니코드 코드포인트 순 = 한글 가나다 순)
5. id ASC
```

- 같은 레벨이면 그 레벨에 먼저 도달한 캐릭터가 앞선다.
- `effective_reached_at`은 공급원이 실제 달성 시각을 주면(`SOURCE_REPORTED`) 그 시각, 아니면 최초 관측 시각이다.
- Armory에 시각 근거(달성 시각 확인됨 / 최초 확인 시각 / 추정)를 함께 표시한다.

## 4. 장비 랭킹

```text
1. average_item_level DESC
2. highest_item_level DESC
3. character_name ASC
4. id ASC
```

평균 장비 레벨 계산(`lib/gear/calculate.ts`)은 Gear Profile 설정만 따른다.

- 계산 대상: `rankable = true`이고 `excludedSlots`에 없는 슬롯(셔츠, 휘장 제외)
- 양손 무기(`twoHandWeapon.policy`)
  - `COUNT_ONCE`: 보조 무기 슬롯을 분모에서 뺀다 (mock-provisional)
  - `COUNT_TWICE`: 주 무기 레벨을 두 번 센다
  - `OFFHAND_AS_EMPTY`: 보조 무기를 빈 슬롯으로 본다
- 빈 슬롯(`emptySlotPolicy`)
  - `EXCLUDE_FROM_DENOMINATOR` (mock-provisional)
  - `COUNT_AS_ZERO`
- 아이템 레벨을 모르는 아이템은 계산하지 않고 커버리지만 낮춘다.
- 커버리지 = 아이템 레벨을 아는 장착 슬롯 수 ÷ 예상 슬롯 수
- 평균은 소수점 둘째 자리에서 반올림해 저장한다(`numeric(6,2)`). 정렬과 표시가 같은 값을 쓴다.
- 자체 Gear Score는 만들지 않는다.

## 5. 최고 아이템 랭킹

```text
1. highest_item_level DESC
2. average_item_level DESC (NULL은 마지막)
3. character_name ASC
4. id ASC
```

- 최고 아이템은 랭킹 대상 슬롯 중 가장 높은 아이템 레벨이다.
- 아이템명은 그 아이템 레벨을 가진 슬롯 중 표시 순서가 앞선 슬롯의 아이템이다.

## 6. Gear Profile이 없을 때

- beta / live에는 `APPROVED` 프로필이 아직 없다.
- 이 경우 장비 / 최고 아이템 랭킹은 계산하지 않는다.
  - API: `meta.status = "unavailable"`, `unavailableReason = "GEAR_PROFILE_NOT_APPROVED"`
  - 화면: "장비 랭킹 준비 중"
- mock은 `mock-provisional`(PROVISIONAL)을 사용한다. 화면에 "장비 계산 기준은 개발용 임시 기준입니다."를 표시한다.

## 7. Armory "현재 랭킹"

- 기본 범위(캐릭터의 dataEnvironment와 gameMode, 전체 지역, 필터 없음)에서 레벨 / 장비 / 최고 아이템 순위를 각각 표시한다.
- 순위가 없으면 제외 사유를 표시한다.
  - `STALE`: 현재 랭킹 제외 · 7일 이상 확인되지 않음
  - `VERIFICATION_EXCLUDED`: 랭킹 대상 검증 상태가 아님
  - `GEAR_PROFILE_NOT_APPROVED`: 장비 랭킹 준비 중
  - `GEAR_INSUFFICIENT`: 장비 정보 부족

## 8. 길드 상세의 파생 값

길드 화면에서 쓰는 값은 다음과 같이 정했다(명세서에 정의가 없어 Phase 1에서 정한 규칙).

| 값 | 정의 |
|---|---|
| 대표 캐릭터 | 길드원을 레벨 랭킹 정렬 기준으로 줄 세웠을 때 첫 번째 캐릭터(오래된 캐릭터 포함) |
| 최고 레벨 | 길드원 중 최고 레벨 |
| 최고 장비 레벨 | 현재 Gear Profile로 계산되었고 최소 커버리지를 충족한 길드원 중 최고 평균 장비 레벨 |
| 마지막 데이터 갱신 | 길드원 `last_seen_at`의 최댓값 |
