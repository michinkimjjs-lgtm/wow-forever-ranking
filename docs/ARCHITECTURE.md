# 아키텍처 — Phase 1

## 1. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 웹 | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui 방식 컴포넌트(`components/ui`) |
| DB | PostgreSQL 16, Drizzle ORM, drizzle-kit 마이그레이션 |
| 테스트 | Vitest, PGlite(메모리 PostgreSQL. 실제 마이그레이션을 그대로 적용) |
| 캐시 | `CacheStore` 인터페이스 + 인메모리 구현 (P1에서 Redis 구현 추가) |

## 2. 데이터 흐름

```text
MockCharacterProvider (mock 배포 전용)       BlizzardProvider / AddonProvider (미구성)
            │
            ▼
lib/ingestion/ingest.ts  — 수집 파이프라인
  1. ingestion_records에 원본 저장
  2. 금지 필드(rank 등) 제거, 입력 스키마 검증
  3. dataEnvironment는 서버 설정이 부여
  4. 캐릭터 식별 (외부 ID → 자연 키 → 신규)
  5. 현재 상태 / 장착 장비 / 스냅샷 / level_milestones 갱신 (Gear Profile 적용)
            │
            ▼
PostgreSQL (트리거와 CHECK 제약으로 데이터 영역 보호)
            │
            ▼
lib/ranking/*  — 랭킹 엔진 (서버 계산)
lib/queries/*  — 검색, 캐릭터, 길드, 홈 조회
            │
            ▼
lib/server/services.ts — 서버 컨텍스트 + 캐시
            │
     ┌──────┴────────┐
     ▼               ▼
app/api/v1/*     app/**/page.tsx (서버 컴포넌트)
```

규칙:

- UI는 Provider나 외부 API를 직접 호출하지 않는다.
- UI 컴포넌트에는 랭킹 SQL이 없다. 페이지는 `lib/server/services.ts`만 사용한다.

## 3. 폴더 구조

```text
app/                    페이지와 API 라우트 (한국어 문자열 직접 사용 금지)
  api/v1/               REST API
components/             UI 컴포넌트 (ui/ = shadcn 방식 기본 컴포넌트)
config/                 버전 관리되는 설정 (게임 범위, 코드 목록, 랭킹 정책, Gear Profile)
db/                     Drizzle 스키마, 마이그레이션, DB 식별 표식
lib/
  api/                  요청 검증, 응답 형식, 직렬화
  cache/                캐시 인터페이스
  config/               설정 스키마 검증, 환경변수
  domain/               enum, 이름 정규화
  format/               KST 시간, 숫자 표시
  gear/                 장비 레벨 계산 (Gear Profile 기반)
  i18n/                 locale 접근
  ingestion/            수집 파이프라인
  mock/                 결정적 mock 데이터 생성기, seed
  queries/              검색 / 캐릭터 / 길드 / 홈 조회
  ranking/              랭킹 엔진 (level.ts, gear.ts, highest-item.ts, index.ts)
  server/               서버 컨텍스트, 서비스 계층
locales/ko/             한국어 UI 문자열
providers/              Provider 인터페이스와 구현
scripts/                db:migrate, db:init, db:seed
tests/                  Vitest 테스트
```

## 4. 데이터 영역 분리와 안전장치

명세서 §6.4의 안전장치를 다음과 같이 구현했다.

| 안전장치 | 구현 위치 |
|---|---|
| DB 식별 표식 | `database_identity` 테이블(단일 행, 변경·삭제 금지 트리거), `npm run db:init` |
| 쓰기 트리거 | 마이그레이션 `0002_data_environment_guards.sql`: 9개 게임 데이터 테이블 |
| CHECK 제약 | mock 영역 ⇔ mock 공급원 ⇔ MOCK 검증 상태 (`db/schema.ts`) |
| 부모-자식 영역 일치 | `(id, data_environment)` 복합 외래 키 |
| 앱 시작 검사 | `instrumentation.ts` → `verifyStartup()`, 그리고 요청마다 `getServerContext()` |
| Provider 등록 제한 | `providers/registry.ts` |
| Seed 이중 확인 | `lib/mock/seed.ts`: `APP_DATA_ENVIRONMENT=mock` + DB 표식 `{mock}` + `--confirm-mock` |
| 수집 파이프라인 | 영역은 서버 설정에서 부여. payload의 다른 영역 주장은 거부 |
| 조회 범위 | 모든 조회 함수가 `dataEnvironment`를 필수 인자로 받음 |
| 캐시 키 | `cacheKey(env, ...)`로 항상 영역 접두사 |
| 화면 표시 | mock 배포는 모든 페이지에 Mock 안내, `noindex` |

## 5. 설정

`config/` 아래 파일은 처음 사용할 때 `lib/config/schema.ts`(zod)로 검증한다. 잘못되면 예외가 나고 서버가 요청을 처리하지 않는다.

| 파일 | 내용 |
|---|---|
| `config/game-scopes.ts` | 영역별 region / gameMode / 최대 레벨. beta / live는 미확정이라 `null` |
| `config/codes.ts` | 직업 / 종족 / 진영 / 품질 코드. mock 임시 값 |
| `config/ranking.ts` | 오래된 데이터 기준(7일), 랭킹 포함 검증 상태, 페이지 크기, 스냅샷 주기(24시간) |
| `config/gear-profiles/*` | Gear Profile. 현재 `mock-provisional`(PROVISIONAL) 하나뿐 |

환경변수:

- `APP_DATA_ENVIRONMENT` (필수)
- `DATABASE_URL` (필수)
- `SITE_URL`

## 6. 렌더링과 캐시

- 모든 페이지는 요청 시점에 서버에서 렌더링한다(`force-dynamic`). 빌드할 때 DB가 필요 없다.
- 랭킹과 홈 데이터는 30초 동안 인메모리 캐시에 보관한다.
- 필터는 자바스크립트 없이 동작하는 GET 폼이다.

## 7. 실행 방법

```bash
npm install
cp .env.example .env              # APP_DATA_ENVIRONMENT=mock, DATABASE_URL=mock 전용 DB
docker compose up -d              # 로컬 PostgreSQL (이미 있으면 생략)
npm run db:migrate                # 스키마, 트리거 적용
npm run db:init -- --allow=mock   # DB 식별 표식 설정 (한 번만)
npm run db:seed -- --confirm-mock # mock 데이터 생성 (몇 번을 실행해도 결과가 같다)
npm run dev                       # http://localhost:3000
```

검증 순서는 다음과 같다.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
