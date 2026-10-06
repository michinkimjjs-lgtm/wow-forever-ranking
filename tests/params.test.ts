import { describe, expect, it } from "vitest";
import { InvalidQueryError, parseListParams, parseSearchParams } from "@/lib/api/params";

const parse = (query: string, strict = true) => parseListParams(new URLSearchParams(query), "mock", { strict });

describe("요청 파라미터 검증", () => {
  it("기본값: 현재 배포 영역, 기본 게임 모드, 1페이지, 50개", () => {
    const parsed = parse("");
    expect(parsed.scope).toEqual({ dataEnvironment: "mock", gameMode: "standard" });
    expect(parsed.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it("필터 값을 받는다", () => {
    const parsed = parse("class=mage&faction=horde&gameMode=alternate&verifiedOnly=true&page=3&pageSize=10");
    expect(parsed.filters).toMatchObject({ classCode: "mage", factionCode: "horde", verifiedOnly: true });
    expect(parsed.scope.gameMode).toBe("alternate");
    expect(parsed.pagination).toEqual({ page: 3, pageSize: 10 });
  });

  it("클라이언트가 보낸 rank 파라미터는 받지 않는다", () => {
    expect(() => parse("rank=1")).toThrow(InvalidQueryError);
  });

  it("API는 알 수 없는 파라미터를 거부하고, 페이지는 무시한다", () => {
    expect(() => parse("foo=bar")).toThrow(InvalidQueryError);
    expect(() => parse("foo=bar", false)).not.toThrow();
  });

  it.each([
    ["pageSize=101"],
    ["pageSize=0"],
    ["page=0"],
    ["page=1.5"],
    ["page=abc"],
    ["class=unknown"],
    ["faction=neutral"],
    ["gameMode=unknown"],
    ["region=us"],
    ["guild=not-uuid"],
    ["verifiedOnly=yes"],
    ["page=1&page=2"],
  ])("잘못된 값을 거부한다: %s", (query) => {
    expect(() => parse(query)).toThrow(InvalidQueryError);
  });

  it("검색 API는 q가 필요하고 너무 긴 검색어를 거부한다", () => {
    expect(() => parseSearchParams(new URLSearchParams(""), "mock", { strict: true, requireQuery: true })).toThrow(InvalidQueryError);
    expect(() =>
      parseSearchParams(new URLSearchParams(`q=${"가".repeat(33)}`), "mock", { strict: true, requireQuery: true }),
    ).toThrow(InvalidQueryError);
    const parsed = parseSearchParams(new URLSearchParams("q=홍"), "mock", { strict: true, requireQuery: true });
    expect(parsed.q).toBe("홍");
    expect(parsed.gameModeSpecified).toBe(false);
  });
});
