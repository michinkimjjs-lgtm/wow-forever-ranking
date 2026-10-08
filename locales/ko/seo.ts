export const seo = {
  suffix: "Forever Rank",
  home: {
    title: "WoW 포에버 랭킹 | Forever Rank",
    description: "WoW 포에버 캐릭터의 레벨, 장비, 최고 아이템 랭킹과 캐릭터 Armory를 확인하세요.",
  },
  level: {
    title: "WoW 포에버 레벨 랭킹 | Forever Rank",
    description: "WoW 포에버 캐릭터 레벨 랭킹. 같은 레벨이면 먼저 도달한 캐릭터가 앞 순위입니다.",
  },
  gear: {
    title: "WoW 포에버 장비 랭킹 | Forever Rank",
    description: "WoW 포에버 캐릭터의 평균 장비 레벨 랭킹입니다.",
  },
  "highest-item": {
    title: "WoW 포에버 최고 아이템 랭킹 | Forever Rank",
    description: "WoW 포에버 캐릭터가 착용한 최고 아이템 레벨 랭킹입니다.",
  },
  characterSearch: {
    title: "WoW 포에버 캐릭터 검색 | Forever Rank",
    description: "WoW 포에버 캐릭터를 이름으로 검색하고 Armory 정보를 확인하세요.",
  },
  character: {
    title: "{name} - WoW 포에버 캐릭터 Armory | Forever Rank",
    description: "{name} 캐릭터의 레벨, 장비, 랭킹 정보입니다.",
  },
  guilds: {
    title: "WoW 포에버 길드 목록 | Forever Rank",
    description: "WoW 포에버 길드 목록과 길드별 캐릭터 정보를 확인하세요.",
  },
  guild: {
    title: "{name} - WoW 포에버 길드 | Forever Rank",
    description: "{name} 길드의 캐릭터 수, 최고 레벨, 최고 장비 레벨 정보입니다.",
  },
  stats: {
    title: "WoW 포에버 통계 | Forever Rank",
    description: "WoW 포에버 캐릭터 통계 화면은 준비 중입니다.",
  },
  submit: {
    title: "캐릭터 데이터 제출 | Forever Rank",
    description: "Forever Rank Collector로 만든 WoW 포에버 캐릭터 Export 파일을 제출하고 커뮤니티 랭킹 등록을 요청합니다.",
  },
  contribute: {
    title: "내 캐릭터 랭킹 등록 | Forever Rank",
    description: "WoW 포에버 캐릭터를 Forever Rank 랭킹에 등록하는 방법. Collector 다운로드부터 파일 제출, 검토 후 반영까지 5단계로 안내합니다.",
  },
  contributeDownload: {
    title: "Forever Rank Collector 다운로드 | Forever Rank",
    description: "내 WoW 포에버 캐릭터 정보를 파일로 저장하는 Forever Rank Collector 애드온. 버전, 파일 크기, SHA-256, 수집 범위를 확인하세요.",
  },
  contributeInstall: {
    title: "Collector 설치 방법 | Forever Rank",
    description: "Forever Rank Collector 애드온을 WoW 포에버 애드온 폴더에 설치하고 Export 파일을 만드는 순서를 단계별로 안내합니다.",
  },
  contributeHowToUse: {
    title: "Collector 사용 방법 | Forever Rank",
    description: "Forever Rank Collector의 게임 내 명령어(/frc export)와 Export 파일 위치, 파일 이름 규칙을 안내합니다.",
  },
  /** 테스트 데이터 배포(mock)의 제목·설명 표시. 검색 엔진과 공유 화면에서 실제 랭킹으로 오해하지 않도록 붙인다. */
  testData: {
    titlePrefix: "[테스트 데이터] ",
    descriptionPrefix: "테스트 데이터 화면입니다. 실제 WoW 포에버 랭킹이 아닙니다. ",
  },
  admin: {
    title: "관리자 | Forever Rank",
  },
  notFound: {
    title: "페이지를 찾을 수 없습니다 | Forever Rank",
  },
} as const;
