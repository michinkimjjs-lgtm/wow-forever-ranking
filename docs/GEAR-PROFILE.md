# Gear Profile — 장비 계산 기준

> 단계: Phase 2B-1
> 구현:
> - 설정: `config/gear-profiles/*`
> - 설정 스키마: `lib/config/schema.ts`
> - 계산: `lib/gear/calculate.ts` (`calculateEquippedItemLevel`)
>
> 관련 문서:
> - 명세서 §9, [`RANKING-RULES.md`](./RANKING-RULES.md)
> - [`FOREVER-API-CAPABILITY.md`](./FOREVER-API-CAPABILITY.md)

실제 게임에서 확인하지 못한 값은 **Runtime verification required**로 표시합니다.

## 1. 원칙

- 슬롯 목록, 제외 슬롯, 양손 무기 처리, 빈 슬롯 처리, 최소 coverage, 계산 방식은 **모두 설정**으로 관리합니다. 계산 코드에 하드코딩하지 않습니다.
- **슬롯 이름과 슬롯 번호를 분리합니다.**
  - 프로필에는 우리 슬롯 코드(`head`)와 클라이언트 슬롯 이름(`HeadSlot`)만 둡니다.
  - 슬롯 번호는 클라이언트가 실행 중에 `C_PaperDollInfo.GetInventorySlotInfo(slotName)`로 정하므로 설정에 넣지 않습니다(Runtime verification required).
- beta / live 랭킹에는 **APPROVED** 프로필만 씁니다. APPROVED가 없으면 장비 랭킹과 최고 아이템 랭킹은 "장비 랭킹 준비 중"이고, 숫자를 만들어 표시하지 않습니다.
- mock 영역은 DRAFT 프로필로도 랭킹을 계산합니다. 화면에 "장비 계산 기준은 개발용 임시 기준입니다."를 표시합니다.

## 2. 구조

| 항목 | 설명 |
|---|---|
| `id`, `version` | 프로필 식별자와 버전(profileId / profileVersion). 계산 결과에 함께 저장 |
| `status` | `DRAFT`(초안, 실제 데이터 미확인) / `APPROVED`(실제 데이터로 확인되어 승인) |
| `appliesTo` | 적용 범위: `dataEnvironments`, `gameModes`, `sourceBuilds` (`"*"` = 모두) |
| `slots[]` | `code`(우리 슬롯 코드), `clientSlotName`(클라이언트 슬롯 이름, 선택), `rankable`(랭킹 대상 여부), `group`, `displayOrder` |
| `excludedSlots` | 평균에서 제외할 슬롯 코드 |
| `twoHandWeapon` | `policy`(`COUNT_ONCE` / `COUNT_TWICE` / `OFFHAND_AS_EMPTY`), `mainHandSlot`, `offHandSlot`, `twoHandItemSlotCodes` |
| `emptySlotPolicy` | `EXCLUDE_FROM_DENOMINATOR`(빈 슬롯을 평균에 넣지 않음) / `COUNT_AS_ZERO` |
| `minimumCoverage` | `minRankableSlotRatio`(0~1) 그리고/또는 `minRankableSlotCount` |
| `highestItemRequiresCoverage` | 최고 아이템 랭킹에도 최소 coverage를 적용할지 |
| `itemLevelBounds` | 계산에 쓸 아이템 레벨 범위 `{ min, max? }`. 범위 밖이면 잘못된 값으로 처리 |
| `calculation` | `method`(`MEAN_OF_RANKABLE_EQUIPPED`), `version`(계산 방식 버전 = calculationVersion) |

설정 검증(앱 시작 시):

- 슬롯 코드 중복과 `clientSlotName` 중복을 거부합니다.
- 양손 무기 설정의 주 무기 / 보조 무기 슬롯이 `slots`에 없으면 거부합니다.
- `itemLevelBounds.max < min`이면 거부합니다.
- id@version이 중복되면 거부합니다.

### 화면 안내 (`components/ranking/gear-profile-panel.tsx`)

- 장비 랭킹·최고 아이템 랭킹 화면에 "장비 랭킹 계산 기준"을 표시합니다: 평균에 넣는 칸, 빼는 칸, 랭킹에 들어가는 조건, 빈 칸·양손 무기 처리, 최고 아이템 랭킹 조건.
- 값은 모두 프로필 설정에서 읽습니다. 설정을 바꾸면 안내도 바뀝니다.
- beta·live에서 APPROVED 프로필이 없으면 DRAFT 프로필을 "초안"으로 표시하고, 확정 전까지 실제 계산에 쓰지 않는다고 알립니다(`resolveGearProfileForDisplay`, 계산에는 쓰지 않음).

### 프로필 선택

| 함수 | 용도 | DRAFT 포함 |
|---|---|---|
| `resolveGearProfile(env, gameMode)` | 랭킹 계산, 수집 시 장비 계산 저장 | mock만 포함. beta / live는 APPROVED만 |
| `resolveSlotMappingProfile(env, gameMode)` | 제출 데이터의 슬롯 이름 → 슬롯 코드 변환 | 포함 (랭킹과 별개) |

여러 프로필이 맞으면 APPROVED, 높은 version 순으로 고릅니다.

## 3. 현재 등록된 프로필

| id | version | status | 적용 영역 | 비고 |
|---|---|---|---|---|
| `mock-provisional` | 1 | DRAFT | mock | 개발용 가정. 슬롯 16개(셔츠·휘장 제외), COUNT_ONCE, coverage 75%. id는 저장된 mock 데이터와 호환되도록 유지 |
| `forever-draft` | 2 | DRAFT | beta, live | WoW: Forever 초안. **랭킹에 쓰지 않음**. v2(2026-11-01): 최소 coverage를 "유효 아이템 10개 이상"으로 변경(§6) |

### `forever-draft` 슬롯 (근거: Forever UI 소스 Camelot `PaperDollFrame.xml`, 1.60.1.70235)

| 코드 | clientSlotName | 랭킹 대상 | 비고 |
|---|---|---|---|
| head | HeadSlot | ✓ | |
| neck | NeckSlot | ✓ | |
| shoulder | ShoulderSlot | ✓ | |
| back | BackSlot | ✓ | |
| chest | ChestSlot | ✓ | |
| shirt | ShirtSlot | 제외 | 외형용 |
| tabard | TabardSlot | 제외 | 외형용 |
| wrist | WristSlot | ✓ | |
| hands | HandsSlot | ✓ | |
| waist | WaistSlot | ✓ | |
| legs | LegsSlot | ✓ | |
| feet | FeetSlot | ✓ | |
| finger_1 | Finger0Slot | ✓ | |
| finger_2 | Finger1Slot | ✓ | |
| trinket_1 | Trinket0Slot | ✓ | |
| trinket_2 | Trinket1Slot | ✓ | |
| main_hand | MainHandSlot | ✓ | |
| off_hand | SecondaryHandSlot | ✓ | 양손 무기면 분모에서 제외 (COUNT_ONCE) |
| ranged | RangedSlot | ✓ (초안) | 모든 직업의 랭킹 대상으로 볼지 **Runtime verification required** |
| ammo | AmmoSlot | 제외 | 소모품 |

슬롯 번호는 어느 슬롯에도 적혀 있지 않습니다(Runtime verification required).

### APPROVED로 바꾸기 전에 확인할 것 (Runtime verification required)

0. 실제 export의 `clientAverageItemLevel.equipped`(게임이 계산한 평균)와 이 프로필의 계산 결과를 비교해, 원거리·빈 칸·양손 무기 처리가 게임 표시값과 어떻게 다른지 확인
1. 실제 슬롯 구성과 원거리 슬롯을 랭킹에 넣을지 (v2 초안: 넣음)
2. 양손 무기를 들면 보조 무기 슬롯이 비는지, 계산 방식(COUNT_ONCE 유지 여부)
3. 양손 무기를 판별할 `Enum.InventoryType` 값 → `config/export-mapping.ts`의 `twoHandInventoryTypes`
4. 아이템 레벨 범위(`itemLevelBounds.max`)와 최소 coverage 기준 (v2 초안: 유효 아이템 10개 이상)
5. 실제 export 여러 건으로 계산 결과 검토

승인 절차:

1. 새 버전(예: `forever-v1`, version 1, status APPROVED)으로 추가합니다.
2. 계산 방식이 바뀌면 `calculation.version`과 프로필 `version`을 올립니다.
3. 랭킹은 캐릭터에 저장된 `gear_profile_id` / `gear_profile_version`이 현재 프로필과 같을 때만 그 값을 씁니다. 그래서 이전 계산 결과가 섞이지 않습니다.

## 4. 계산 (`calculateEquippedItemLevel`)

입력:

- 장비 목록 `[{ slotCode, itemLevel, itemSlotCode? }]` (`itemLevel`은 검증 전 값)
- Gear Profile

출력:

| 필드 | 설명 |
|---|---|
| `averageItemLevel` | 평균 장비 레벨. 소수점 둘째 자리에서 반올림. 계산할 아이템이 없으면 `null` |
| `highestItemLevel` | 계산 대상 아이템 중 최고 아이템 레벨 |
| `equippedItemCount` | 아이템 레벨이 유효한, 장착된 랭킹 대상 슬롯 수 |
| `expectedItemCount` | 예상 랭킹 대상 슬롯 수(양손 무기 정책 반영) |
| `coverage` | `equippedItemCount / expectedItemCount`. 소수점 셋째 자리에서 반올림 |
| `meetsCoverage` | 최소 coverage 충족 여부 |
| `excludedSlots` | 계산에서 뺀 슬롯과 이유 (아래 표) |
| `profileId`, `profileVersion`, `calculationMethod`, `calculationVersion` | 계산 기준 |
| `status` | `OK` / `INSUFFICIENT_COVERAGE` / `NO_GEAR_DATA` |

공식 (`MEAN_OF_RANKABLE_EQUIPPED`, 기본 `EXCLUDE_FROM_DENOMINATOR`):

```text
대상 슬롯   = slots 중 rankable 이고 excludedSlots에 없는 슬롯
             (양손 무기 + COUNT_ONCE이면 보조 무기 슬롯 제외)
유효 아이템 = 대상 슬롯에 장착됐고, itemLevel이 숫자이며 유한하고 itemLevelBounds 안에 있는 아이템

averageItemLevel  = round2( Σ 유효 아이템 레벨 / 유효 아이템 수 )
highestItemLevel  = max( 유효 아이템 레벨 )
coverage          = round3( 유효 아이템 수 / 대상 슬롯 수 )
```

`excludedSlots`의 이유:

| 이유 | 의미 |
|---|---|
| `EXCLUDED_BY_PROFILE` | `excludedSlots`에 있는 슬롯 (셔츠, 휘장, 탄약 등) |
| `NOT_RANKABLE` | 프로필에 있지만 `rankable = false` |
| `UNKNOWN_SLOT` | 프로필에 없는 슬롯 코드 |
| `INVALID_ITEM_LEVEL` | null, 숫자가 아님, NaN, 무한대, 범위 밖 |
| `DUPLICATE_SLOT` | 같은 슬롯이 두 번 들어옴 (두 번째부터 제외) |
| `OFFHAND_WITH_TWO_HAND` | 양손 무기와 보조 무기를 함께 든 경우의 보조 무기 |

## 5. coverage 정책

| 상황 | 처리 |
|---|---|
| 빈 슬롯 | 평균에 넣지 않음. coverage는 낮아짐 |
| 잘못된 아이템 레벨 | 평균에 넣지 않음. coverage는 낮아짐 |
| coverage ≥ 최소 기준 | `status = OK`. 장비 랭킹·최고 아이템 랭킹 대상 |
| coverage < 최소 기준 | `status = INSUFFICIENT_COVERAGE`. 평균은 계산해 저장하지만 **랭킹에 쓰지 않음**. 장비 랭킹·최고 아이템 랭킹에서 제외. Armory에 "장비 정보 부족" 표시 |
| 유효 아이템 0개 | `status = NO_GEAR_DATA`. 평균·최고 값 없음 |

### 최고 아이템 랭킹과 coverage

**결정: 최고 아이템 랭킹에도 최소 coverage를 적용합니다** (`highestItemRequiresCoverage = true`).

이유:

- 제출 방식에서는 장비 일부만 담긴 export(예: 무기 하나만 기록)를 만들 수 있습니다. coverage를 보지 않으면 이런 데이터가 최고 아이템 랭킹 상위를 차지할 수 있습니다.
- 두 장비 랭킹의 대상 캐릭터가 같아집니다. 사용자는 두 랭킹을 같은 대상끼리 비교할 수 있습니다.
- 대가: 장비를 일부만 기록한 캐릭터의 고레벨 아이템은 랭킹에 보이지 않습니다. 캐릭터 상세에서는 볼 수 있습니다.

정책을 바꾸려면 프로필의 `highestItemRequiresCoverage`를 바꾸고 프로필 버전을 올립니다.

## 6. `forever-draft` v2 초안 검토 (2026-11-01)

WoW: Forever에 실제로 있는 아이템으로 만든 화면 미리보기의 예시 장비 14명(레벨 28~42, `lib/demo/demo-items.ts`)을 이 프로필로 계산해 봤습니다. 아이템과 아이템 레벨은 실제 값이고, 착용 조합은 예시입니다(직업 방어구·무기 종류와 요구 레벨 준수).

### 결과 (v1: 랭킹 대상 칸의 75% 이상)

| 캐릭터 | 레벨 | 장착 / 대상 칸 | coverage | v1 결과 |
|---|---|---|---|---|
| 레벨 36~42 캐릭터 12명 | 36~42 | 13~15 / 16~17 | 0.81~0.88 | 장비 랭킹 대상 |
| 늦깎이모험가 (사제) | 33 | 10 / 16 | 0.625 | **정보 부족으로 제외** |
| 첫걸음 (전사) | 28 | 7 / 17 | 0.412 | 정보 부족으로 제외 |

- 평균 아이템 레벨은 화면 미리보기 값과 모두 같았습니다(계산 방식 확인).
- 클래식 기반 레벨업 구간에서는 장신구 2칸이 비어 있는 경우가 흔하고, 낮은 레벨일수록 목·어깨·손목 등도 비어 있습니다.
- v1의 비율 기준은 **실제로 비어 있는 정상 장비**를 "장비 정보 부족"으로 빼 버렸습니다. coverage는 원래 "데이터를 얼마나 알고 있는가"를 보려는 것인데, 빈 칸까지 모르는 칸처럼 셌기 때문입니다.
- 원거리 칸: 드루이드·성기사·주술사는 이 구간에서 원거리 칸이 대부분 비어 있어, 비율 기준에서는 이 직업들만 coverage가 낮아집니다.

### v2 초안 결정

| 항목 | v1 | v2 초안 | 이유 |
|---|---|---|---|
| 최소 coverage | 랭킹 대상 칸의 75% 이상 | **유효 아이템 10개 이상** | 레벨업 중 정상적으로 빈 칸을 벌하지 않으면서, 무기 하나만 담긴 것 같은 일부 기록 제출은 계속 막음. 직업·양손 무기 여부에 따라 기준이 달라지지 않음 |
| 원거리 칸 | 랭킹 대상 | 랭킹 대상 (유지) | 클래식 캐릭터 창의 장비 칸이고 사냥꾼의 주 무기. 개수 기준이라 원거리 무기가 없는 직업도 불리하지 않음 |
| 빈 칸 | 평균에서 제외 | 유지 | 장착한 아이템만으로 평균. 빈 칸을 0으로 넣는 방식(`COUNT_AS_ZERO`)은 레벨업 캐릭터를 크게 낮춤 |
| 양손 무기 | 보조 무기 칸을 분모에서 제외 | 유지 | 실제 데이터로 확인 전까지 중복 계산하지 않음 |

v2 결과: 레벨 30 이상 예시 캐릭터 13명이 모두 대상이고, 아이템 7개뿐인 28레벨 캐릭터만 제외됩니다(`tests/gear-profile.test.ts`).

### 남은 확인 (승인 전)

- 실제 export 여러 건의 `clientAverageItemLevel.equipped`와 비교. 게임 표시값과 크게 다르면 원거리·빈 칸 처리를 다시 정합니다.
- 유효 아이템 10개 기준이 실제 제출 분포에서 적절한지.
- 양손 무기 판별용 `Enum.InventoryType` 값(`config/export-mapping.ts`, 지금 비어 있음).
- 승인할 때는 `forever-v1`(APPROVED)로 새로 추가합니다. 이 초안을 그대로 APPROVED로 바꾸지 않습니다.
