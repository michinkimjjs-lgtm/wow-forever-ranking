/**
 * 게임 코드 → 한국어 이름.
 * WoW: Forever 클라이언트의 실제 한국어 명칭은 확인이 필요하다(명세서 §30-9). 현재 값은 mock 임시 코드용이다.
 */
export const game = {
  classes: {
    warrior: "전사",
    paladin: "성기사",
    hunter: "사냥꾼",
    rogue: "도적",
    priest: "사제",
    shaman: "주술사",
    mage: "마법사",
    warlock: "흑마법사",
    druid: "드루이드",
  } as Record<string, string>,
  races: {
    human: "인간",
    dwarf: "드워프",
    night_elf: "나이트 엘프",
    gnome: "노움",
    orc: "오크",
    undead: "언데드",
    tauren: "타우렌",
    troll: "트롤",
  } as Record<string, string>,
  factions: {
    alliance: "얼라이언스",
    horde: "호드",
  } as Record<string, string>,
  slots: {
    head: "머리",
    neck: "목",
    shoulder: "어깨",
    back: "등",
    chest: "가슴",
    wrist: "손목",
    hands: "손",
    waist: "허리",
    legs: "다리",
    feet: "발",
    finger_1: "반지 1",
    finger_2: "반지 2",
    trinket_1: "장신구 1",
    trinket_2: "장신구 2",
    main_hand: "주 무기",
    off_hand: "보조 무기",
    ranged: "원거리",
    ammo: "탄약",
    shirt: "셔츠",
    tabard: "휘장",
  } as Record<string, string>,
  itemKinds: {
    two_hand: "양손 무기",
    one_hand: "한손 무기",
  } as Record<string, string>,
  qualities: {
    poor: "하급",
    common: "일반",
    uncommon: "고급",
    rare: "희귀",
    epic: "영웅",
  } as Record<string, string>,
  regions: {
    kr: "한국 (임시)",
  } as Record<string, string>,
  /**
   * gameMode 코드 → 표시 이름.
   * - 실제 영역(beta / live)의 gameMode 코드는 공식 Ruleset 코드다.
   * - standard / alternate는 mock 개발용 코드이며 각각 일반 / 전쟁 규칙에 연결한 테스트 데이터다.
   */
  gameModes: {
    normal: "일반",
    pvp: "전쟁",
    roleplaying: "롤플레잉",
    hardcore: "하드코어",
    standard: "일반 (테스트)",
    alternate: "전쟁 (테스트)",
  } as Record<string, string>,
  /** 공식 Ruleset(게임 규칙) 한국어 이름 (docs/RULESETS.md) */
  rulesets: {
    normal: "일반",
    pvp: "전쟁",
    roleplaying: "롤플레잉",
    hardcore: "하드코어",
  },
  rulesetStatuses: {
    AVAILABLE: "제공",
    POST_LAUNCH: "출시 후 제공",
    UNKNOWN: "확인 필요",
  },
  verificationStatuses: {
    VERIFIED: "검증됨",
    LOG_VERIFIED: "로그 검증",
    COMMUNITY_SUBMITTED: "커뮤니티 제출",
    UNVERIFIED: "미검증",
    MOCK: "테스트 데이터",
  },
  /** 화면의 데이터 출처 구분 (lib/domain/data-origin.ts) */
  dataOrigins: {
    official: "공식",
    community: "커뮤니티 제출",
    test: "테스트 데이터",
  },
  dataSources: {
    mock: "테스트 데이터",
    blizzard: "Blizzard 공식",
    addon: "애드온",
    user_submission: "직접 제출",
  },
  dataEnvironments: {
    mock: "테스트 데이터",
    beta: "베타",
    live: "정식 서버",
  },
  timingBases: {
    SOURCE_REPORTED: "달성 시각 확인됨",
    FIRST_OBSERVED: "최초 확인 시각",
    INFERRED: "추정",
  },
} as const;
