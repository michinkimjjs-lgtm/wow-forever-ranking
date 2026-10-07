/**
 * 게임 메타데이터 표시명 (docs/STATIC-GAME-DATA.md §7)
 *
 * 직업·종족·진영·게임 모드는 영문 내부 코드로 저장하고, 표시명은 따로 고른다.
 * - 데이터셋에 CLIENT_CONFIRMED 한국어 이름이 있으면 그 이름을 확정 명칭으로 쓴다.
 * - 없으면 locales/ko/game.ts의 이름을 쓰되 "미확정"(UNCONFIRMED)으로 표시한다.
 *   locales의 이름은 mock 개발용 임시 명칭이며 WoW: Forever 클라이언트에서 확인한 명칭이 아니다.
 * - 둘 다 없으면 코드를 그대로 보여 주고 "미확정"으로 표시한다.
 */
import { game } from "@/locales/ko/game";
import type { LocalizedNames, NameStatus } from "./schema";

export const METADATA_KINDS = ["classes", "races", "factions", "gameModes"] as const;
export type MetadataKind = (typeof METADATA_KINDS)[number];

export interface DisplayName {
  code: string;
  text: string;
  status: NameStatus;
  /** Forever 클라이언트에서 확인한 명칭인지 */
  confirmed: boolean;
}

export function resolveKoreanName(kind: MetadataKind, code: string, names?: LocalizedNames | null): DisplayName {
  const ko = names?.ko;
  if (ko && ko.status === "CLIENT_CONFIRMED") {
    return { code, text: ko.value, status: ko.status, confirmed: true };
  }
  if (ko) return { code, text: ko.value, status: ko.status, confirmed: false };
  const fallback = (game[kind] as Record<string, string>)[code];
  return { code, text: fallback ?? code, status: "UNCONFIRMED", confirmed: false };
}
