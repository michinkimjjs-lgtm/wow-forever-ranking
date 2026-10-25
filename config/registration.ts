/**
 * 웹 직접 등록(애드온 없이 캐릭터 등록) 설정 (docs/DATA-COLLECTION-STRATEGY.md §2)
 *
 * 선택지는 공개 근거가 있는 값만 쓴다.
 * - 지역: Battle.net 개발자 문서의 global 파티션 지역(us / eu / kr / tw).
 *   이것은 "Battle.net 계정 지역"이다. WoW: Forever가 각 지역에서 제공되는지, 게임 데이터의 region 코드가 무엇인지는
 *   아직 확인되지 않았다(명세서 §30-5). 그래서 데이터 영역의 region 코드로 바꾸는 표(regionCodeByBattleNetRegion)는 비워 둔다.
 *   표가 비어 있으면 등록은 검토 대기(게임 값 매핑 확인 필요)로 보관만 하고 랭킹에 반영하지 않는다.
 * - 게임 규칙: config/rulesets.ts에서 공개 상태가 AVAILABLE인 규칙만(하드코어는 출시 후 제공이라 제외).
 * - 직업: Forever 직업 목록이 확인되지 않아(명세서 §30-9) 게임에 표시된 이름을 그대로 받고, 코드로 바꾸는 표는 비워 둔다.
 *
 * 표를 채울 때는 공식 자료 또는 실제 데이터로 확인한 뒤, 근거를 docs/DATA-COLLECTION-STRATEGY.md에 적는다.
 */
import { z } from "zod";

const REGIONALITY_DOC = "https://community.developer.battle.net/documentation/guides/regionality-and-apis";

export const BATTLE_NET_REGIONS = ["us", "eu", "kr", "tw"] as const;
export type BattleNetRegion = (typeof BATTLE_NET_REGIONS)[number];

const code = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

const registrationConfigSchema = z.object({
  /** 등록 화면의 지역 선택지 (Battle.net 계정 지역) */
  battleNetRegions: z
    .array(
      z.object({
        code: z.enum(BATTLE_NET_REGIONS),
        evidence: z.object({ url: z.string().url(), checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
        /** WoW: Forever 제공 여부 (공식 확인 전에는 UNKNOWN) */
        foreverAvailability: z.enum(["CONFIRMED", "UNKNOWN"]),
      }),
    )
    .min(1),
  /** Battle.net 지역 → 데이터 영역 region 코드 (확인 전 비움) */
  regionCodeByBattleNetRegion: z.object({
    beta: z.partialRecord(z.enum(BATTLE_NET_REGIONS), code),
    live: z.partialRecord(z.enum(BATTLE_NET_REGIONS), code),
  }),
  /** 게임에 표시된 직업 이름(NFC, 앞뒤 공백 제거, 소문자) → 직업 코드 (확인 전 비움) */
  classCodeByName: z.object({ beta: z.record(z.string(), code), live: z.record(z.string(), code) }),
  limits: z.object({
    maxEquipment: z.number().int().positive(),
    maxNoteLength: z.number().int().positive(),
    maxUrlLength: z.number().int().positive(),
    minNoteLength: z.number().int().min(0),
  }),
});

export type RegistrationConfig = z.infer<typeof registrationConfigSchema>;

export const registrationConfig: RegistrationConfig = registrationConfigSchema.parse({
  battleNetRegions: BATTLE_NET_REGIONS.map((code) => ({
    code,
    evidence: { url: REGIONALITY_DOC, checkedAt: "2026-10-25" },
    foreverAvailability: "UNKNOWN",
  })),
  regionCodeByBattleNetRegion: { beta: {}, live: {} },
  classCodeByName: { beta: {}, live: {} },
  limits: { maxEquipment: 20, maxNoteLength: 500, maxUrlLength: 512, minNoteLength: 10 },
});
