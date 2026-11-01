/**
 * 화면 미리보기(DEMO) 가상 캐릭터가 착용하는 아이템 — 실제 WoW: Forever 아이템
 *
 * - 아이템 이름·등급·아이템 레벨·요구 레벨·부위·종류는 World of Warcraft 게임 데이터(권리자 Blizzard Entertainment)다.
 *   2026-11-01에 WOWF.IO 아이템 도감(https://wowf.io/ko/items/{번호})의 한국어 항목에서 WoW: Forever에 있는 아이템인지와
 *   각 값을 하나씩 확인했다(사이트맵에 있는 항목만, 요청 간격 2.5초). 번호는 그 도감과 게임의 아이템 번호다.
 * - 가상 캐릭터의 장비 예시로만 쓴다. DB·랭킹 엔진·API에 넣지 않는다.
 * - 아이콘은 Blizzard 게임 아이콘을 변경 없이 로컬 파일로 둔다(public/demo/items/, 출처·조건: docs/DEMO-ITEM-ICONS.md).
 * - 착용 조합(어느 캐릭터가 무엇을 입는지)은 화면 예시로 정한 것이다. 직업의 방어구 종류·무기 종류와 요구 레벨에 맞췄다.
 */

export type DemoItemQuality = "common" | "uncommon" | "rare" | "epic";

export interface DemoItem {
  name: string;
  quality: DemoItemQuality;
  itemLevel: number;
  requiredLevel: number;
  /** 도감의 부위 표기 (예: 머리, 한손, 양손, 보조장비, 원거리) */
  slot: string;
  /** 도감의 종류 표기 (예: 천, 가죽, 사슬, 판금, 단검) */
  type: string;
  /** 게임 아이콘 이름. 이미지는 public/demo/items/{icon}.jpg (docs/DEMO-ITEM-ICONS.md) */
  icon: string;
}

export const DEMO_ITEMS = {
  888: { name: "나가 전투 장갑", icon: "inv_gauntlets_13", quality: "rare", itemLevel: 27, requiredLevel: 22, slot: "손", type: "가죽" },
  1292: { name: "도살자의 식칼", icon: "inv_axe_23", quality: "rare", itemLevel: 25, requiredLevel: 20, slot: "한손", type: "도끼" },
  3416: { name: "순교자의 사슬 갑옷", icon: "inv_chest_chain", quality: "rare", itemLevel: 28, requiredLevel: 23, slot: "가슴", type: "사슬" },
  6314: { name: "늑대왕 단망토", icon: "inv_misc_cape_10", quality: "rare", itemLevel: 27, requiredLevel: 22, slot: "등", type: "천" },
  6315: { name: "강철 석궁", icon: "inv_weapon_crossbow_01", quality: "uncommon", itemLevel: 27, requiredLevel: 22, slot: "원거리", type: "석궁" },
  6319: { name: "눈먼감시자의 벨트", icon: "inv_belt_03", quality: "rare", itemLevel: 26, requiredLevel: 21, slot: "허리", type: "가죽" },
  6320: { name: "사령관의 문장방패", icon: "inv_shield_03", quality: "rare", itemLevel: 26, requiredLevel: 21, slot: "보조장비", type: "방패" },
  6321: { name: "실버레인 가문의 문장", icon: "inv_belt_29", quality: "rare", itemLevel: 26, requiredLevel: 21, slot: "손가락", type: "" },
  6340: { name: "펜루스의 가죽", icon: "inv_misc_pelt_wolf_02", quality: "rare", itemLevel: 27, requiredLevel: 22, slot: "등", type: "천" },
  6392: { name: "아루갈의 허리띠", icon: "inv_belt_10", quality: "rare", itemLevel: 28, requiredLevel: 23, slot: "허리", type: "천" },
  6681: { name: "가시뿔", icon: "inv_weapon_shortblade_10", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "한손", type: "단검" },
  6682: { name: "죽음의예언자 로브", icon: "inv_chest_cloth_20", quality: "rare", itemLevel: 31, requiredLevel: 26, slot: "가슴", type: "천" },
  6685: { name: "죽음의예언자 어깨보호대", icon: "inv_shoulder_09", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "어깨", type: "천" },
  6686: { name: "어금니 투구", icon: "inv_helmet_09", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "머리", type: "사슬" },
  6688: { name: "속삭이는 바람의 머리장식", icon: "inv_helmet_17", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "머리", type: "가죽" },
  6689: { name: "바람 정령의 지팡이", icon: "inv_staff_01", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "양손", type: "지팡이" },
  6690: { name: "전투멧돼지 다리보호구", icon: "inv_pants_14", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "다리", type: "가죽" },
  6693: { name: "아감마간의 고리", icon: "inv_misc_bone_05", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "손가락", type: "" },
  6694: { name: "아감마간의 심장", icon: "inv_shield_02", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "보조장비", type: "방패" },
  6695: { name: "지옥의 뼈목걸이", icon: "inv_jewelry_necklace_04", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "목", type: "" },
  6696: { name: "밤의 추적자 활", icon: "inv_weapon_bow_12", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "원거리", type: "활" },
  6697: { name: "박쥐날개 어깨보호대", icon: "inv_shoulder_05", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "어깨", type: "천" },
  6901: { name: "타오르는 트레샤돈 단망토", icon: "inv_misc_monsterscales_03", quality: "rare", itemLevel: 29, requiredLevel: 24, slot: "등", type: "천" },
  6902: { name: "세라키스의 고리", icon: "inv_bracer_08", quality: "rare", itemLevel: 27, requiredLevel: 22, slot: "손목", type: "가죽" },
  6910: { name: "거머리 바지", icon: "inv_pants_14", quality: "rare", itemLevel: 29, requiredLevel: 24, slot: "다리", type: "천" },
  6911: { name: "이끼 허리띠", icon: "inv_belt_25", quality: "rare", itemLevel: 30, requiredLevel: 25, slot: "허리", type: "가죽" },
  7708: { name: "죽음의 마법봉", icon: "inv_wand_04", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "원거리", type: "마법봉" },
  7709: { name: "황폐의 다리보호구", icon: "inv_pants_07", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "다리", type: "천" },
  7712: { name: "도안의 어깨보호대", icon: "inv_shoulder_05", quality: "uncommon", itemLevel: 39, requiredLevel: 34, slot: "어깨", type: "천" },
  7713: { name: "환영 마법막대", icon: "inv_wand_04", quality: "rare", itemLevel: 39, requiredLevel: 34, slot: "양손", type: "지팡이" },
  7717: { name: "폭풍의 눈", icon: "inv_weapon_halberd_05", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "양손", type: "도끼" },
  7719: { name: "분노의 광전사 투구", icon: "inv_helmet_25", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "머리", type: "사슬" },
  7721: { name: "정의의 망치", icon: "inv_hammer_02", quality: "rare", itemLevel: 44, requiredLevel: 39, slot: "주장비", type: "둔기" },
  7724: { name: "천상의 건틀릿", icon: "inv_gauntlets_19", quality: "rare", itemLevel: 44, requiredLevel: 39, slot: "손", type: "사슬" },
  7726: { name: "붉은십자군 사령관의 아이기스", icon: "inv_shield_05", quality: "rare", itemLevel: 44, requiredLevel: 39, slot: "보조장비", type: "방패" },
  7727: { name: "경비원의 어깨갑옷", icon: "inv_shoulder_23", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "어깨", type: "가죽" },
  7728: { name: "현혹의 로브", icon: "inv_chest_cloth_25", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "가슴", type: "천" },
  7729: { name: "체스터폴 머스킷총", icon: "inv_weapon_rifle_06", quality: "rare", itemLevel: 33, requiredLevel: 28, slot: "원거리", type: "총" },
  7731: { name: "영석 부적", icon: "inv_jewelry_necklace_06", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "목", type: "" },
  7751: { name: "보렐의 장화", icon: "inv_boots_03", quality: "uncommon", itemLevel: 35, requiredLevel: 0, slot: "발", type: "가죽" },
  7752: { name: "환멸의 망치", icon: "inv_hammer_17", quality: "rare", itemLevel: 33, requiredLevel: 28, slot: "주장비", type: "둔기" },
  7754: { name: "전조의 장화", icon: "inv_boots_05", quality: "rare", itemLevel: 30, requiredLevel: 25, slot: "발", type: "가죽" },
  7755: { name: "부싯돌 어깨보호구", icon: "inv_shoulder_13", quality: "rare", itemLevel: 38, requiredLevel: 33, slot: "어깨", type: "가죽" },
  7756: { name: "조련용 장갑", icon: "inv_gauntlets_07", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "손", type: "가죽" },
  7757: { name: "바람매듭 지팡이", icon: "inv_wand_07", quality: "rare", itemLevel: 37, requiredLevel: 32, slot: "양손", type: "지팡이" },
  7759: { name: "아르콘 흉갑", icon: "inv_chest_chain_11", quality: "rare", itemLevel: 38, requiredLevel: 33, slot: "가슴", type: "사슬" },
  7760: { name: "대족장의 킬트", icon: "inv_pants_06", quality: "rare", itemLevel: 39, requiredLevel: 34, slot: "다리", type: "가죽" },
  8225: { name: "부패의 펜싱검", icon: "inv_sword_30", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "한손", type: "도검" },
  9381: { name: "토석 마법봉", icon: "inv_staff_17", quality: "rare", itemLevel: 38, requiredLevel: 33, slot: "원거리", type: "마법봉" },
  9384: { name: "바위동굴일족 비수", icon: "inv_weapon_shortblade_18", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "한손", type: "단검" },
  9386: { name: "굴착자의 횃불", icon: "inv_torch_lit", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "한손", type: "둔기" },
  9387: { name: "레벨로쉬 장화", icon: "inv_boots_plate_06", quality: "rare", itemLevel: 42, requiredLevel: 40, slot: "발", type: "판금" },
  9390: { name: "레벨로쉬 장갑", icon: "inv_gauntlets_17", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "손", type: "천" },
  9395: { name: "고대인의 장갑", icon: "inv_gauntlets_24", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "손", type: "천" },
  9396: { name: "보물창고의 다리보호구", icon: "inv_pants_10", quality: "rare", itemLevel: 39, requiredLevel: 34, slot: "다리", type: "사슬" },
  9397: { name: "에너지 망토", icon: "inv_misc_cape_18", quality: "rare", itemLevel: 39, requiredLevel: 34, slot: "등", type: "천" },
  9405: { name: "골렘의 힘 벨트", icon: "inv_belt_27", quality: "rare", itemLevel: 33, requiredLevel: 28, slot: "허리", type: "사슬" },
  9406: { name: "소용돌이 멜빵", icon: "inv_chest_leather_08", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "가슴", type: "가죽" },
  9407: { name: "돌매듭 다리보호구", icon: "inv_pants_01", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "다리", type: "천" },
  9409: { name: "아이로나야 팔보호구", icon: "inv_bracer_19", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "손목", type: "사슬" },
  9411: { name: "바위파편 어깨갑옷", icon: "inv_shoulder_02", quality: "rare", itemLevel: 46, requiredLevel: 41, slot: "어깨", type: "사슬" },
  9420: { name: "끈기있는 모험가의 투구", icon: "inv_helmet_15", quality: "rare", itemLevel: 37, requiredLevel: 32, slot: "머리", type: "가죽" },
  9445: { name: "그루비스 앞발", icon: "inv_gauntlets_17", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "손", type: "사슬" },
  9446: { name: "기계화 문지기 다리", icon: "inv_sword_30", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "주장비", type: "도검" },
  9447: { name: "기계화 문지기 너트", icon: "inv_misc_gear_04", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "손가락", type: "" },
  9448: { name: "거미전차 기름걸레", icon: "inv_misc_bandage_09", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "손목", type: "천" },
  9450: { name: "노움로봇 제어 장화", icon: "inv_boots_03", quality: "rare", itemLevel: 34, requiredLevel: 29, slot: "발", type: "가죽" },
  9453: { name: "맹독풀이 비수", icon: "inv_weapon_shortblade_02", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "한손", type: "단검" },
  9454: { name: "방사능처리 장화", icon: "inv_boots_05", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "발", type: "천" },
  9455: { name: "사절단 소매장식", icon: "inv_bracer_09", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "손목", type: "가죽" },
  9456: { name: "망원 라이플", icon: "inv_weapon_rifle_02", quality: "rare", itemLevel: 35, requiredLevel: 30, slot: "원거리", type: "총" },
  9459: { name: "텔마플러그의 왼팔", icon: "inv_axe_03", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "양손", type: "도끼" },
  9461: { name: "전자 기어", icon: "inv_misc_gear_01", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "손가락", type: "" },
  9487: { name: "최첨단 산탄총", icon: "inv_weapon_rifle_06", quality: "rare", itemLevel: 29, requiredLevel: 24, slot: "원거리", type: "총" },
  9489: { name: "자동회전 빙수기", icon: "inv_wand_05", quality: "rare", itemLevel: 31, requiredLevel: 26, slot: "원거리", type: "마법봉" },
  9491: { name: "일등 조종사 장갑", icon: "inv_gauntlets_16", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "손", type: "천" },
  9492: { name: "기가볼트 전자반응기", icon: "inv_gizmo_01", quality: "rare", itemLevel: 36, requiredLevel: 31, slot: "머리", type: "천" },
  9510: { name: "깊은굴 뚜벅신", icon: "inv_boots_01", quality: "rare", itemLevel: 32, requiredLevel: 27, slot: "발", type: "사슬" },
  10761: { name: "한파의 단검", icon: "inv_sword_34", quality: "rare", itemLevel: 43, requiredLevel: 38, slot: "한손", type: "단검" },
  10762: { name: "리치의 로브", icon: "inv_chest_cloth_17", quality: "rare", itemLevel: 43, requiredLevel: 38, slot: "가슴", type: "천" },
  10763: { name: "빙철 투구", icon: "inv_helmet_13", quality: "rare", itemLevel: 43, requiredLevel: 40, slot: "머리", type: "판금" },
  10770: { name: "모드레쉬의 해골", icon: "inv_misc_bone_elfskull_01", quality: "rare", itemLevel: 41, requiredLevel: 36, slot: "보조장비", type: "보조장비" },
  10771: { name: "죽음의 마법사 장식띠", icon: "inv_belt_24", quality: "rare", itemLevel: 41, requiredLevel: 36, slot: "허리", type: "천" },
  10774: { name: "살가죽 어깨보호구", icon: "inv_shoulder_28", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "어깨", type: "가죽" },
  10775: { name: "투텐카쉬의 등껍질", icon: "inv_chest_plate08", quality: "rare", itemLevel: 42, requiredLevel: 40, slot: "가슴", type: "판금" },
  10777: { name: "비단거미 장갑", icon: "inv_gauntlets_32", quality: "rare", itemLevel: 42, requiredLevel: 37, slot: "손", type: "가죽" },
} as const satisfies Record<number, DemoItem>;

export type DemoItemId = keyof typeof DEMO_ITEMS;

export function demoItem(id: DemoItemId): DemoItem {
  return DEMO_ITEMS[id];
}

/** 캐릭터별 착용 장비 (칸 → 아이템 번호). 비어 있는 칸은 적지 않는다. */
export const DEMO_GEAR = {
  c01: { head: 9492, neck: 7731, shoulder: 7712, back: 9397, chest: 10762, wrist: 9448, hands: 9390, waist: 10771, legs: 9407, feet: 9454, finger1: 9461, finger2: 6693, mainHand: 7713, ranged: 9381 },
  c02: { head: 9420, neck: 6695, shoulder: 10774, back: 6901, chest: 9406, wrist: 9455, hands: 10777, waist: 6911, legs: 7760, feet: 9450, finger1: 9447, finger2: 9461, mainHand: 10761, offHand: 9384, ranged: 9456 },
  c03: { head: 6688, neck: 7731, shoulder: 7755, back: 9397, chest: 9406, wrist: 6902, hands: 7756, waist: 6911, legs: 7760, feet: 7751, finger1: 6693, finger2: 6321, mainHand: 9386, offHand: 10770 },
  c04: { head: 10763, neck: 6695, shoulder: 9411, back: 6314, chest: 10775, wrist: 9409, hands: 7724, waist: 9405, legs: 9396, feet: 9387, finger1: 9461, finger2: 9447, mainHand: 7721, offHand: 7726 },
  c05: { head: 7719, neck: 7731, shoulder: 7755, back: 6901, chest: 7759, wrist: 9455, hands: 9445, waist: 9405, legs: 9396, feet: 9510, finger1: 6693, finger2: 9447, mainHand: 9459, ranged: 6696 },
  c06: { head: 9420, neck: 7731, shoulder: 7755, back: 6314, chest: 9406, wrist: 6902, hands: 7756, waist: 6319, legs: 6690, feet: 7754, finger1: 6321, finger2: 9447, mainHand: 8225, offHand: 6681, ranged: 7729 },
  c07: { head: 6688, neck: 6695, shoulder: 7727, back: 6340, chest: 9406, wrist: 9455, hands: 7756, waist: 6911, legs: 7760, feet: 9450, finger1: 6693, finger2: 9461, mainHand: 7752, offHand: 6694 },
  c08: { head: 6686, neck: 7731, shoulder: 7727, back: 6901, chest: 7759, wrist: 9455, hands: 9445, waist: 9405, legs: 9396, feet: 9510, finger1: 9447, finger2: 6321, mainHand: 7717, ranged: 9487 },
  c09: { head: 9420, neck: 6695, shoulder: 7727, back: 6314, chest: 9406, wrist: 6902, hands: 888, waist: 6911, legs: 6690, feet: 7754, finger1: 9447, mainHand: 9446, offHand: 9453, ranged: 6315 },
  c10: { head: 9492, neck: 6695, shoulder: 6697, back: 6901, chest: 7728, wrist: 9448, hands: 9395, waist: 6392, legs: 7709, feet: 9454, finger1: 9461, mainHand: 7757, ranged: 7708 },
  c11: { shoulder: 6685, back: 6314, chest: 6682, hands: 9491, waist: 6392, legs: 6910, feet: 9454, finger1: 6321, mainHand: 6689, ranged: 9489 },
  c12: { back: 6314, chest: 3416, hands: 888, finger1: 6321, mainHand: 1292, offHand: 6320, ranged: 6315 },
} as const;
