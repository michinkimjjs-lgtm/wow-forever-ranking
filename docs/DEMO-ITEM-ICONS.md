# 화면 미리보기(DEMO) 아이템 아이콘

가상 캐릭터의 착용 장비 예시(`lib/demo/demo-items.ts`)에 쓰는 아이템 아이콘입니다. 이미지는 `public/demo/items/{아이콘 이름}.jpg`에 둡니다(`components/demo/demo-item-icon.tsx`).

## 출처와 이용 조건

| 항목 | 내용 |
|---|---|
| 이미지 | World of Warcraft 게임 아이템 아이콘 78개 (예시 아이템 86개가 사용, 같은 아이콘을 쓰는 아이템이 있음) |
| 권리자 | Blizzard Entertainment, Inc. (WOWF.IO About: 게임 스크린샷·아이콘·게임 데이터는 Blizzard 소유) |
| 받은 곳 | WOWF.IO 에셋 서버 `https://wowf-assets.t3.tigrisfiles.io/icons/items/{아이콘 이름}.jpg` |
| 아이콘 이름 확인 | WOWF.IO 아이템 도감 `https://wowf.io/ko/items/{번호}`의 아이템 정보 (2026-11-01) |
| 이용 조건 | [Blizzard 법률 FAQ](https://www.blizzard.com/en-us/legal/28d5ebbf-c245-4408-8ba9-043dd5f056bf/legal-faq)의 팬 사이트 이미지 사용 조건: 비상업적 사용, 저작권·상표 고지 유지, 변경 금지, Blizzard가 언제든 철회 가능, 부적절한 콘텐츠 사이트 금지 (종족 초상화와 같은 조건, `docs/DEMO-RACE-PORTRAITS.md`) |
| 고지 | 사이트 하단의 Blizzard 저작권·상표 고지 (`components/layout/site-footer.tsx`) |

## 받은 방법

- 예시에 쓰는 아이템 86개의 도감 페이지만 2.5초 간격으로 한 번씩 읽어 아이콘 이름을 확인했습니다.
- 그 아이콘 78개만 2.5초 간격으로 내려받았습니다. 아이콘 묶음이나 다른 이미지는 받지 않았습니다.
- 받은 파일은 내용(JPEG 시작 바이트)·Content-Type(`image/jpeg`)·크기(56×56)를 확인했고, **변경 없이 그대로** 저장했습니다(크기 조정·자르기·재압축 없음).
- 화면에서는 로컬 파일만 씁니다. 외부 이미지 주소(핫링크)를 쓰지 않습니다.

## 표시 규칙

- 아이콘 테두리 색은 아이템 등급(고급=녹색, 희귀=파랑 등)입니다.
- 아이템 이름은 항상 텍스트로 함께 표시하므로 아이콘은 장식 이미지(`alt` 없음)입니다.
- 빈 장비 칸은 점선 틀만 보여 줍니다.

## 바꾸거나 내릴 때

- 예시 아이템을 바꾸면 그 아이템의 아이콘 파일도 함께 넣고, 쓰지 않는 파일은 지웁니다(`tests/page-demo.test.tsx`가 확인).
- Blizzard가 허락을 철회하거나 운영 형태(광고·후원·유료 기능)가 바뀌면 `public/demo/items/`를 지우고 다시 검토합니다.
