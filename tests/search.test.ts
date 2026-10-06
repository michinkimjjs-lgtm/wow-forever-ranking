import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/db/types";
import { searchCharacters } from "@/lib/queries/characters";
import { createTestDb } from "./helpers/db";
import { daysAgo, insertCharacter, NOW } from "./helpers/fixtures";

const scope = { dataEnvironment: "mock" as const };
const page = { page: 1, pageSize: 20 };

describe("캐릭터 검색", () => {
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb(["mock"]));
    await insertCharacter(db, { characterName: "홍길동", level: 30 });
    await insertCharacter(db, { characterName: "홍길", level: 10 });
    await insertCharacter(db, { characterName: "김홍길", level: 25 });
    await insertCharacter(db, { characterName: "Kaldor", level: 12 });
    await insertCharacter(db, { characterName: "오래된홍", level: 5, lastSeenAt: daysAgo(30) });
    await insertCharacter(db, { characterName: "100%전사", level: 3 });
    await insertCharacter(db, { characterName: "다른모드홍", level: 9, gameMode: "alternate" });
  });
  afterAll(() => close());

  const names = async (q: string, extra: { gameMode?: string } = {}) =>
    (await searchCharacters(db, scope, { q, ...extra }, page, NOW)).rows.map((r) => r.characterName);

  it("부분 일치로 찾고, 정확히 일치 → 앞부분 일치 → 레벨 순으로 정렬한다", async () => {
    expect(await names("홍길")).toEqual(["홍길", "홍길동", "김홍길"]);
  });

  it("영문 이름은 대소문자를 구분하지 않는다", async () => {
    expect(await names("kAL")).toEqual(["Kaldor"]);
  });

  it("오래된 캐릭터도 검색 결과에 포함하고 표시용 플래그를 준다", async () => {
    const result = await searchCharacters(db, scope, { q: "오래된" }, page, NOW);
    expect(result.rows[0]?.isStale).toBe(true);
  });

  it("LIKE 특수문자는 글자 그대로 검색한다", async () => {
    expect(await names("100%")).toEqual(["100%전사"]);
    expect(await names("%")).toEqual(["100%전사"]);
  });

  it("게임 모드를 지정하면 그 모드에서만 찾는다", async () => {
    expect(await names("홍", { gameMode: "alternate" })).toEqual(["다른모드홍"]);
    expect((await names("홍")).length).toBe(5);
  });

  it("결과가 없으면 빈 목록이다", async () => {
    const result = await searchCharacters(db, scope, { q: "없는이름" }, page, NOW);
    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("페이지네이션을 지원한다", async () => {
    const result = await searchCharacters(db, scope, { q: "홍" }, { page: 2, pageSize: 2 }, NOW);
    expect(result.total).toBe(5);
    expect(result.rows).toHaveLength(2);
  });
});
