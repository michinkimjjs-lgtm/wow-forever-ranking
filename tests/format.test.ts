import { describe, expect, it } from "vitest";
import { formatAverageItemLevel, formatKstDateTime, formatRelativeTime } from "@/lib/format";
import { normalizeName, normalizeSlugParam, toSlug } from "@/lib/domain/names";

describe("시간 표시 (KST)", () => {
  it("UTC 시각을 한국 시간 형식으로 표시한다", () => {
    expect(formatKstDateTime(new Date("2026-10-06T06:42:00Z"))).toBe("2026년 10월 6일 오후 3:42");
    expect(formatKstDateTime(new Date("2026-10-05T23:05:00Z"))).toBe("2026년 10월 6일 오전 8:05");
  });

  it("상대 시각을 한국어로 표시한다", () => {
    const now = new Date("2026-10-06T06:00:00Z");
    expect(formatRelativeTime(new Date("2026-10-06T05:59:40Z"), now)).toBe("방금 전");
    expect(formatRelativeTime(new Date("2026-10-06T05:58:00Z"), now)).toBe("2분 전");
    expect(formatRelativeTime(new Date("2026-10-06T03:00:00Z"), now)).toBe("3시간 전");
    expect(formatRelativeTime(new Date("2026-10-01T06:00:00Z"), now)).toBe("5일 전");
  });

  it("평균 장비 레벨은 소수점 2자리로 표시한다", () => {
    expect(formatAverageItemLevel(61.4)).toBe("61.40");
    expect(formatAverageItemLevel(null)).toBe("-");
  });
});

describe("이름 정규화와 슬러그", () => {
  it("NFC 정규화, 공백 정리, 소문자화", () => {
    expect(normalizeName("  Kal  Dor ")).toBe("kal dor");
    expect(normalizeName("홍")).toBe("홍");
  });

  it("한글은 로마자로 바꾸지 않고, 공백은 '-'로 바꾼다", () => {
    expect(toSlug("아제로스 수호대")).toBe("아제로스-수호대");
    expect(normalizeSlugParam(encodeURIComponent("홍길동"))).toBe("홍길동");
    expect(normalizeSlugParam("%E0%A4%A")).toBe("%e0%a4%a");
  });
});
