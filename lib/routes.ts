/**
 * 사이트 경로 (명세서 §7.6, §19)
 */
import type { RankingType } from "@/lib/ranking/types";

const seg = (value: string) => encodeURIComponent(value);

export const routes = {
  home: () => "/",
  ranking: (type: RankingType) => `/rankings/${type}`,
  characters: () => "/characters",
  character: (c: { region: string; gameMode: string; slug: string }) =>
    `/characters/${seg(c.region)}/${seg(c.gameMode)}/${seg(c.slug)}`,
  guilds: () => "/guilds",
  guild: (g: { region: string; gameMode: string; slug: string }) =>
    `/guilds/${seg(g.region)}/${seg(g.gameMode)}/${seg(g.slug)}`,
  stats: () => "/stats",
  submit: () => "/submit",
  contribute: () => "/contribute",
  contributeDownload: () => "/contribute/download",
  contributeInstall: () => "/contribute/install",
  contributeHowToUse: () => "/contribute/how-to-use",
  contributeTestExport: () => "/contribute/test-export",
};

/** 현재 쿼리를 유지하면서 일부 값만 바꾼 URL */
export function withQuery(path: string, current: URLSearchParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
