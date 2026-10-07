# Forever Rank — WoW 포에버 랭킹 · Armory

WoW: Forever 전용 랭킹·Armory 웹사이트입니다. 현재는 **Mock 데이터만** 사용하는 Phase 1 단계입니다.

- 설계 기준: [`WOW_FOREVER_RANKING_SPEC.md`](./WOW_FOREVER_RANKING_SPEC.md), 개발 규칙: [`CLAUDE.md`](./CLAUDE.md)
- 문서: [`docs/PRD.md`](./docs/PRD.md), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/DATA-SPEC.md`](./docs/DATA-SPEC.md), [`docs/RANKING-RULES.md`](./docs/RANKING-RULES.md)

## 실행

```bash
npm install
cp .env.example .env
docker compose up -d               # 로컬 PostgreSQL (이미 있으면 생략)
npm run db:migrate
npm run db:init -- --allow=mock    # DB 식별 표식 (한 번만)
npm run db:seed -- --confirm-mock  # mock 데이터 생성
npm run static-data:import -- --mock --confirm-mock --commit  # (선택) mock 정적 게임 데이터셋
npm run dev
```

## 검증

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
