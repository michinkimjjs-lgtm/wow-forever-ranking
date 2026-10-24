# 운영 배포 (Vercel + Neon)

> 단계: 운영 배포 준비 (2026-10)
>
> 구성: GitHub `main` → Vercel 프로젝트 `foreverrank` → Neon PostgreSQL. 운영 데이터 영역은 `live`입니다.

## 1. Production 빌드의 DB 자동 초기화

`vercel.json`의 `buildCommand`가 `npm run build:vercel`을 실행합니다.

```text
npm run build:vercel
  = tsx scripts/production-db-init.ts   ← 운영 DB 초기화 (lib/deploy/production-db-init.ts)
    && npm run build                    ← 기존 빌드 그대로 (prebuild: Collector ZIP → next build)
```

실행 조건:

| 빌드 | 조건 | 동작 |
|---|---|---|
| 로컬 | `VERCEL`이 `1`이 아님 | DB에 접속하지 않고 건너뜀 → 기존 빌드 |
| Vercel Preview / Development | `VERCEL_ENV`가 `production`이 아님 | DB에 접속하지 않고 건너뜀 → 기존 빌드 |
| Vercel Production | `VERCEL_ENV=production` | 아래 순서로 초기화. 하나라도 실패하면 빌드 중단 |
| Vercel인데 `VERCEL_ENV`를 모름 | — | 빌드 중단 (Production인지 확인할 수 없음) |

Production 순서:

1. `APP_DATA_ENVIRONMENT`가 `live`인지 확인합니다. 아니면 중단합니다.
2. `DATABASE_URL_UNPOOLED`(Neon 직접 연결 주소)를 확인합니다.
   - 없거나, PostgreSQL 주소가 아니거나, 풀링 주소(`-pooler`)면 중단합니다.
   - `DATABASE_URL`로 대신하지 않습니다.
3. 초기화 잠금을 겁니다(`pg_advisory_lock`). 동시에 실행된 빌드가 함께 초기화하지 않습니다.
4. `database_identity`가 이미 있으면 확인합니다.
   - `[live]`가 아니면(예: `[beta]`, `[mock]`) **migration을 실행하지 않고** 중단합니다. 덮어쓰지 않습니다.
5. migration을 적용합니다(`db/migrations`). 이미 적용된 것은 건너뜁니다.
6. `database_identity`를 `[live]`로 설정합니다. 이미 `[live]`면 그대로 둡니다.
7. 검증합니다.
   - 식별 표식이 정확히 `[live]`인지
   - 적용된 migration 수가 저장소의 migration 수와 같은지
8. 성공하면 `npm run build`를 실행합니다.

## 2. 안전장치

- Mock seed(`db:seed`)는 실행하지 않습니다. 게임 데이터·테스트 데이터를 넣지 않습니다. 운영 DB는 빈 `live` 영역으로 시작합니다.
- 연결 주소와 비밀번호는 출력하지 않습니다. 오류 메시지에서도 지웁니다(`redactSecrets`).
- `.env` 파일을 읽지 않습니다. Vercel 환경변수만 씁니다.
- 실패하면 빌드가 중단됩니다.
  - 새 배포는 만들어지지 않고, 기존 Production 배포는 그대로 유지됩니다.
  - migration은 빌드 단계에서 실행되므로, 실행 중인 사이트를 직접 바꾸지 않습니다.
- 다시 배포해도 안전합니다. migration은 적용되지 않은 것만, 식별 표식은 그대로 둡니다.

## 3. Vercel 환경변수 (Production)

| 이름 | 값 | 사용처 |
|---|---|---|
| `DATABASE_URL` | Neon 풀링 연결 주소 | 실행 중인 사이트 |
| `DATABASE_URL_UNPOOLED` | Neon 직접 연결 주소 | 빌드 시 migration |
| `APP_DATA_ENVIRONMENT` | `live` | 빌드·실행 모두 |
| `SITE_URL` | `https://foreverrank.co.kr` | canonical, 공개 제출 Origin 검사 |
| `SUBMISSION_SECRET` | 32자 이상 임의 값 | 공개 제출·관리자 로그인 (선택) |
| `SUBMISSIONS_ADMIN_TOKEN` | 32자 이상 임의 값 | 관리자 화면 (선택) |
| `FEATURE_PUBLIC_SUBMISSIONS` | `on` | 공개 제출 (점검 후) |

- `VERCEL`, `VERCEL_ENV`는 Vercel이 자동으로 넣는 시스템 환경변수입니다.
- 비밀값은 저장소에 넣지 않습니다.

## 4. 수동 실행이 필요한 경우

Vercel 밖에서 초기화하려면 기존 명령을 씁니다.

```bash
DATABASE_URL=<직접 연결 주소> npm run db:migrate
APP_DATA_ENVIRONMENT=live DATABASE_URL=<직접 연결 주소> npm run db:init -- --allow=live
```
