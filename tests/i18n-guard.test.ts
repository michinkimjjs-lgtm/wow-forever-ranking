/**
 * UI 문자열은 locales/ko에서만 관리한다(CLAUDE.md §3).
 * app/, components/의 코드(주석 제외)에 한국어가 직접 들어 있으면 실패한다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ko } from "@/locales/ko";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("한국어 UI 문자열 분리", () => {
  it("app/, components/에 한국어 문자열을 직접 쓰지 않는다", () => {
    const offenders = [...files("app"), ...files("components")].filter((file) =>
      /[가-힣]/.test(stripComments(readFileSync(file, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("필수 한국어 UI 문구가 locale에 있다", () => {
    expect(Object.values(ko.common.nav)).toEqual(expect.arrayContaining(["홈", "랭킹", "캐릭터", "길드", "통계"]));
    expect(Object.values(ko.rankings.titles)).toEqual(["레벨 랭킹", "장비 랭킹", "최고 아이템"]);
    expect(ko.characters.search.placeholder).toBe("캐릭터명을 입력하세요");
    expect(ko.characters.search.noResults).toBe("검색 결과가 없습니다.");
    expect(ko.game.verificationStatuses).toEqual({
      VERIFIED: "검증됨",
      LOG_VERIFIED: "로그 검증",
      COMMUNITY_SUBMITTED: "사용자 제출",
      UNVERIFIED: "미검증",
      MOCK: "테스트 데이터",
    });
    expect(ko.common.mockBanner.title).toBe("베타 테스트 데이터");
  });
});
