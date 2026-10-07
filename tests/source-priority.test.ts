/**
 * 데이터 공급원 우선순위 (Phase 2C, docs/BLIZZARD-API-INTEGRATION-PLAN.md §13)
 */
import { describe, expect, it } from "vitest";
import { VERIFICATION_STATUSES, type VerificationStatus } from "@/lib/domain/enums";
import {
  compareCandidates,
  MixedDataEnvironmentError,
  selectPreferred,
  VERIFICATION_PRIORITY,
} from "@/lib/domain/source-priority";
import { defaultVerificationStatus, IngestionError } from "@/lib/ingestion/ingest";

const at = (h: number) => new Date(Date.UTC(2026, 9, 6, h));
const candidate = (verificationStatus: VerificationStatus, hour: number, id: string) => ({
  id,
  dataEnvironment: "beta" as const,
  verificationStatus,
  observedAt: at(hour),
});

describe("공급원 우선순위", () => {
  it("VERIFIED → LOG_VERIFIED → COMMUNITY_SUBMITTED → UNVERIFIED → MOCK 순서다", () => {
    expect(VERIFICATION_PRIORITY).toEqual(["VERIFIED", "LOG_VERIFIED", "COMMUNITY_SUBMITTED", "UNVERIFIED", "MOCK"]);
    expect([...VERIFICATION_PRIORITY].sort()).toEqual([...VERIFICATION_STATUSES].sort());
  });

  it("검증 상태가 높은 데이터가 더 최근 데이터보다 우선한다", () => {
    const picked = selectPreferred([
      candidate("COMMUNITY_SUBMITTED", 10, "submitted-new"),
      candidate("VERIFIED", 1, "official-old"),
      candidate("UNVERIFIED", 12, "unverified"),
    ]);
    expect(picked!.id).toBe("official-old");
  });

  it("같은 검증 상태면 최근 관측이 우선한다", () => {
    expect(selectPreferred([candidate("COMMUNITY_SUBMITTED", 1, "a"), candidate("COMMUNITY_SUBMITTED", 5, "b")])!.id).toBe("b");
    expect(compareCandidates(candidate("LOG_VERIFIED", 1, "x"), candidate("COMMUNITY_SUBMITTED", 9, "y"))).toBeLessThan(0);
  });

  it("후보가 없으면 null, 영역이 섞이면 예외다 (mock과 실제 데이터를 비교하지 않음)", () => {
    expect(selectPreferred([])).toBeNull();
    expect(() =>
      selectPreferred([candidate("COMMUNITY_SUBMITTED", 1, "a"), { ...candidate("MOCK", 2, "m"), dataEnvironment: "mock" as const }]),
    ).toThrow(MixedDataEnvironmentError);
  });

  it("검증 상태를 바꾸지 않는다", () => {
    const list = [candidate("UNVERIFIED", 1, "a")];
    expect(selectPreferred(list)!.verificationStatus).toBe("UNVERIFIED");
  });
});

describe("데이터 출처만으로 VERIFIED가 되지 않는다", () => {
  it("공급원별 기본 검증 상태: 사용자 제출·애드온은 COMMUNITY_SUBMITTED, mock은 MOCK", () => {
    expect(defaultVerificationStatus("user_submission")).toBe("COMMUNITY_SUBMITTED");
    expect(defaultVerificationStatus("addon")).toBe("COMMUNITY_SUBMITTED");
    expect(defaultVerificationStatus("mock")).toBe("MOCK");
  });

  it("blizzard 공급원도 자동으로 VERIFIED가 되지 않는다 (기본값 미정 → 오류)", () => {
    expect(() => defaultVerificationStatus("blizzard")).toThrow(IngestionError);
  });
});
