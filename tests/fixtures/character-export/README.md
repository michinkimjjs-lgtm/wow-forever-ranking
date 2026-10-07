# Character Export v1 테스트 fixture

모든 값은 **가상 테스트 데이터**입니다. 실제 WoW: Forever 캐릭터·아이템·매핑 값이 아닙니다.
관측 시각은 테스트 기준 시각 `2026-10-07T06:00:00Z`에 맞춰져 있습니다.
게임 값(regionId 901, activeGameMode 902, TESTCLASS 등)은 `tests/submission-system.test.ts`의 테스트 매핑으로만 해석됩니다.

| 파일 | 내용 | 기대 결과 |
|---|---|---|
| `valid.json` | 정상 export (슬롯 17개) | 통과, 검토 대기(PENDING) |
| `invalid-schema.json` | schema 값이 다르고 collector 없음 | "캐릭터 데이터 형식이 올바르지 않습니다." |
| `missing-level.json` | 캐릭터 레벨 없음 | 정규화 거부 (CHARACTER_LEVEL_REQUIRED) |
| `missing-gear.json` | 장비 배열이 비어 있음 | 통과, 장비 계산 NO_GEAR_DATA |
| `low-coverage.json` | 장비 5개 | 통과, coverage 부족 (장비 랭킹 제외 예정) |
| `duplicate.json` | `valid.json`과 같은 내용 (키 순서만 다르고 알 수 없는 필드 추가) | 중복 |
| `conflict.json` | 같은 GUID, 더 늦은 시각인데 레벨이 낮고 직업이 다름 | 충돌(CONFLICT) |
| `too-large.json` | 256KB 초과 | 파일 크기 거부 |
| `invalid-json.json` | 깨진 JSON | "지원하지 않는 파일입니다." |
| `sensitive.json` | 가짜 이메일·가짜 비밀번호 문자열 | 개인정보 의심으로 거부 |
| `collector-savedvariables.lua` | `valid.json`을 담은 Collector SavedVariables 형식 | `.lua`에서 JSON 추출 |

`.lua` 파일의 문자열 이스케이프 방식은 실제 WoW 클라이언트 저장 형식으로 확인되지 않았습니다(Runtime verification required).
