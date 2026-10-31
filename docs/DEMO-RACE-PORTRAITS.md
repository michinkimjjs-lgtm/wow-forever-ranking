# 홈 DEMO 종족 초상화

홈페이지 기능 미리보기(DEMO)의 캐릭터 초상화 이미지 규칙입니다. 이미지는 `public/demo/races/`에 둡니다. 얼굴은 종족, 테두리 색은 직업을 나타냅니다(`components/home/demo-portrait.tsx`).

## 필요한 이미지

| 종족 | 파일 이름 | 상태 |
|---|---|---|
| 인간 | `human.webp` | 확보 (2026-10-31) |
| 드워프 | `dwarf.webp` | 확보 (2026-10-31) |
| 나이트 엘프 | `night-elf.webp` | 확보 (2026-10-31) |
| 노움 | `gnome.webp` | 확보 (2026-10-31) |
| 오크 | `orc.webp` | 확보 (2026-10-31) |
| 언데드 | `undead.webp` | 확보 (2026-10-31) |
| 타우렌 | `tauren.webp` | 확보 (2026-10-31) |
| 트롤 | `troll.webp` | 확보 (2026-10-31) |

- 정사각형, 최소 128×128px(화면 표시는 약 44px). 얼굴이 가운데에 오도록 자른 흉상.
- 형식: WebP 또는 PNG. 한 장에 50KB 이하 권장.
- 배경은 어둡거나 투명. 이미지 자체에 테두리를 넣지 않습니다(테두리는 직업 색으로 코드가 그림).

## 넣을 수 있는 이미지

- 출처와 라이선스를 확인할 수 있고, 이 사이트(공개 웹사이트)에서 쓸 수 있는 이미지만 넣습니다.
  - 예: CC0, CC BY(출처 표기), 직접 제작했거나 제작자에게 사용 허락을 받은 이미지
- Blizzard 게임 원본 이미지는 Blizzard 공식 팬 사이트 정책 원문으로 허용 범위(공개 웹사이트 표시, 변경·크롭 제한, 필요한 고지)를 확인한 경우에만 넣습니다. Forever Rank는 비상업적 팬 사이트로 운영하지만, 그것만으로 사용이 자동 허용되지는 않습니다(PR #10 `docs/EXTERNAL-DATA-COLLECTION.md` §4·§6.2).
- **넣지 않는 이미지:** 이용 조건을 확인하지 못한 이미지, WOWF.IO 등 다른 사이트가 직접 만들거나 편집한 이미지(권리자 허락 없음), 출처를 알 수 없는 이미지, AI 생성 이미지·임의 그림, 외부 주소(핫링크).

## 수집기 (`npm run portraits:collect`)

`scripts/collect-race-portraits.ts`가 `lib/demo/race-portrait-sources.ts`의 8개 항목을 읽어 내려받습니다(`lib/image-collector/`).

- 이용 조건이 확인된 항목(`rights.status = "CONFIRMED"`)만 받습니다. 확인 항목: 원본 페이지, 이미지 주소, 허용 호스트, 권리자, 이용 조건과 근거 주소, 비상업 사용 가능 여부, 출처 표시, 확인 날짜.
- robots.txt를 확인하고, 같은 호스트 요청 사이에 3초 간격을 둡니다.
- 받은 파일은 내용으로 형식(PNG·JPEG·WebP·GIF)과 손상 여부를 검사하고, Content-Type·확장자·최소 해상도를 확인합니다.
- 결과(최종 주소, 호스트, 형식, 해상도, 용량, SHA-256, 받은 시각)는 `lib/demo/race-portraits.lock.json`에 기록합니다. 다시 실행하면 해시가 같은 파일은 받지 않습니다.
- 실행 로그는 `logs/image-collector/*.jsonl`에 남깁니다(저장소에 올리지 않음).
- 401·403·429, CAPTCHA·봇 차단 화면을 만나면 즉시 전체 실행을 멈추고 종료 코드 2로 끝납니다. 브라우저 위장, 쿠키·로그인, 프록시·IP 변경, 차단 후 재시도는 하지 않습니다.
- 허용 호스트 밖의 주소와 리다이렉트는 따라가지 않습니다. 8개 이미지 외에는 수집하지 않습니다.

## 네트워크 진단 (2026-10-31, Claude Code 클라우드 세션)

| 항목 | 결과 |
|---|---|
| 클라우드 환경 | `Default` ("trusted network access" — 허용 목록 방식) |
| 세션 | 2026-10-06에 만든 기존 세션 (환경 설정 변경 뒤 새로 만든 세션이 아님) |
| `wowf.io`, `www.blizzard.com`, `blizzard.com` | 로컬 에이전트 프록시(127.0.0.1)로 보낸 `CONNECT host:443`에 **HTTP 403** (`Content-Type: text/plain`, 본문 65~74바이트). 프록시 기록: "gateway answered 403 to CONNECT (policy denial or upstream failure)" |
| DNS | 컨테이너에서 직접 조회하지 않음(프록시가 처리). `getent hosts` 응답 없음 |
| 대상 서버 응답 | 없음. 터널이 열리지 않아 대상 서버까지 요청이 가지 않았으므로 상태 코드·응답 헤더·서버·리다이렉트는 **알 수 없음** |
| 비교 | `registry.npmjs.org`는 200 (허용 목록 호스트는 정상) |
| 판단 | 403은 대상 서버가 아니라 **Claude Cloud 송신 프록시의 정책 차단**입니다. 환경에서 도메인을 허용한 설정이 이 실행 중 세션에는 적용되지 않은 것으로 보입니다(확인 불가). 우회하지 않았습니다 |

다음 중 한 곳에서 `npm run portraits:collect`를 실행합니다(수집 대상의 이용 조건을 먼저 채워야 받습니다).

1. 도메인 허용(또는 Full 네트워크)을 저장한 뒤 **새로 만든** 클라우드 세션. 운영자 승인 후 진행합니다.
2. 로컬 Claude Code 또는 개발 PC: 저장소를 받아 `npm ci` 후 실행. 받은 이미지와 `race-portraits.lock.json`을 커밋합니다.
3. 자체 호스팅 실행 환경(CI 러너 등): 위와 같음. 외부 접속 정책이 허용하는지 먼저 확인합니다.

## 등록 절차

1. 원문을 확인해 `lib/demo/race-portrait-sources.ts`에 이미지 주소·권리자·이용 조건을 채우고 `CONFIRMED`로 바꾼 뒤 `npm run portraits:collect`로 받습니다. 직접 받은 파일이라면 `public/demo/races/`에 넣습니다(위 파일 이름).
2. `lib/demo/race-portraits.ts`의 `DEMO_RACE_PORTRAITS`에서 해당 종족의 `null`을 `{ file, source, author, license }`로 바꿉니다.
3. 아래 "출처" 표에 같은 내용을 적고, 위 표의 상태를 "확보"로 바꿉니다.
4. `npx vitest run tests/home-demo.test.tsx`: 등록한 파일이 실제로 있는지, 출처·라이선스가 비어 있지 않은지 검사합니다.

등록하지 않은 종족은 이미지 없이 빈 초상화 틀(직업 색 테두리)만 표시하고, 종족 이름은 텍스트로 표시합니다.

## 출처

| 파일 | 원본 | 권리자 | 이용 조건 |
|---|---|---|---|
| `human.webp` | WoW 게임 아이콘 `achievement_character_human_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_human_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `dwarf.webp` | WoW 게임 아이콘 `achievement_character_dwarf_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_dwarf_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `night-elf.webp` | WoW 게임 아이콘 `achievement_character_nightelf_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_nightelf_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `gnome.webp` | WoW 게임 아이콘 `achievement_character_gnome_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_gnome_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `orc.webp` | WoW 게임 아이콘 `achievement_character_orc_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_orc_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `undead.webp` | WoW 게임 아이콘 `achievement_character_undead_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_undead_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `tauren.webp` | WoW 게임 아이콘 `achievement_character_tauren_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_tauren_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |
| `troll.webp` | WoW 게임 아이콘 `achievement_character_troll_male` — `https://wowf-assets.t3.tigrisfiles.io/sprites/common.26c420c8c4.svg#races-achievement_character_troll_male` | Blizzard Entertainment, Inc. | Blizzard 법률 FAQ 팬사이트 이미지 조건 |

### 확보 방법 (2026-10-31)

- 참고 페이지: `https://wowf.io/en/level-up?f=horde&r=undead`의 종족 선택 영역
- 이미지 주소: WOWF.IO 에셋 서버의 아이콘 묶음 `common.26c420c8c4.svg` 1개만 받았습니다(89,857바이트). 이 파일은 WebP 원본 1장(600×240)과 아이콘별 표시 영역(`<view>`) 목록입니다.
- 각 종족의 표시 영역(56×56)을 잘라 **픽셀 변경 없이** 무손실 WebP로 저장했습니다(원본과 픽셀 일치 검증). 크기 조정·색 보정·편집은 하지 않았습니다. 화면에서 44px로 보이는 것은 브라우저 표시 크기입니다.
- 사이트 전체는 수집하지 않았습니다.

### 권리와 이용 조건

- 권리자: Blizzard Entertainment. WOWF.IO About 페이지도 "Game screenshots, icons and game data are the property of Blizzard Entertainment"라고 밝힙니다. WOWF.IO 자체 제작 이미지가 아닙니다.
- [Blizzard 법률 FAQ](https://www.blizzard.com/en-us/legal/28d5ebbf-c245-4408-8ba9-043dd5f056bf/legal-faq)의 "팬사이트에서 Blizzard 이미지·화면을 웹 페이지에 써도 되는가" 질문에 대한 답: "Yes, within certain limits". 조건 요약:
  - 비상업적 사용 (Forever Rank: 광고·후원·유료 기능·이용료 없음, PR #10 §6.2)
  - 저작권·상표 고지 유지 → 사이트 하단에 [Blizzard 공식 고지](https://www.blizzard.com/en-us/legal/5515ca11-1c96-42a0-b853-e7876a0d19bf/copyright-notices) World of Warcraft 문구 원문 표시(`lib/legal/blizzard-notice.ts`)
  - 변경 금지 → 원본 픽셀 그대로
  - Blizzard가 언제든 철회 가능 → 철회되면 `lib/demo/race-portraits.ts`에서 등록을 지우고 파일을 삭제합니다(화면은 빈 틀로 돌아감)
  - 부적절한 콘텐츠(해킹·치트 등) 사이트에서 사용 금지
- 남는 해석 문제: 같은 답의 라이선스 문구가 "home, noncommercial and personal use"라고 적고 있어, 공개 팬사이트 표시가 그 범위에 정확히 들어가는지는 해석의 여지가 있습니다. 질문 자체가 팬사이트 웹 페이지 사용을 묻고 "Yes"로 답한 점을 근거로 적용했습니다. 광고·후원·유료 기능을 도입하면 다시 검토합니다.
