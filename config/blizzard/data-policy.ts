/**
 * Blizzard API 데이터 보존·호출 한도 정책 (docs/DATA-COLLECTION-STRATEGY.md §4)
 *
 * 근거는 리테일 WoW API에 적용되는 Blizzard 개발자 정책이다. Forever API가 공개되면 같은 조건인지 다시 확인한다.
 * - 보존: Blizzard에서 받은 플레이어 데이터는 최소 30일마다 다시 받아야 하고, 그러지 못하면 지워야 한다.
 *   (사용자가 비공개·삭제를 요청한 데이터일 수 있기 때문)
 * - 호출 한도: 시간당 36,000회, 초당 100회.
 * Forever용 Blizzard API는 아직 공개되지 않았으므로 이 정책을 쓰는 코드는 지금 실제로 호출하지 않는다.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const evidence = z.object({ url: z.string().url().startsWith("https://"), checkedAt: isoDate });

const blizzardDataPolicySchema = z
  .object({
    retention: z.object({
      /** Blizzard 정책의 최대 보존 기간. 이 기간 안에 다시 받지 못한 Blizzard 출처 데이터는 삭제 대상이다 */
      maxRetentionDays: z.number().int().positive(),
      /** 우리 설정: 이 기간이 지나면 다시 받기를 시작한다 (실패해도 재시도할 여유를 둔다) */
      refreshAfterDays: z.number().int().positive(),
      evidence,
    }),
    rateLimit: z.object({
      requestsPerHour: z.number().int().positive(),
      requestsPerSecond: z.number().int().positive(),
      /** 우리 설정: 한도 중 정기 갱신에 쓰는 비율 (나머지는 개별 조회·재시도 여유) */
      refreshShare: z.number().gt(0).max(1),
      evidence,
    }),
  })
  .refine((p) => p.retention.refreshAfterDays < p.retention.maxRetentionDays, {
    message: "refreshAfterDays는 maxRetentionDays보다 작아야 합니다.",
  });

export type BlizzardDataPolicy = z.infer<typeof blizzardDataPolicySchema>;

export const blizzardDataPolicy: BlizzardDataPolicy = blizzardDataPolicySchema.parse({
  retention: {
    maxRetentionDays: 30,
    refreshAfterDays: 21,
    evidence: { url: "https://us.forums.blizzard.com/en/blizzard/t/data-protection-notice-and-faq/609", checkedAt: "2026-10-25" },
  },
  rateLimit: {
    requestsPerHour: 36_000,
    requestsPerSecond: 100,
    refreshShare: 0.6,
    evidence: { url: "https://community.developer.battle.net/documentation/guides/getting-started", checkedAt: "2026-10-25" },
  },
});
