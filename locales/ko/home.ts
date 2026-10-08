export const home = {
  title: "WoW 포에버 랭킹",
  subtitle: "레벨, 장비, 캐릭터 성장 기록을 한눈에 확인하세요.",
  scopeNote: "{gameMode} 기준",
  kpi: {
    topLevel: "현재 최고 레벨",
    topAverageItemLevel: "최고 평균 장비 레벨",
    topHighestItemLevel: "최고 아이템 레벨",
    trackedCharacters: "추적 캐릭터",
    rankedCharacters: "랭킹 대상 {n}명",
    lastUpdated: "최근 데이터 갱신",
  },
  cards: {
    level: "최고 레벨 상위 10명",
    gear: "최고 장비 상위 10명",
    highestItem: "최고 아이템 상위 10명",
    recentlyUpdated: "최근 데이터가 갱신된 캐릭터",
    recentLevelUps: "최근 레벨이 상승한 캐릭터",
  },
  levelUp: "{level}레벨 달성",
  levelShort: "레벨 {level}",
  contributeCta: {
    title: "내 캐릭터도 랭킹에 올리고 싶다면",
    body: "Forever Rank Collector로 내 캐릭터 데이터를 파일로 저장해 제출할 수 있습니다. 검토 후 랭킹에 반영됩니다.",
    button: "내 캐릭터 랭킹 등록",
  },
} as const;
