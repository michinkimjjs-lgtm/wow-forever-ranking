/**
 * Provider capability (기능 제공 여부) 공통 정의 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §2)
 *
 * 상태
 * - AVAILABLE: 공급원이 이 기능을 제공한다는 공개 근거가 있고, 연결 코드(endpoint 등)가 등록되어 있음
 * - UNAVAILABLE: 이 공급원은 이 기능을 제공하지 않음 (예: mock은 던전 기록이 없음)
 * - UNKNOWN: 공개 자료로 확인할 수 없음
 * - RUNTIME_REQUIRED: 존재는 확인했지만 실제 게임 실행 또는 실제 호출로 값을 확인해야 함
 *
 * 추측으로 AVAILABLE을 쓰지 않는다.
 */
import { z } from "zod";

export const PROVIDER_CAPABILITY_IDS = [
  "character_profile",
  "character_level",
  "character_equipment",
  "item",
  "guild",
  "achievement",
  "dungeon",
  "raid",
] as const;
export type ProviderCapabilityId = (typeof PROVIDER_CAPABILITY_IDS)[number];

export const CAPABILITY_STATUSES = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN", "RUNTIME_REQUIRED"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const capabilityEntrySchema = z
  .object({
    status: z.enum(CAPABILITY_STATUSES),
    /** 판단 근거와 남은 확인 사항 (개발자용 설명) */
    note: z.string().min(1),
    /** 마지막으로 공개 자료를 확인한 날짜 (YYYY-MM-DD) */
    reviewedAt: isoDate,
    /** 외부 공급원이 AVAILABLE일 때의 근거. 공식 문서 URL과 확인 날짜 */
    evidence: z
      .object({
        url: z.string().url().startsWith("https://"),
        verifiedAt: isoDate,
      })
      .nullable(),
  });
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;

export const capabilityRegistrySchema = z.object(
  Object.fromEntries(PROVIDER_CAPABILITY_IDS.map((id) => [id, capabilityEntrySchema])) as Record<
    ProviderCapabilityId,
    typeof capabilityEntrySchema
  >,
);
export type CapabilityRegistry = Record<ProviderCapabilityId, CapabilityEntry>;

export class CapabilityUnavailableError extends Error {
  constructor(
    readonly capability: ProviderCapabilityId,
    readonly status: CapabilityStatus,
    message: string,
  ) {
    super(message);
    this.name = "CapabilityUnavailableError";
  }
}

/** 모든 기능을 같은 상태로 채운 registry (mock / addon 등 단순한 공급원용) */
export function uniformCapabilities(
  status: CapabilityStatus,
  note: string,
  reviewedAt: string,
  overrides: Partial<CapabilityRegistry> = {},
): CapabilityRegistry {
  const base = Object.fromEntries(
    PROVIDER_CAPABILITY_IDS.map((id) => [id, { status, note, reviewedAt, evidence: null }]),
  ) as CapabilityRegistry;
  return capabilityRegistrySchema.parse({ ...base, ...overrides }) as CapabilityRegistry;
}
