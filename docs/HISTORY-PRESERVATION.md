# 역사 기록 보존 (Phase 1)

> 작성일: 2026-10-26 · 관련: 명세서 §8.3, §8.5, §14.12, `docs/DATA-SPEC.md` §4, `docs/DATA-SOURCE-POLICY.md` §8·§11

Forever Rank는 현재 순위뿐 아니라 최초 달성 같은 역사 기록을 쌓는다. 현재 상태가 바뀌거나 오래된 캐릭터가 랭킹에서 빠져도 역사 기록은 사라지면 안 된다. Phase 1은 레벨 달성 기록과 스냅샷을 그 기반으로 만든다.

## 1. 계층

| 계층 | 테이블 | 규칙 |
|---|---|---|
| 현재 상태 | `characters`, `character_items` | 바뀔 수 있다. 랭킹과 7일 오래된 데이터 규칙은 여기에만 적용한다 |
| 관측 원본 | `ingestion_records`, `character_snapshots` | 스냅샷은 추가만 한다(수정 금지, 실제 영역 삭제 금지) |
| 레벨 달성 근거 | `level_milestone_evidence` | 관측마다 추가만 한다(수정 금지, 실제 영역 삭제 금지) |
| 현재 채택 기록 | `level_milestones` | 근거에서 다시 고르는 결과. 수집 코드가 갱신한다(삭제만 금지). `evidence_id`로 채택한 근거를 가리킨다 |

7일 규칙은 랭킹 조회 조건일 뿐이며, 역사 기록 테이블을 지우거나 걸러 저장하지 않는다.

## 2. 레벨 달성 근거 (`level_milestone_evidence`)

관측 한 번이 만드는 근거:

- 현재 레벨 1행: 달성 시각 주장이 `ACCEPTED`면 `SOURCE_REPORTED`, 아니면 `FIRST_OBSERVED`
- 레벨을 건너뛴 경우 중간 레벨마다 1행: `INFERRED`

| 컬럼 | 내용 |
|---|---|
| `character_id`, `data_environment`, `level` | 대상 |
| `timing_basis` | 이 근거가 뒷받침하는 시간 근거 |
| `claimed_reached_at` | 공급원이 보낸 달성 시각 주장. 판정과 관계없이 받은 그대로 |
| `claim_status`, `claim_reasons` | 주장 판정과 이유 코드 (§3) |
| `observed_at`, `previous_observed_at` | 관측 시각, 레벨 상승을 확인한 직전 관측 시각 |
| `received_at` | 서버 수신 시각 (이관 행은 원본이 연결된 경우만) |
| `data_source`, `verification_status`, `source_build` | 출처 |
| `snapshot_id`, `ingestion_record_id` | 스냅샷(그 관측에서 저장된 경우)과 원본 연결 |
| `character_name`, `region`, `game_mode`, `class_code`, `race_code`, `faction_code`, `guild_id` | 관측 당시 맥락. 관측에 없던 값은 null(현재 캐릭터 값을 빌려 쓰지 않는다) |
| `origin` | `INGESTED`(수집) / `MIGRATED`(기존 milestone에서 이관) |

## 3. 달성 시각 주장 판정 (`lib/ingestion/milestone-evidence.ts`)

판정에 쓰는 사실은 같은 캐릭터의 저장된 스냅샷·근거·직전 상태뿐이다.

| 판정 | 조건 | 결과 |
|---|---|---|
| `REJECTED` | 달성 시각 > 그 관측 시각 | 채택 안 함, 경고 |
| `CONFLICT` | 더 낮은 레벨로 관측(또는 그 레벨을 채택 가능한 시각에 달성)된 시각보다 이름 / 더 높은 레벨을 관측(또는 달성)한 시각보다 늦음 | 채택 안 함, 경고 |
| `NEEDS_REVIEW` | 커뮤니티 제출·미검증이고, 그 시각 이전에 더 낮은 레벨로 관측한 기록이 없음 | 채택 안 함(거부도 안 함), 경고 |
| `ACCEPTED` | 그 밖. `VERIFIED`·`LOG_VERIFIED`·`MOCK`은 뒷받침 관측이 없어도 됨 | 채택 후보 |

- **사이트가 처음 관측하기 전에 달성한 경우:** 실제로 가능하므로 거부하지 않는다. 신뢰할 수 있는 하한(게임 시작일 등)이 확인되지 않았으므로(명세서 §30-28) 날짜를 고정하지 않고 `NEEDS_REVIEW`로 보관한다. 더 낮은 레벨 관측이 그 시각보다 앞서 있으면, 이 레벨을 처음 관측한 시각보다 이르더라도 `ACCEPTED`다.
- **처음 제출된 캐릭터:** 커뮤니티 제출의 달성 시각 주장은 `NEEDS_REVIEW`가 된다. 채택 기록은 최초 관측 시각 기준(`FIRST_OBSERVED`)이다. 이전에는 바로 `SOURCE_REPORTED`로 채택했다.
- **늦게 도착한 옛 관측:** 레벨이 이후 관측보다 높으면 달성 순서와 모순이므로 관측 전체를 `IDENTITY_CONFLICT`로 기록하고 근거를 만들지 않는다.
- **검토 대기·충돌 근거의 처리:** 관리자 확인 후 채택하는 화면은 Phase 2 범위다. 그때도 근거 행을 고치지 않고, 판정 결과를 별도 행으로 추가하는 방식으로 설계한다.

## 4. 현재 채택 규칙 (`chooseAdoptedEvidence`)

1. 신뢰 수준(`VERIFIED` 4 > `LOG_VERIFIED` 3 > `COMMUNITY_SUBMITTED` 2 > `UNVERIFIED` 1)이 가장 높은 근거들만 후보로 한다. mock 영역은 `MOCK`만 있다.
2. 시간 근거 `SOURCE_REPORTED` > `FIRST_OBSERVED` > `INFERRED`
3. 더 이른 시각, 같으면 먼저 저장된 행

`first_observed_at`은 같은 신뢰 수준 근거 중 가장 이른 관측 시각이다. 날짜가 이르다는 이유만으로 낮은 신뢰의 근거가 높은 신뢰의 기록을 대체하지 않는다.

## 5. 삭제 방지와 삭제 요청

**DB 보호 (migration 0008)**

- `character_snapshots`, `level_milestones`의 캐릭터 FK를 `ON DELETE CASCADE`에서 `ON DELETE RESTRICT`로 바꿨다. 근거 테이블은 처음부터 RESTRICT다. 역사 기록이 있는 캐릭터는 삭제할 수 없다.
- 행 트리거
  - 근거·스냅샷: 수정 금지, 실제 영역 삭제 금지
  - milestone: 실제 영역 삭제 금지 (수정은 채택 결과 갱신을 위해 허용)
- 세 테이블 모두 `TRUNCATE` 금지 (행 트리거를 우회하므로)
- mock 영역은 개발용 초기화를 위해 행 삭제를 허용한다(`npm run db:seed`). 삭제 순서: milestone → 근거 → 스냅샷

**삭제 요청 (설계만, 이번 범위에서 구현하지 않음)**

- 역사 기록 자체는 지우지 않는다. 공개 표시를 숨기거나, 표시할 때 이름 등 식별 정보를 비공개로 바꾼다.
- 별도 표시 제어 테이블(예: `character_visibility`)을 추가하고, 화면·API가 그 값을 따르게 한다. 기존 테이블을 다시 설계하지 않는다.
- 원본 payload 삭제·익명화가 필요하면 `ingestion_records`에서 처리한다. 역사 테이블은 원본 id만 가리킨다.
- 익명화 때문에 근거·스냅샷 행을 수정해야 한다면, 트리거를 끄지 않고 정해진 함수와 권한만 허용하는 별도 migration으로 설계한다. 이 정책은 확정되지 않았다(`docs/DATA-SOURCE-POLICY.md` §8).

## 6. migration과 기존 데이터

| migration | 내용 | 기존 데이터 영향 |
|---|---|---|
| `0007_level_milestone_evidence` | 근거 테이블·enum·영역 트리거 추가, `level_milestones.evidence_id` 추가, 기존 milestone 이관 | milestone 1행마다 근거 1행(`MIGRATED`)을 만들고 `evidence_id`만 채운다. 다른 컬럼과 `updated_at`은 그대로 |
| `0008_history_delete_protection` | FK RESTRICT, 수정·삭제·TRUNCATE 금지 트리거 | 데이터 변경 없음 |

**이관 규칙**

- `timing_basis`, `reached_at`, `first_observed_at`(→ `observed_at`), `previous_observed_at`, 출처·검증 상태·빌드·스냅샷·원본 연결을 그대로 옮긴다. 근거 수준을 올리지 않는다.
- 기존 `SOURCE_REPORTED`는 `claim_status = ACCEPTED`로 옮긴다. 기존 판단을 유지할 뿐 새 판정을 거친 것은 아니다. `claim_reasons = ["MIGRATED_FROM_LEVEL_MILESTONES"]`로 구분한다.
- 맥락(이름·직업·종족·진영·길드)은 연결된 스냅샷이 `first_observed_at`과 같은 관측일 때만 옮긴다. 아니면 null이다.
- region / game_mode는 캐릭터 식별 값이라 `characters`에서 가져온다.
- 서버 수신 시각은 원본이 연결된 경우에만 채운다.
- 이관 행 하나는 기존 milestone의 여러 관측이 합쳐진 값일 수 있다(예: `first_observed_at`과 채택 출처가 다른 관측). 기존 구조가 개별 관측을 남기지 않았기 때문이며, 원본 `ingestion_records`는 남아 있다.

**운영 DB:** 2026-10-26 기준 운영 DB에는 실제 캐릭터 데이터가 없는 것으로 보고되었다(확인은 운영자 몫). 병합하면 Vercel Production 빌드가 두 migration을 자동 적용한다(`docs/DEPLOYMENT.md`).

## 7. 범위 밖 (후속 작업)

- 월드 퍼스트·길드 퍼스트 판정 테이블과 화면
- 보스 처치·공격대 참가자
- 검토 대기·충돌 근거의 관리자 확인 화면
- 삭제 요청 숨김 테이블
- 순위 이력
- Blizzard API 연결과 30일 만료 처리. 만료 대상은 Blizzard 출처 원본·근거로 한정하고, 판정 기록은 "근거 만료"로 남기는 방향으로 설계한다(`docs/DATA-COLLECTION-STRATEGY.md` §4.3, 별도 브랜치)

## 8. 테스트

`tests/history-preservation.test.ts`

- 0006까지 적용한 DB에 기존 데이터를 넣고 전체 migration 적용 → 손실 없는 이관, 맥락 추측 없음, 이관 후 새 관측에도 이관 근거 유지
- 근거 보존과 채택 추적
- 스냅샷 불변
- 근거·milestone 삭제 거부
- 캐릭터 삭제 거부
- 7일 랭킹 제외 후 역사 기록 유지
- mock 초기화 허용
- 판정 사례: 미래, 순서 모순(낮은 레벨 사실·높은 레벨 사실·늦게 온 상위 레벨), 처음 관측 이전 달성(검토 대기 / 뒷받침되면 채택), 여러 근거, 검증 근거 대 커뮤니티 근거
