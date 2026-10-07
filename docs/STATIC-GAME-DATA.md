# 정적 게임 데이터

> 단계: Phase 2C
>
> 구현:
> - `lib/static-data/*`
> - DB: `static_datasets`, `static_data_records` (마이그레이션 `0003`, `0004`)
> - 스크립트: `scripts/static-data-import.ts`
>
> 관련 문서:
> - [`PHASE2-DATA-SOURCE-PLAN.md`](./PHASE2-DATA-SOURCE-PLAN.md) §7
> - [`BLIZZARD-API-INTEGRATION-PLAN.md`](./BLIZZARD-API-INTEGRATION-PLAN.md) §5

## 1. 목적과 현재 상태

아이템, 직업, 종족, 진영, 게임 모드, 던전, 공격대, 보스처럼 캐릭터와 관계없는 게임 데이터를 **버전별 데이터셋**으로 가져오는 구조입니다.

**이번 단계에서는 실제 외부 데이터를 DB에 넣지 않았습니다.**

- 이용 조건과 라이선스를 확인한 공개 데이터셋이 아직 없습니다. 예를 들어 AHledger는 이 환경에서 접속이 막혀 조건을 확인하지 못했습니다.
- 구현한 것: importer 인터페이스, 검증, DB 저장 구조, mock 데이터셋 생성기
- 실제 영역(beta / live)에는 이용 조건을 확인한(`PERMITTED`) 데이터셋만 들어갑니다. 이 규칙은 importer와 DB CHECK가 함께 막습니다.

## 2. 데이터셋 형식

```json
{
  "meta": {
    "kind": "items",
    "source": "공급원 코드",
    "sourceVersion": "공급원 쪽 버전",
    "sourceBuild": "1.60.1.70235",
    "interfaceVersion": "16001",
    "datasetVersion": "2026-10-06.1",
    "observedAt": "2026-10-06T00:00:00Z",
    "license": {
      "status": "PERMITTED",
      "termsUrl": "https://...",
      "checkedAt": "2026-10-06",
      "attribution": "표시해야 하는 문구"
    }
  },
  "records": [ ... ]
}
```

| 필드 | 설명 |
|---|---|
| `kind` | `items` / `classes` / `races` / `factions` / `game_modes` / `dungeons` / `raids` / `bosses` |
| `source` | 데이터셋 공급원 코드. mock 데이터셋은 반드시 `mock`. 캐릭터의 `dataSource`와 별개 |
| `sourceVersion` | 공급원이 매긴 버전 |
| `sourceBuild` | 데이터를 얻은 클라이언트 빌드. 모르면 `null` |
| `interfaceVersion` | 클라이언트 interface 버전(숫자). 모르면 `null` |
| `datasetVersion` | 우리가 매기는 버전. 같은 (영역, kind, source) 안에서 고유 |
| `observedAt` | 데이터를 관측·추출한 시각 |
| `license.status` | `PERMITTED` / `MOCK` / `UNKNOWN` / `PROHIBITED` |

`dataEnvironment`는 파일에 넣지 않습니다. 가져오는 서버의 `APP_DATA_ENVIRONMENT`가 부여합니다.

## 3. 검증 (`validateStaticDataset`)

| 규칙 | 결과 |
|---|---|
| 메타·레코드가 종류별 스키마(zod, 알 수 없는 필드 거부)를 통과 | 아니면 오류 |
| 레코드 0개, 200,000개 초과 | 오류 |
| 같은 키가 **같은 내용**으로 중복 | 하나만 쓰고 경고(`DUPLICATE_IDENTICAL`) |
| 같은 키가 **다른 내용**으로 중복 | 데이터셋 전체 거부(`DUPLICATE_CONFLICT`) |
| 아이템 레코드의 `source` / `sourceVersion`이 메타와 다름 | 오류(`SOURCE_MISMATCH`) |
| 종족의 `factionCode`, 보스의 `instanceCode`가 참조 목록에 없음 (참조 목록을 준 경우) | 오류(`UNKNOWN_REFERENCE`) |
| `PERMITTED`인데 조건 URL·확인 날짜가 없음 | 오류 |
| mock 공급원 ⇔ `MOCK` 이용 조건이 어긋남 | 오류 |

키: 아이템은 `itemId`, 나머지는 `code`입니다. 검증을 통과하면 메타와 정렬한 레코드로 sha256 `checksum`을 만듭니다.

## 4. 가져오기 (`DatabaseStaticDataImporter`)

```text
검증 → 영역·이용 조건 확인 → 같은 버전 확인 → 저장(트랜잭션)
```

| 상황 | 결과 |
|---|---|
| mock 영역에 mock 이외 데이터셋, 실제 영역에 mock 데이터셋 | 거부 `MOCK_ISOLATION` |
| 실제 영역에 `PERMITTED` 아닌 데이터셋 | 거부 `LICENSE_NOT_CONFIRMED` |
| 같은 (영역, kind, source, datasetVersion)이 있고 checksum이 같음 | `UNCHANGED` (아무것도 안 함) |
| 같은 버전인데 내용이 다름 | 거부 `DATASET_VERSION_CONFLICT` (덮어쓰지 않음) |
| 새 버전 / 새 빌드 | `IMPORTED`. 이전 데이터셋은 그대로 남음 |

DB 안전장치 (마이그레이션 `0004_static_game_data_guards.sql`):

- 두 테이블 모두 영역 쓰기 트리거(`enforce_data_environment`)를 겁니다.
- 수정(UPDATE)은 언제나 금지합니다.
- 삭제는 mock 영역에서만 허용합니다(개발용 초기화).
- CHECK 제약:
  - mock 영역 ⇔ `source = mock` ⇔ `license_status = MOCK`
  - 실제 영역은 `PERMITTED` + 조건 URL + 확인 날짜

명령:

```bash
npm run static-data:import -- --file=dataset.json            # 검증만 (DB를 쓰지 않음)
npm run static-data:import -- --file=dataset.json --commit   # 저장
npm run static-data:import -- --mock --confirm-mock --commit # mock 데이터셋 (mock DB 전용)
```

## 5. 조회

모든 함수는 `dataEnvironment`를 필수 인자로 받습니다.

| 함수 | 용도 |
|---|---|
| `listStaticDatasets(db, env, kind)` | 버전 목록 (최근 관측 순) |
| `getLatestStaticDataset(db, env, kind, { source?, sourceBuild? })` | 최신 데이터셋. 특정 빌드의 데이터셋 선택 가능 |
| `getStaticDataRecords(db, env, datasetId)` | 레코드 |
| `findCatalogItems(db, env, datasetId, itemIds)` | 아이템 ID로 카탈로그 조회 |
| `linkCatalogToItems(db, env, datasetId)` | 기존 `items` 테이블과 연결(`items.external_item_id = itemId`, 같은 영역만). `items` 행은 바꾸지 않음 |

## 6. Item Catalog

`ItemCatalogProvider` 인터페이스:

```ts
interface ItemCatalogProvider {
  describe(): StaticDatasetMeta;          // 공급원, 버전, 빌드, 이용 조건
  listItems(): Promise<ItemCatalogEntry[]>;
  getItem(itemId: number): Promise<ItemCatalogEntry | null>;
}
```

구현:

- `DatasetItemCatalogProvider`: 검증한 데이터셋 파일(메모리)
- `DatabaseItemCatalogProvider`: DB에 저장된 데이터셋

`ItemCatalogEntry`:

| 필드 | 규칙 |
|---|---|
| `itemId` | 필수. 양의 정수 |
| `name` | 필수. 1~128자 |
| `nameLocale` | 선택 (`ko`, `en_US` 등) |
| `itemLevel` | 양의 정수. 공급원이 주지 않으면 `null` |
| `inventoryType` | 클라이언트 `Enum.InventoryType` 숫자 (0 이상). 값 목록은 Runtime verification required |
| `quality` | 클라이언트 `Enum.ItemQuality` 숫자 (0 이상). 값 목록은 Runtime verification required |
| `icon` | fileID 또는 https 이미지 URL. 원본 그대로 보관 |
| `source`, `sourceVersion` | 데이터셋 메타와 같아야 함 |

`items` 테이블 컬럼으로 바꿀 때(`itemCatalogEntryToItemFields`):

- `inventoryType` → `slot_code`, `quality` → `quality_code`는 클라이언트 Enum 매핑이 확인되지 않아 `null`로 둡니다. 원본 숫자는 카탈로그에 남아 있습니다.
- `icon_url`은 https URL일 때만 씁니다.

## 7. 게임 메타데이터와 한국어 이름

- 직업·종족·진영·게임 모드는 영문 내부 코드(`warrior`)로 저장하고, 표시명은 따로 고릅니다.
- 이름마다 확인 상태가 있습니다.

| 상태 | 의미 | 확정 명칭 |
|---|---|---|
| `CLIENT_CONFIRMED` | WoW: Forever 클라이언트에서 확인한 명칭 | ✓ |
| `SOURCE_PROVIDED` | 데이터셋 공급원이 준 명칭 (Forever 공식 명칭인지 미확인) | |
| `UNCONFIRMED` | 임시 명칭 | |

`resolveKoreanName(kind, code, names?)`:

1. 데이터셋에 `CLIENT_CONFIRMED` 한국어 이름이 있으면 확정 명칭입니다.
2. 그 밖의 데이터셋 이름이나 `locales/ko/game.ts` 이름은 **미확정**으로 표시합니다.
   - `locales/ko/game.ts`의 이름(예: `warrior` → 전사)은 mock 개발용 임시 명칭입니다. Forever 클라이언트에서 확인한 명칭이 아닙니다.
3. 둘 다 없으면 코드를 그대로 보여 줍니다.

Forever 클라이언트의 한국어 명칭은 게임 실행 또는 공식 자료로 확인해야 합니다(명세서 §30-9).

## 8. mock 데이터셋

`lib/static-data/mock.ts`

- 직업·종족·진영·게임 모드: `config/codes.ts`, `config/game-scopes.ts`의 mock 값으로 만듭니다.
- 아이템: mock 생성기 장비로 만듭니다. `itemId`는 개발용 번호입니다.
  - mock `items` 행의 `external_item_id`는 `mock-item-*` 문자열입니다.
  - 그래서 mock 카탈로그와 mock `items`는 연결되지 않습니다.
- 던전·공격대·보스: mock 생성기가 만들지 않으므로 데이터셋도 없습니다.
- 이름 상태는 모두 `UNCONFIRMED`입니다.

## 9. 실제 데이터셋을 가져오기 전에 확인할 것

1. 공급원의 이용 조건 URL, 확인 날짜, attribution 문구, 상업적 이용·재배포 가능 여부
2. `sourceBuild` / `interfaceVersion` (어느 빌드에서 얻은 데이터인지)
3. 아이템: `inventoryType`·`quality` 숫자의 의미 → 슬롯·품질 코드 매핑 (Runtime verification required)
4. 메타데이터: Forever 한국어 명칭 (게임 실행 또는 공식 자료)
5. 사이트에 attribution을 표시할 위치 (P1)
