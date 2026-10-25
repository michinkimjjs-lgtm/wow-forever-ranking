/**
 * 웹 직접 등록(Manual Character v1) 입력 스키마 (docs/DATA-COLLECTION-STRATEGY.md §2)
 *
 * Collector 파일 없이 웹 양식으로 캐릭터 정보를 등록한다. 브라우저와 서버에서 함께 쓴다.
 * - 지역: Battle.net 계정 지역(config/registration.ts). 게임 데이터 region 코드가 아니다.
 * - 게임 규칙: 공개 상태가 AVAILABLE인 공식 Ruleset만.
 * - 직업·종족·진영: 게임에 표시된 이름을 그대로 받는다(코드 목록이 확인되지 않았음).
 * - 확인 자료: 스크린샷 주소(https) 또는 설명 중 하나 이상이 필요하다.
 * - 직접 입력은 검증 자료가 아니다. 저장되면 검토 대기이며, 승인돼도 검증 상태는 커뮤니티 제출이다.
 */
import { z } from "zod";
import { BATTLE_NET_REGIONS, registrationConfig } from "@/config/registration";
import { rulesetsConfig } from "@/config/rulesets";

export const MANUAL_SCHEMA = "forever-rank/manual-character";
export const MANUAL_SCHEMA_VERSION = 1;

/** 등록할 수 있는 게임 규칙: 출시 시 제공되는(AVAILABLE) 공식 규칙만 */
export const REGISTRABLE_RULESETS = rulesetsConfig.rulesets.filter((r) => r.publicStatus === "AVAILABLE").map((r) => r.code);

const { limits } = registrationConfig;

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, message);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** 확인 자료 주소: https만, 계정 정보가 들어간 주소는 받지 않는다 */
const evidenceUrl = z
  .string()
  .trim()
  .max(limits.maxUrlLength, "주소가 너무 깁니다.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "https:// 로 시작하는 주소만 입력할 수 있습니다.");

export const manualEquipmentSchema = z
  .object({
    /** Gear Profile 슬롯 코드 (예: head) */
    slot: z.string().regex(/^[a-z0-9_]{1,32}$/, "장비 슬롯을 선택하세요."),
    itemName: text(128, "아이템 이름을 입력하세요."),
    /** 게임 아이템 번호. 모르면 비워 둔다(이 경우 장비 계산에는 쓰지 않음) */
    itemId: z.number().int().min(1).max(10_000_000).optional(),
    itemLevel: z.number().int().min(1).max(10_000).optional(),
  })
  .strict();

export const manualCharacterSchema = z
  .object({
    schema: z.literal(MANUAL_SCHEMA),
    schemaVersion: z.literal(MANUAL_SCHEMA_VERSION),
    region: z.enum(BATTLE_NET_REGIONS, { message: "지역을 선택하세요." }),
    ruleset: z
      .string()
      .refine((value) => (REGISTRABLE_RULESETS as readonly string[]).includes(value), "게임 규칙을 선택하세요."),
    name: text(32, "이름(첫 이름)을 입력하세요."),
    /** 성. Forever는 이름 + 성(전체 이름)이 region 안에서 고유하다. 첫 이름만으로 식별하지 않는다. */
    surname: text(32, "성을 입력하세요."),
    level: z.number({ message: "레벨을 입력하세요." }).int("레벨은 정수여야 합니다.").min(1).max(1000),
    className: text(32, "직업을 입력하세요."),
    raceName: optionalText(32),
    factionName: optionalText(32),
    guildName: optionalText(64),
    /** 정보를 게임에서 확인한 시각 (ISO 8601) */
    observedAt: z.string().datetime({ offset: true, message: "확인한 시각을 입력하세요." }),
    equipment: z
      .array(manualEquipmentSchema)
      .max(limits.maxEquipment, `장비는 최대 ${limits.maxEquipment}개까지 입력할 수 있습니다.`)
      .refine((list) => new Set(list.map((e) => e.slot)).size === list.length, "같은 슬롯을 두 번 입력했습니다."),
    evidence: z
      .object({
        screenshotUrl: evidenceUrl.optional(),
        note: z
          .string()
          .trim()
          .max(limits.maxNoteLength, `설명은 ${limits.maxNoteLength}자 이하로 입력하세요.`)
          .optional()
          .transform((v) => (v ? v : undefined)),
      })
      .strict()
      .refine(
        (e) => Boolean(e.screenshotUrl) || (e.note?.length ?? 0) >= limits.minNoteLength,
        `확인 자료가 필요합니다. 스크린샷 주소를 넣거나 ${limits.minNoteLength}자 이상 설명을 적어 주세요.`,
      ),
  })
  .strict();

export type ManualCharacterInput = z.input<typeof manualCharacterSchema>;
export type ManualCharacter = z.infer<typeof manualCharacterSchema>;

/** 저장된 제출이 웹 직접 등록인지 */
export function isManualPayload(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && (payload as { schema?: unknown }).schema === MANUAL_SCHEMA);
}
