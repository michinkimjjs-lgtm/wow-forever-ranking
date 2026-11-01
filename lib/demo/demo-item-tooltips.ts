/**
 * 화면 미리보기(DEMO) 아이템 툴팁 정보 — lib/demo/demo-items.ts의 실제 WoW: Forever 아이템
 *
 * - 귀속, 고유 장착, 방어도, 방패 막기, 무기 공격력·속도, 능력치, 착용·사용·발동 효과는 World of Warcraft 게임 데이터(권리자 Blizzard)다.
 * - 2026-11-01에 WOWF.IO 아이템 도감 한국어 항목(https://wowf.io/ko/items/{번호})의 아이템 정보에서 예시 아이템 86개만 하나씩 확인했다(요청 간격 2.5초).
 * - 화면 예시의 툴팁에만 쓴다. DB·랭킹 엔진·API에 넣지 않는다.
 */

export interface DemoItemEffect {
  /** use: 사용 효과, equip: 착용 효과, hit: 발동 효과(공격 시) */
  trigger: "use" | "equip" | "hit";
  text: string;
  cooldownSeconds?: number;
  charges?: number;
}

export interface DemoItemTooltip {
  /** pickup: 획득 시 귀속, equip: 착용 시 귀속 */
  bind: "pickup" | "equip";
  unique?: boolean;
  armor?: number;
  block?: number;
  weapon?: { min: number; max: number; speed: number; dps: number };
  stats?: readonly { label: string; value: number }[];
  effects?: readonly DemoItemEffect[];
}

export const DEMO_ITEM_TOOLTIPS: Record<number, DemoItemTooltip> = {
  888: { bind: "pickup", armor: 61, stats: [{ label: "체력", value: 4 }, { label: "힘", value: 4 }], effects: [{ trigger: "equip", text: "+15 치유량" }, { trigger: "equip", text: "+5 주문 공격력" }] },
  1292: { bind: "pickup", weapon: { min: 19, max: 36, speed: 1.7, dps: 16.2 }, stats: [{ label: "힘", value: 5 }, { label: "민첩성", value: 2 }] },
  3416: { bind: "equip", armor: 211, stats: [{ label: "체력", value: 9 }, { label: "힘", value: 9 }], effects: [{ trigger: "equip", text: "사망 시 15미터 내의 모든 적에게 420의 신성 피해를 입힙니다." }] },
  6314: { bind: "pickup", armor: 22, stats: [{ label: "체력", value: 3 }], effects: [{ trigger: "equip", text: "+9 야수에 대한 전투력" }, { trigger: "equip", text: "+10 전투력" }] },
  6315: { bind: "equip", weapon: { min: 29, max: 45, speed: 3.4, dps: 10.9 }, stats: [{ label: "민첩성", value: 3 }] },
  6319: { bind: "pickup", armor: 54, stats: [{ label: "체력", value: 5 }], effects: [{ trigger: "equip", text: "+7 주문력" }, { trigger: "equip", text: "은신 감지 효과가 1만큼 증가합니다." }] },
  6320: { bind: "pickup", armor: 585, block: 12, stats: [{ label: "체력", value: 3 }, { label: "힘", value: 5 }], effects: [{ trigger: "equip", text: "+4 5초당 생명력 회복" }] },
  6321: { bind: "pickup", unique: true, stats: [{ label: "힘", value: 5 }, { label: "체력", value: 2 }], effects: [{ trigger: "equip", text: "티리스팔 숲, 은빛소나무 숲, 그림자송곳니 성채에서 이동 속도가 2%만큼 증가합니다." }] },
  6340: { bind: "pickup", armor: 22, stats: [{ label: "민첩성", value: 4 }, { label: "체력", value: 6 }] },
  6392: { bind: "pickup", armor: 26, stats: [{ label: "지능", value: 3 }, { label: "정신력", value: 5 }, { label: "민첩성", value: 2 }], effects: [{ trigger: "equip", text: "+9 주문력" }] },
  6681: { bind: "pickup", weapon: { min: 24, max: 46, speed: 1.7, dps: 20.6 }, effects: [{ trigger: "hit", text: "대상에게 가시를 던져 45의 물리 피해를 입히고 주위의 추가 적 1명에게 튕깁니다. 튕길 때마다 입히는 피해가 50%만큼 감소합니다." }] },
  6682: { bind: "pickup", armor: 48, stats: [{ label: "체력", value: 4 }, { label: "지능", value: 11 }], effects: [{ trigger: "equip", text: "+20 치유량" }, { trigger: "equip", text: "+7 주문 공격력" }] },
  6685: { bind: "pickup", armor: 37, stats: [{ label: "지능", value: 11 }], effects: [{ trigger: "equip", text: "+6 주문력" }] },
  6686: { bind: "pickup", armor: 188, stats: [{ label: "힘", value: 13 }], effects: [{ trigger: "equip", text: "+120 방어도" }] },
  6688: { bind: "pickup", armor: 89, stats: [{ label: "체력", value: 11 }, { label: "정신력", value: 11 }], effects: [{ trigger: "equip", text: "+7 주문력" }] },
  6689: { bind: "pickup", weapon: { min: 56, max: 85, speed: 3.3, dps: 21.4 }, stats: [{ label: "정신력", value: 16 }, { label: "체력", value: 6 }], effects: [{ trigger: "equip", text: "모든 마법 주문 및 효과에 의한 치유량이 최대 71만큼, 주문 공격력이 최대 23만큼 증가합니다." }] },
  6690: { bind: "pickup", armor: 96, stats: [{ label: "지능", value: 12 }], effects: [{ trigger: "equip", text: "+26 전투력" }] },
  6693: { bind: "pickup", unique: true, stats: [{ label: "정신력", value: 6 }, { label: "체력", value: 5 }], effects: [{ trigger: "equip", text: "불모의 땅, 버섯구름 봉우리, 가시덩굴 우리, 가시덩굴 구릉에서 이동 속도가 3%만큼 증가합니다." }] },
  6694: { bind: "pickup", armor: 757, block: 16, stats: [{ label: "체력", value: 7 }], effects: [{ trigger: "equip", text: "+15 치유량" }, { trigger: "equip", text: "+5 주문 공격력" }] },
  6695: { bind: "pickup", stats: [{ label: "체력", value: 4 }], effects: [{ trigger: "equip", text: "+12 언데드에 대한 주문 공격력" }, { trigger: "equip", text: "+5 주문력" }] },
  6696: { bind: "pickup", weapon: { min: 20, max: 38, speed: 1.7, dps: 17.1 }, stats: [{ label: "민첩성", value: 3 }], effects: [{ trigger: "equip", text: "+5 암흑 저항" }] },
  6697: { bind: "pickup", armor: 38, stats: [{ label: "지능", value: 11 }, { label: "민첩성", value: 3 }], effects: [{ trigger: "equip", text: "+6 주문력" }] },
  6901: { bind: "pickup", armor: 23, stats: [{ label: "정신력", value: 8 }], effects: [{ trigger: "equip", text: "+7 치유량" }, { trigger: "equip", text: "+3 주문 공격력" }] },
  6902: { bind: "pickup", armor: 43, stats: [{ label: "힘", value: 6 }, { label: "체력", value: 3 }] },
  6910: { bind: "pickup", armor: 41, stats: [{ label: "체력", value: 5 }], effects: [{ trigger: "equip", text: "+5 주문력" }, { trigger: "equip", text: "+5 5초당 마나 회복" }, { trigger: "equip", text: "+5 5초당 생명력 회복" }] },
  6911: { bind: "pickup", armor: 58, stats: [{ label: "체력", value: 5 }], effects: [{ trigger: "equip", text: "+12 주문 공격력" }] },
  7708: { bind: "pickup", weapon: { min: 32, max: 61, speed: 1.4, dps: 33.2 }, effects: [{ trigger: "equip", text: "+9 치유량" }, { trigger: "equip", text: "+3 주문 공격력" }, { trigger: "equip", text: "+4 암흑 저항" }] },
  7709: { bind: "pickup", armor: 45, stats: [{ label: "정신력", value: 14 }], effects: [{ trigger: "equip", text: "+19 암흑 공격력" }] },
  7712: { bind: "pickup", armor: 39, stats: [{ label: "지능", value: 6 }, { label: "정신력", value: 8 }], effects: [{ trigger: "equip", text: "+7 주문력" }] },
  7713: { bind: "pickup", weapon: { min: 70, max: 105, speed: 3.4, dps: 25.7 }, stats: [{ label: "지능", value: 6 }, { label: "정신력", value: 7 }, { label: "체력", value: 10 }], effects: [{ trigger: "equip", text: "+14 치명타" }, { trigger: "equip", text: "마법 주문 및 효과로 입히는 피해와 치유량이 최대 44만큼 증가합니다." }] },
  7717: { bind: "pickup", weapon: { min: 104, max: 157, speed: 3.5, dps: 37.3 }, effects: [{ trigger: "hit", text: "주위 모든 적을 공격해 9초 동안 3초마다 무기 공격력에 5의 피해를 합산하여 입히고, 자신의 이동 속도를 80%만큼 감소시킵니다." }] },
  7719: { bind: "pickup", armor: 213, stats: [{ label: "체력", value: 8 }, { label: "힘", value: 13 }], effects: [{ trigger: "equip", text: "+14 치명타" }] },
  7721: { bind: "pickup", weapon: { min: 37, max: 70, speed: 2.7, dps: 19.8 }, stats: [{ label: "정신력", value: 8 }, { label: "체력", value: 7 }], effects: [{ trigger: "equip", text: "모든 마법 주문 및 효과에 의한 치유량이 최대 94만큼, 주문 공격력이 최대 31만큼 증가합니다." }] },
  7724: { bind: "pickup", armor: 168, stats: [{ label: "체력", value: 7 }], effects: [{ trigger: "equip", text: "+32 전투력" }] },
  7726: { bind: "pickup", armor: 1548, block: 21, stats: [{ label: "체력", value: 8 }, { label: "힘", value: 7 }], effects: [{ trigger: "equip", text: "방패 막기에 성공할 때마다 적에게 14의 신성 피해를 입힙니다." }] },
  7727: { bind: "equip", armor: 80, stats: [{ label: "힘", value: 3 }, { label: "체력", value: 11 }, { label: "정신력", value: 4 }] },
  7728: { bind: "equip", armor: 50, stats: [{ label: "정신력", value: 8 }, { label: "지능", value: 12 }], effects: [{ trigger: "equip", text: "+9 주문력" }] },
  7729: { bind: "equip", weapon: { min: 26, max: 50, speed: 2.3, dps: 16.5 }, stats: [{ label: "체력", value: 6 }] },
  7731: { bind: "pickup", stats: [{ label: "체력", value: 9 }], effects: [{ trigger: "equip", text: "+12 언데드에 대한 전투력" }, { trigger: "equip", text: "+14 전투력" }] },
  7751: { bind: "pickup", armor: 70, stats: [{ label: "체력", value: 3 }, { label: "민첩성", value: 7 }, { label: "정신력", value: 7 }] },
  7752: { bind: "equip", weapon: { min: 31, max: 59, speed: 2.1, dps: 21.4 }, stats: [{ label: "힘", value: 7 }, { label: "정신력", value: 3 }] },
  7754: { bind: "equip", armor: 71, stats: [{ label: "체력", value: 11 }, { label: "정신력", value: 3 }, { label: "힘", value: 2 }] },
  7755: { bind: "equip", armor: 88, stats: [{ label: "힘", value: 5 }, { label: "민첩성", value: 10 }, { label: "체력", value: 10 }] },
  7756: { bind: "pickup", armor: 71, effects: [{ trigger: "equip", text: "+24 전투력" }, { trigger: "equip", text: "+21 야수에 대한 전투력" }] },
  7757: { bind: "equip", weapon: { min: 60, max: 90, speed: 3.1, dps: 24.2 }, stats: [{ label: "체력", value: 17 }], effects: [{ trigger: "equip", text: "+3 주문 관통력" }, { trigger: "equip", text: "+51 비전 공격력" }] },
  7759: { bind: "equip", armor: 245, stats: [{ label: "힘", value: 12 }, { label: "체력", value: 12 }], effects: [{ trigger: "equip", text: "+9 주문력" }] },
  7760: { bind: "equip", armor: 105, stats: [{ label: "지능", value: 6 }, { label: "정신력", value: 14 }, { label: "힘", value: 5 }], effects: [{ trigger: "equip", text: "+24 치유량" }, { trigger: "equip", text: "+8 주문 공격력" }] },
  8225: { bind: "equip", unique: true, weapon: { min: 32, max: 60, speed: 1.9, dps: 24.2 }, effects: [{ trigger: "hit", text: "대상을 부패시켜 3초에 걸쳐 총 63의 피해를 입힙니다." }] },
  9381: { bind: "equip", weapon: { min: 42, max: 79, speed: 1.7, dps: 35.6 }, effects: [{ trigger: "equip", text: "+9 치유량" }, { trigger: "equip", text: "+3 주문 공격력" }, { trigger: "equip", text: "+5 자연 저항" }] },
  9384: { bind: "equip", unique: true, weapon: { min: 25, max: 47, speed: 1.5, dps: 24 }, stats: [{ label: "민첩성", value: 7 }, { label: "체력", value: 3 }] },
  9386: { bind: "equip", unique: true, weapon: { min: 43, max: 82, speed: 2.6, dps: 24 }, effects: [{ trigger: "hit", text: "적에게 불타는 구체를 날려 51의 화염 피해를 입히고 6초에 걸쳐 총 12의 추가 피해를 입힙니다." }] },
  9387: { bind: "pickup", armor: 257 },
  9390: { bind: "pickup", armor: 38 },
  9395: { bind: "equip", armor: 32, stats: [{ label: "지능", value: 5 }, { label: "정신력", value: 12 }] },
  9396: { bind: "equip", armor: 218, stats: [{ label: "민첩성", value: 5 }, { label: "힘", value: 13 }, { label: "체력", value: 13 }, { label: "정신력", value: 5 }] },
  9397: { bind: "equip", armor: 28, stats: [{ label: "정신력", value: 10 }], effects: [{ trigger: "use", text: "320의 마나를 회복합니다.", cooldownSeconds: 600 }] },
  9405: { bind: "equip", armor: 128, stats: [{ label: "힘", value: 12 }], effects: [{ trigger: "equip", text: "+3 방어 숙련도" }] },
  9406: { bind: "equip", armor: 112, stats: [{ label: "지능", value: 12 }, { label: "힘", value: 7 }, { label: "체력", value: 11 }] },
  9407: { bind: "pickup", armor: 53, stats: [{ label: "정신력", value: 12 }, { label: "체력", value: 9 }, { label: "지능", value: 8 }], effects: [{ trigger: "equip", text: "+20 치유량" }, { trigger: "equip", text: "+7 주문 공격력" }] },
  9409: { bind: "pickup", armor: 115, effects: [{ trigger: "equip", text: "+50 방어도" }] },
  9411: { bind: "pickup", armor: 209, stats: [{ label: "힘", value: 3 }, { label: "지능", value: 13 }, { label: "정신력", value: 6 }], effects: [{ trigger: "equip", text: "+12 주문력" }] },
  9420: { bind: "equip", armor: 94, stats: [{ label: "정신력", value: 7 }, { label: "민첩성", value: 9 }, { label: "체력", value: 14 }] },
  9445: { bind: "pickup", armor: 144, stats: [{ label: "민첩성", value: 5 }, { label: "힘", value: 6 }, { label: "정신력", value: 9 }] },
  9446: { bind: "pickup", weapon: { min: 26, max: 49, speed: 1.7, dps: 22.1 }, effects: [{ trigger: "hit", text: "대상에게 28의 자연 피해를 입힙니다. 기계 대상은 2배의 피해를 받습니다." }] },
  9447: { bind: "pickup", unique: true, stats: [{ label: "정신력", value: 7 }, { label: "체력", value: 4 }], effects: [{ trigger: "equip", text: "+9 치유량" }, { trigger: "equip", text: "+3 주문 공격력" }] },
  9448: { bind: "pickup", armor: 22, effects: [{ trigger: "equip", text: "+9 주문력" }, { trigger: "equip", text: "+3 5초당 마나 회복" }] },
  9450: { bind: "pickup", armor: 76, stats: [{ label: "체력", value: 12 }], effects: [{ trigger: "equip", text: "+11 치유량" }, { trigger: "equip", text: "+4 주문 공격력" }] },
  9453: { bind: "pickup", unique: true, weapon: { min: 27, max: 51, speed: 1.9, dps: 20.5 }, effects: [{ trigger: "hit", text: "12초 동안 시전자 주위 8미터 반경의 모든 대상에게 매 3초마다 14의 자연 피해를 입힙니다." }] },
  9454: { bind: "pickup", armor: 34, stats: [{ label: "지능", value: 8 }, { label: "정신력", value: 4 }], effects: [{ trigger: "equip", text: "+5 자연 저항" }, { trigger: "equip", text: "+5 주문력" }] },
  9455: { bind: "pickup", armor: 49, effects: [{ trigger: "equip", text: "+6 비전 저항" }] },
  9456: { bind: "pickup", weapon: { min: 36, max: 68, speed: 2.9, dps: 17.9 }, effects: [{ trigger: "equip", text: "+12 전투력" }] },
  9459: { bind: "pickup", weapon: { min: 67, max: 102, speed: 2.7, dps: 31.3 }, stats: [{ label: "힘", value: 17 }, { label: "체력", value: 5 }, { label: "지능", value: 4 }] },
  9461: { bind: "pickup", effects: [{ trigger: "equip", text: "+5 비전 저항" }, { trigger: "equip", text: "+5 자연 저항" }] },
  9487: { bind: "equip", weapon: { min: 23, max: 43, speed: 2.3, dps: 14.3 }, effects: [{ trigger: "equip", text: "+3 방어 숙련도" }] },
  9489: { bind: "pickup", weapon: { min: 29, max: 56, speed: 1.4, dps: 30.4 }, effects: [{ trigger: "equip", text: "+5 냉기 저항" }] },
  9491: { bind: "equip", armor: 31, stats: [{ label: "지능", value: 8 }, { label: "정신력", value: 5 }, { label: "체력", value: 5 }, { label: "민첩성", value: 4 }] },
  9492: { bind: "pickup", armor: 43, stats: [{ label: "정신력", value: 9 }, { label: "지능", value: 8 }], effects: [{ trigger: "equip", text: "+8 주문력" }, { trigger: "use", text: "번개를 집중시켜 시전자 전방의 모든 적에게 날려보내 162의 자연 피해를 입힙니다. 공격 후 시전자는 5분 동안 전기의 벽에 둘러싸입니다.", cooldownSeconds: 300 }] },
  9510: { bind: "equip", armor: 154, stats: [{ label: "힘", value: 4 }, { label: "체력", value: 10 }], effects: [{ trigger: "equip", text: "+40 방어도" }] },
  10761: { bind: "pickup", weapon: { min: 30, max: 57, speed: 1.5, dps: 29 }, effects: [{ trigger: "equip", text: "+3 냉기 저항" }, { trigger: "hit", text: "적에게 얼음 화살을 날려 34 에서 50의 냉기 피해를 입히고 5초 동안 이동 속도를 50%만큼 감소시킵니다." }] },
  10762: { bind: "pickup", armor: 62, stats: [{ label: "체력", value: 20 }], effects: [{ trigger: "equip", text: "+14 냉기 공격력" }, { trigger: "equip", text: "+14 암흑 공격력" }] },
  10763: { bind: "pickup", armor: 341, stats: [{ label: "힘", value: 14 }, { label: "체력", value: 7 }, { label: "지능", value: 10 }], effects: [{ trigger: "equip", text: "+10 냉기 저항" }] },
  10770: { bind: "pickup", stats: [{ label: "정신력", value: 5 }], effects: [{ trigger: "equip", text: "+16 암흑 공격력" }] },
  10771: { bind: "pickup", armor: 33, stats: [{ label: "지능", value: 15 }], effects: [{ trigger: "equip", text: "+7 주문력" }] },
  10774: { bind: "pickup", armor: 95, stats: [{ label: "힘", value: 5 }, { label: "체력", value: 15 }, { label: "민첩성", value: 6 }] },
  10775: { bind: "pickup", armor: 373, stats: [{ label: "체력", value: 15 }, { label: "힘", value: 10 }, { label: "민첩성", value: 8 }] },
  10777: { bind: "pickup", armor: 79, effects: [{ trigger: "equip", text: "+10 자연 저항" }] },
};
