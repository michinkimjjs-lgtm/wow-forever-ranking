import "server-only";
/**
 * 페이지와 API가 함께 쓰는 서비스 계층.
 * UI 컴포넌트는 랭킹 SQL이나 DB를 직접 다루지 않고 이 모듈을 사용한다.
 */
import { cached, cacheKey } from "@/lib/cache";
import type { ParsedListParams } from "@/lib/api/params";
import { getRanking, type RankingResult, type RankingType } from "@/lib/ranking";
import {
  getCharacterById,
  getCharacterBySlug,
  searchCharacters,
  type CharacterSearchInput,
} from "@/lib/queries/characters";
import { getGuildById, getGuildBySlug, listGuilds } from "@/lib/queries/guilds";
import { getHomeOverview } from "@/lib/queries/home";
import type { RankingScope } from "@/lib/ranking/types";
import { getServerContext } from "./context";

const RANKING_TTL_MS = 30_000;

export async function loadRanking(type: RankingType, params: ParsedListParams) {
  const ctx = await getServerContext();
  const { scope, filters, pagination } = params;
  const key = cacheKey(
    scope.dataEnvironment,
    "rankings",
    type,
    scope.gameMode,
    filters.region,
    filters.classCode,
    filters.factionCode,
    filters.guildId,
    filters.verifiedOnly,
    pagination.page,
    pagination.pageSize,
  );
  const result = await cached<RankingResult>(ctx.cache, key, RANKING_TTL_MS, () =>
    getRanking(ctx.db, type, { scope, filters, pagination, now: ctx.now }),
  );
  return { ctx, result };
}

export async function loadHome(scope: RankingScope) {
  const ctx = await getServerContext();
  const key = cacheKey(scope.dataEnvironment, "home", scope.gameMode);
  const overview = await cached(ctx.cache, key, RANKING_TTL_MS, () => getHomeOverview(ctx.db, scope, ctx.now));
  return { ctx, overview };
}

export async function loadCharacterSearch(
  params: ParsedListParams,
  input: CharacterSearchInput,
) {
  const ctx = await getServerContext();
  const result = await searchCharacters(
    ctx.db,
    { dataEnvironment: params.scope.dataEnvironment },
    input,
    params.pagination,
    ctx.now,
  );
  return { ctx, result };
}

export async function loadCharacterById(id: string) {
  const ctx = await getServerContext();
  return { ctx, character: await getCharacterById(ctx.db, { dataEnvironment: ctx.appEnv }, id, ctx.now) };
}

export async function loadCharacterBySlug(key: { region: string; gameMode: string; slug: string }) {
  const ctx = await getServerContext();
  return { ctx, character: await getCharacterBySlug(ctx.db, { dataEnvironment: ctx.appEnv }, key, ctx.now) };
}

export async function loadGuildById(id: string) {
  const ctx = await getServerContext();
  return { ctx, guild: await getGuildById(ctx.db, { dataEnvironment: ctx.appEnv }, id, ctx.now) };
}

export async function loadGuildBySlug(key: { region: string; gameMode: string; slug: string }) {
  const ctx = await getServerContext();
  return { ctx, guild: await getGuildBySlug(ctx.db, { dataEnvironment: ctx.appEnv }, key, ctx.now) };
}

export async function loadGuildList(gameMode?: string) {
  const ctx = await getServerContext();
  return { ctx, guilds: await listGuilds(ctx.db, { dataEnvironment: ctx.appEnv, gameMode }) };
}

/** 필터 선택지용 길드 목록 (짧게 캐시) */
export async function loadGuildOptions(scope: RankingScope) {
  const ctx = await getServerContext();
  const key = cacheKey(scope.dataEnvironment, "guild-options", scope.gameMode);
  return cached(ctx.cache, key, RANKING_TTL_MS, () =>
    listGuilds(ctx.db, { dataEnvironment: scope.dataEnvironment, gameMode: scope.gameMode }),
  );
}
