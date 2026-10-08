# Mock Character Export fixture (Phase 3D)

**모든 파일은 개발·테스트용 가짜 데이터입니다.** 실제 WoW: Forever 플레이어, 캐릭터, 아이템, 클라이언트 값이 아닙니다.

## 형식

```json
{
  "fixture": { "id": "...", "description": "...", "dataEnvironment": "mock", "dataSource": "mock", "verificationStatus": "MOCK" },
  "export": { "...": "Character Export v1" }
}
```

- `fixture` 표식은 언제나 `mock` / `mock` / `MOCK`입니다. 테스트가 이 값을 확인합니다.
- Character Export 자체에는 데이터 영역 필드가 없습니다. 서버가 부여합니다.
  - 이 fixture는 mock 전용 처리 경로(`processMockCharacterExport`)로만 저장합니다.
  - 그래서 저장된 행도 `mock` / `mock` / `MOCK`입니다.
- `collector.version`에 `mock-fixture` 표식이 있습니다.
  - 실제 영역 제출 경로는 이 표식이 있는 export를 `MOCK_FIXTURE_REJECTED`로 거부합니다.
  - 따라서 fixture가 커뮤니티 제출(`COMMUNITY_SUBMITTED`)이나 검증 상태로 승격되지 않습니다.
- 게임 값(지역 `9901`, 게임 규칙 `9911`~`9913`, 품질 `9903`, 장비 종류 `9917` 등)은 **일부러 만든 가짜 숫자**입니다.
  - `mapping.json`(테스트 전용)으로만 해석합니다.
  - 실제 `config/export-mapping.ts`에는 넣지 않습니다. 실제 `Enum.GameMode` 등의 값은 아직 확인되지 않았습니다.
- 기준 시각은 `2026-10-08T06:00:00Z`입니다.

## 목록

| 파일 | 케이스 |
|---|---|
| `01-valid-character.json` | 정상 캐릭터 (일반 규칙, 랭킹 대상 슬롯 17개) |
| `02-ruleset-normal.json` | 일반 규칙 |
| `03-ruleset-pvp.json` | 전쟁 규칙 |
| `04-ruleset-roleplaying.json` | 롤플레잉 규칙 |
| `05-gear-sufficient.json` | 장비 충분 (슬롯 20개, 셔츠·휘장·탄약은 제외 슬롯) |
| `06-gear-insufficient.json` | 장비 부족 (4개 + 정수가 아닌 아이템 레벨 1개) |
| `07-two-hand-weapon.json` | 양손 무기 (보조 무기 슬롯 비어 있음) |
| `08-full-name.json` | 이름 + 성 식별 (02와 첫 이름만 같음) |
| `09-same-name-other-ruleset.json` | 02와 전체 이름이 같지만 전쟁 규칙 |
| `10-conflict.json` | 01과 충돌 (같은 GUID, 늦은 시각, 레벨 감소, 직업 변경) |
| `11-missing-surname.json` | 성 없음 → `FULL_NAME_REQUIRED` |
| `12-unknown-ruleset-value.json` | 매핑에 없는 게임 규칙 값 → `MAPPING_MISSING` |
| `13-outdated-schema-version.json` | 지원하지 않는 오래된 Export 형식 버전(`schemaVersion` 0) → `EXPORT_SCHEMA_OUTDATED` (Phase 4A) |
| `mapping.json` | 테스트 전용 가짜 매핑 |

## 사이트의 테스트용 예시 파일 (Phase 4A)

`lib/collector/test-export.template.json`은 `01-valid-character.json`의 `export`를 그대로 옮긴 것입니다(테스트가 같은지 확인합니다).

- mock 배포의 `/contribute/test-export`가 이 파일로 테스트용 예시 Export를 내려 줍니다.
  - 관측 시각만 요청 시각 기준으로 바꾸고, `collector.version`은 `<Collector 버전>-mock-fixture`로 씁니다.
- mock 배포의 `/submit`은 이 파일을 **검증만** 합니다. 검증 상태는 `MOCK`(테스트 데이터)이며 저장하지 않습니다.
- beta / live 배포에서는 예시 파일을 내려 주지 않고(404), 제출해도 `MOCK_FIXTURE_REJECTED`로 거부합니다.
