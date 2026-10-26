# 역사 기록 보존 (Phase 1)

> 작성일: 2026-10-26 (재판정·연결 제약 보강 반영) · 관련: 명세서 §8.3, §8.5, §14.12, `docs/DATA-SPEC.md` §4, `docs/DATA-SOURCE-POLICY.md` §8·§11

Forever Rank는 현재 순위뿐 아니라 최초 달성 같은 역사 기록을 쌓는다. 현재 상태가 바뀌거나 오래된 캐릭터가 랭킹에서 빠져도 역사 기록은 사라지면 안 된다. Phase 1은 레벨 달성 기록과 스냅샷을 그 기반으로 만든다.

## 1. 계층

| 계층 | 테이블 | 규칙 |
|---|---|---|
| 현재 상태 | `characters`, `character_items` | 바뀔 수 있다. 랭킹과 7일 오래된 데이터 규칙은 여기에만 적용한다 |
| 관측 원본 | `ingestion_records`, `character_snapshots` | 스냅샷은 추가만 한다(수정 금지, 실제 영역 삭제 금지) |
| 레벨 달성 근거 | `level_milestone_evidence` | 관측마다 추가만 한다(수정 금지, 실제 영역 삭제 금지) |
| 주장 판정 이력 | `level_milestone_claim_assessments` | 판정이 생기거나 바뀔 때마다 추가만 한다(수정 금지, 실제 영역 삭제 금지) |
| 현재 채택 기록 | `level_milestones` | 근거와 현재 판정에서 다시 고르는 결과. 수집 코드가 갱신한다(삭제만 금지) |

7일 규칙은 랭킹 조회 조건일 뿐이며, 역사 기록 테이블을 지우거나 걸러 저장하지 않는다.

## 2. 레벨 달성 근거 (`level_milestone_evidence`)

관측 한 번이 만드는 근거:

- 관측한 레벨 1행: `observation_basis = FIRST_OBSERVED`
- 건너뛴 레벨 1행씩: `INFERRED`. 새 관측과 시간상 바로 앞·뒤 관측 사이를 본다. 그래서 늦게 도착한 옛 관측도 같은 추론 근거를 만든다. 추론 근거의 출처(공급원·검증 상태·원본·스냅샷)는 더 높은 레벨을 관측한 근거에서 가져온다.

| 컬럼 | 내용 |
|---|---|
| `character_id`, `data_environment`, `level` | 대상 |
| `observation_basis` | 주장 없이 관측 자체가 뒷받침하는 근거: `FIRST_OBSERVED` / `INFERRED`. `SOURCE_REPORTED`는 저장하지 않는다(CHECK) |
| `claimed_reached_at` | 공급원이 보낸 달성 시각 주장. 판정과 관계없이 받은 그대로 |
| `receipt_claim_status`, `receipt_claim_reasons` | **받은 시점의** 판정과 이유. 이후 판정이 바뀌어도 이 행은 그대로다 (§3) |
| `legacy_timing_basis` | 이관 행의 원래 `level_milestones.timing_basis` (이관 행만) |
| `observed_at`, `previous_observed_at` | 관측 시각, 받을 때 알던 직전(더 낮은 레벨) 관측 시각 |
| `received_at` | 서버 수신 시각 (이관 행은 원본이 연결된 경우만) |
| `data_source`, `verification_status`, `source_build` | 출처 |
| `snapshot_id`, `ingestion_record_id` | 스냅샷(그 관측에서 저장된 경우)과 원본 연결 |
| `character_name`, `region`, `game_mode`, `class_code`, `race_code`, `faction_code`, `guild_id` | 관측 당시 맥락. 관측에 없던 값은 null(현재 캐릭터 값을 빌려 쓰지 않는다) |
| `origin` | `INGESTED`(수집) / `MIGRATED`(기존 milestone에서 이관) |

## 3. 달성 시각 주장 판정과 재판정

### 3.1 왜 판정 이력 테이블이 필요한가

- 판정은 알려진 사실에 따라 달라진다. 받은 시점에만 판정하고 근거 행에 고정하면 결과가 **도착 순서에 따라 달라진다.**
  - 예: 낮은 레벨 관측이 먼저 오면 인정되고, 나중에 오면 검토 대기로 남는다.
  - 예: 인정됐던 주장과 모순되는 관측이 나중에 와도 채택이 유지된다.
- 근거 행은 수정할 수 없으므로 바뀐 판정을 그 행에 쓸 수 없다. 그래서 판정을 별도 테이블에 추가하는 방식으로 남긴다.

### 3.2 `level_milestone_claim_assessments`

| 컬럼 | 내용 |
|---|---|
| `evidence_id`, `character_id`, `level`, `data_environment` | 판정 대상 근거. 근거와 같은 캐릭터·레벨·영역이어야 한다(복합 FK) |
| `seq` | 자동 증가 순서. 근거별로 가장 큰 값이 현재 판정 |
| `status`, `reasons` | `ACCEPTED` / `NEEDS_REVIEW` / `CONFLICT` / `REJECTED`와 이유 코드 |
| `kind` | `RECEIPT`(받은 시점) / `REASSESSMENT`(새 사실로 바뀜) / `MIGRATED`(기존 판단 이관) |
| `assessed_at`, `ingestion_record_id` | 판정 시각과 판정을 일으킨 원본 |

판정이 바뀔 때만 행을 추가한다. 같은 판정이 반복되면 쓰지 않는다.

### 3.3 판정 규칙 (`lib/ingestion/milestone-evidence.ts` `evaluateClaims`)

관측이 들어올 때마다 그 캐릭터의 **모든 주장**을 지금까지 알려진 사실 전체로 다시 판정한다. 사실은 같은 캐릭터의 근거·스냅샷·마지막 상태뿐이다. 판정 대상과 같거나 더 높은 신뢰 수준의 관측만 쓴다.

| 판정 | 조건 |
|---|---|
| `REJECTED` | 달성 시각 > 그 관측 시각 |
| `CONFLICT` | 더 낮은 레벨로 관측된 시각보다 이름 / 더 높은 레벨을 관측한 시각보다 늦음 / 인정된 다른 주장(같거나 높은 신뢰)과 달성 순서가 모순(`CLAIM_ORDER_CONFLICT`) |
| `NEEDS_REVIEW` | 커뮤니티 제출·미검증이고, 그 시각 이전에 더 낮은 레벨로 관측한 기록이 없음 |
| `ACCEPTED` | 그 밖. `VERIFIED`·`LOG_VERIFIED`·`MOCK`은 뒷받침 관측이 없어도 됨 |

- **처음 관측 이전의 달성:** 사이트가 처음 관측하기 전에 달성했다는 주장은 거부하지 않는다. 신뢰할 수 있는 하한(게임 시작일 등)이 확인되지 않았으므로(명세서 §30-28) 날짜를 고정하지 않고 `NEEDS_REVIEW`로 둔다.
- **나중에 뒷받침되는 경우:** 더 낮은 레벨 관측이 늦게 도착해 주장을 뒷받침하면 `REASSESSMENT`(`ACCEPTED`)가 추가되고, 채택 기록이 `SOURCE_REPORTED`로 바뀐다.
- **나중에 모순이 발견되는 경우:** 인정됐던 주장과 모순되는 사실이 늦게 도착하면 `REASSESSMENT`(`CONFLICT`)가 추가되고, 채택 기록이 관측 근거로 돌아간다. 이관 기록도 같다.
- **검토 대기 주장의 힘:** 검토 대기 주장은 인정된 주장을 충돌로 만들지 못한다. 근거 없는 주장 하나로 다른 기록을 무효로 만들 수 없게 하기 위해서다.
- **이관 행:** 기존 판단을 유지하므로 뒷받침 요건은 새로 적용하지 않는다. 모순 검사는 받는다.
- **순서 모순 관측:** 새 관측 자체가 기존 관측과 달성 순서가 모순되면(더 이른 시각에 더 높은 레벨, 더 늦은 시각에 더 낮은 레벨) 관측 전체를 `IDENTITY_CONFLICT`로 기록하고 근거를 만들지 않는다.
- **후속 범위:** 검토 대기·충돌 판정을 관리자가 확인하는 화면은 다음 단계 범위다. 관리자 판정도 판정 이력에 새 행으로 추가하는 방식으로 설계한다.

## 4. 현재 채택 규칙 (`chooseAdoptedEvidence`)

1. 신뢰 수준(`VERIFIED` 4 > `LOG_VERIFIED` 3 > `COMMUNITY_SUBMITTED` 2 > `UNVERIFIED` 1)이 가장 높은 근거들만 후보로 한다.
2. 시간 근거: 현재 판정이 `ACCEPTED`인 주장이 있는 근거 = `SOURCE_REPORTED` > `FIRST_OBSERVED` > `INFERRED`
3. 더 이른 시각 → 더 늦은 직전 관측(좁은 구간) → 출처·빌드·관측 시각 → id. 저장 순서를 쓰지 않는다.

- `first_observed_at`: 같은 신뢰 수준 근거 중 가장 이른 관측 시각
- `previous_observed_at`: 그 시각 이전에 더 낮은 레벨로 관측된 가장 늦은 시각
- 같은 근거·판정 집합이면 도착 순서와 관계없이 같은 결과다. 테스트에서 두 관측의 역순, 세 관측의 6가지 순서를 모두 확인한다.

## 5. DB가 강제하는 연결 무결성

| 제약 | 효과 |
|---|---|
| `level_milestone_evidence_id_scope` UNIQUE (id, character_id, level, data_environment) | 복합 FK의 대상 |
| `level_milestones_evidence_fk` (evidence_id, character_id, level, data_environment) → 근거 | 채택 기록은 같은 캐릭터·레벨·영역의 근거만 가리킨다. `level_milestones`가 (캐릭터, 레벨)에 하나뿐이므로 한 근거를 두 채택 기록이 공유할 수 없다 |
| `level_milestone_claim_assessments_evidence_fk` | 판정 기록도 같은 캐릭터·레벨·영역의 근거만 가리킨다 |
| `level_milestones_claim_assessment_fk` (claim_assessment_id, evidence_id, claim_assessment_status) → 판정 | `SOURCE_REPORTED` 채택은 **같은 근거의** 판정만 가리킨다 |
| `level_milestones_claim_assessment` CHECK | `SOURCE_REPORTED` ⇔ 판정 연결 있음, 연결된 판정은 `ACCEPTED`만 |
| `level_milestone_evidence_migrated_uq` 부분 UNIQUE (character_id, level) WHERE origin = MIGRATED | 이관 근거는 캐릭터·레벨당 하나 |

"최신 판정을 가리키는지"는 DB로 강제하지 않는다. 수집 코드가 매 관측마다 다시 계산해 맞춘다.

## 6. 삭제 방지와 삭제 요청

**DB 보호 (migration 0008)**

- `character_snapshots`, `level_milestones`의 캐릭터 FK를 `ON DELETE CASCADE`에서 `ON DELETE RESTRICT`로 바꿨다. 근거 테이블은 처음부터 RESTRICT다. 역사 기록이 있는 캐릭터는 삭제할 수 없다.
- 행 트리거
  - 근거·판정 이력·스냅샷: 수정 금지, 실제 영역 삭제 금지
  - milestone: 실제 영역 삭제 금지 (수정은 채택 결과 갱신을 위해 허용)
- 네 테이블 모두 `TRUNCATE` 금지
- mock 영역은 개발용 초기화를 위해 행 삭제를 허용한다(`npm run db:seed`). 삭제 순서: milestone → 판정 이력 → 근거 → 스냅샷

**삭제 요청 (설계만, 이번 범위에서 구현하지 않음)**

- 역사 기록 자체는 지우지 않는다. 공개 표시를 숨기거나, 표시할 때 이름 등 식별 정보를 비공개로 바꾼다.
- 별도 표시 제어 테이블(예: `character_visibility`)을 추가하고, 화면·API가 그 값을 따르게 한다. 기존 테이블을 다시 설계하지 않는다.
- 원본 payload 삭제·익명화가 필요하면 `ingestion_records`에서 처리한다. 역사 테이블은 원본 id만 가리킨다.
- 익명화 때문에 근거·스냅샷 행을 수정해야 한다면, 트리거를 끄지 않고 정해진 함수와 권한만 허용하는 별도 migration으로 설계한다. 이 정책은 확정되지 않았다(`docs/DATA-SOURCE-POLICY.md` §8).

## 7. migration과 기존 데이터

| migration | 내용 | 기존 데이터 영향 |
|---|---|---|
| `0007_level_milestone_evidence` | 근거·판정 이력 테이블과 enum, 영역 트리거, `level_milestones`의 연결 컬럼 3개·복합 FK, 기존 milestone 이관, 이관 뒤 판정 CHECK 추가 | milestone 1행마다 근거 1행. `SOURCE_REPORTED`였으면 이관 판정 1행. 연결 컬럼만 채우고 다른 컬럼과 `updated_at`은 그대로 |
| `0008_history_delete_protection` | FK RESTRICT, 수정·삭제·TRUNCATE 금지 트리거 | 데이터 변경 없음 |

**이관 규칙**

- `legacy_timing_basis`에 원래 값을 보존한다.
- `observation_basis`
  - `FIRST_OBSERVED` / `INFERRED`는 그대로 옮긴다.
  - `SOURCE_REPORTED`였던 행은 `first_observed_at`이 직접 관측인지 추론인지 알 수 없어 낮은 쪽인 `INFERRED`로 둔다. 달성 시각 주장은 이관 판정(`ACCEPTED`, `MIGRATED`)으로 유지되므로 이관 직후 채택 결과는 바뀌지 않는다.
- `reached_at`(→ `claimed_reached_at`), `first_observed_at`(→ `observed_at`), `previous_observed_at`, 출처·검증 상태·빌드·스냅샷·원본 연결을 그대로 옮긴다.
- 맥락은 연결된 스냅샷이 `first_observed_at`과 같은 관측일 때만 옮긴다. region / game_mode는 `characters`에서, 서버 수신 시각은 원본이 연결된 경우에만 채운다.
- **이관 후 첫 관측:** 그 캐릭터의 이관 기록도 다시 판정한다. 기존 기록이 알려진 관측과 모순되면 `CONFLICT`로 재판정되어 채택에서 빠진다. 기존 데이터가 서로 모순될 때만 일어난다.
- 이관 행 하나는 기존 milestone의 여러 관측이 합쳐진 값일 수 있다. 기존 구조가 개별 관측을 남기지 않았기 때문이며, 원본 `ingestion_records`는 남아 있다.

**운영 DB:** 2026-10-26 기준 운영 DB에는 실제 캐릭터 데이터가 없는 것으로 보고되었다(확인은 운영자 몫). 병합하면 Vercel Production 빌드가 두 migration을 자동 적용한다(`docs/DEPLOYMENT.md`).

**PR #7과의 순서 (migration 번호 충돌 해결):** PR #7도 `0007_submissions_user_submission_source`를 추가하므로 번호가 겹친다. 아래 순서로 처리한다.

1. PR #8(이 작업)을 먼저 병합한다.
2. PR #7 작업 브랜치를 병합된 main 기준으로 갱신한다. 다른 사람이 쓰는 브랜치이므로 rebase·force push 대신 main을 병합(merge commit)한다.
3. migration 기록 파일 충돌(`db/migrations/meta/_journal.json`, `db/migrations/meta/0007_snapshot.json`)은 main의 기록을 기준으로 해결한다(`git checkout --theirs` 등으로 main 쪽 선택).
4. PR #7의 기존 `db/migrations/0007_submissions_user_submission_source.sql`을 제거한다.
5. `npx drizzle-kit generate --name submissions_user_submission_source`를 실행해 새 migration(`0009_submissions_user_submission_source.sql`)과 기록 파일을 생성한다. `db/schema.ts`는 병합 결과(두 PR의 변경 모두 포함)를 그대로 쓴다.
6. 원래 SQL 맨 위에 있던 설명 주석 두 줄을 새 파일 맨 위에 복원한다.
   ```sql
   -- 웹 직접 등록(user_submission)을 제출 검토 표에 보관할 수 있도록 출처 제약을 넓힌다.
   -- 기존 행은 모두 addon이므로 바뀌지 않는다. 데이터 삭제·변경 없음 (docs/DATA-COLLECTION-STRATEGY.md §2).
   ```
7. 명세서 §30에서 번호가 겹치는 28번 이후 항목을 다시 정리한다. 이 작업의 28번(레벨 달성 시각 하한)은 그대로 두고, PR #7이 추가한 항목(Blizzard 보존 조건, 발견 API, Battle.net 지역 매핑)을 29~31번으로 옮긴다.
8. 확인한다.
   - 생성된 SQL이 원래 PR #7 SQL과 같은 두 문장(`character_submissions_source` 제약을 지우고 `data_source IN ('addon', 'user_submission')`으로 다시 추가)인지
   - `_journal.json`이 0007 → 0008 → 0009 순서이고, 0009의 기록 시각(`when`)이 0008보다 늦은지
   - `npx drizzle-kit check`, 타입 검사, 린트, 전체 테스트(특히 `tests/production-db-init.test.ts`의 migration 수 검사)가 통과하는지

파일 이름만 0009로 바꾸면 안 된다. 원래 기록 시각이 0008보다 이르기 때문에, drizzle이 이미 0008까지 적용된 운영 DB에서 이 migration을 건너뛴다. 그러면 Production 빌드가 migration 수 검사에서 멈춘다(2026-10-26 재현 확인). 반대로 PR #7을 먼저 병합하면 이 작업의 손으로 작성한 이관·트리거 SQL을 다시 생성해야 하므로 권장하지 않는다.

## 8. 범위 밖 (후속 작업)

- 월드 퍼스트·길드 퍼스트 판정 테이블과 화면
- 검토 대기·충돌 판정의 관리자 확인 화면
- 보스 처치·공격대 참가자
- 삭제 요청 숨김 테이블, 순위 이력
- Blizzard API 연결과 30일 만료 처리. 만료 대상은 Blizzard 출처 원본·근거로 한정하고, 판정 기록은 "근거 만료"로 남기는 방향(`docs/DATA-COLLECTION-STRATEGY.md` §4.3, 별도 브랜치)

## 9. 남은 순서 의존성

- **식별 충돌로 거부되는 관측:** 서로 모순되는 두 관측 중 어느 쪽이 거부되는지는 도착 순서에 따라 다르다. 먼저 온 쪽이 남는다. 어느 쪽도 자동 채택하지 않고 원본은 보관되므로 검토 화면에서 다룬다.
- **근거 행의 기록 값:** `previous_observed_at`·`receipt_claim_status`는 받은 시점의 값이라 도착 순서에 따라 다를 수 있다. 채택 결과와 현재 판정은 같다.

## 10. 테스트

`tests/history-preservation.test.ts`

- **이관:** 0006 상태 DB에 기존 데이터를 넣고 전체 migration 적용 → 손실 없는 이관, 원래 시간 근거 보존, 이관 판정 연결, 맥락 추측 없음, 이관 후 새 관측, 모순된 이관 기록의 재판정
- **DB 연결 제약:** 다른 캐릭터·다른 레벨 근거 연결 거부, 이관 근거 중복 거부, 다른 근거 판정 연결 거부, ACCEPTED가 아닌 판정 연결 거부, 판정 기록 수정·삭제 거부
- **빈 DB:** 0000부터 전체 migration 적용, 보호 제약·인덱스 생성
- **보존:** 근거 보존과 채택·판정 추적, 스냅샷 불변, 근거·판정·milestone 삭제 거부, 캐릭터 삭제 거부, 7일 랭킹 제외 후 보존, mock 초기화 허용
- **판정:** 미래, 순서 모순(낮은 레벨 사실, 늦게 온 상위 레벨, 시간 사이에 낀 낮은 레벨), 처음 관측 이전 달성(검토 대기 → 나중에 뒷받침되면 재판정 채택), 나중에 발견한 모순(인정 → 충돌로 재판정), 여러 근거, 검증 근거 대 커뮤니티 근거
- **도착 순서 무관:** 두 관측 역순(주장, 건너뛴 레벨), 세 관측 6가지 순서
