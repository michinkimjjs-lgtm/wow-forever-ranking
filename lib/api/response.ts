/**
 * API 응답 형식 (명세서 §17)
 * 성공: { data, meta } / 오류: { error: { code, message } } — message는 한국어
 */
import { NextResponse } from "next/server";
import { DatabaseIdentityError } from "@/db/identity";
import { ConfigurationError, GameScopeNotConfiguredError, RulesetNotAvailableError } from "@/lib/config";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getMessages } from "@/lib/i18n";
import type { RankingPolicy } from "@/lib/ranking/types";
import { InvalidQueryError } from "./params";

export type ApiErrorCode = keyof ReturnType<typeof getMessages>["api"];

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  dataEnvironment: DataEnvironment;
  isMockData: boolean;
  lastUpdatedAt: string | null;
  generatedAt: string;
  policy?: RankingPolicy;
  status?: "ok" | "unavailable";
  unavailableReason?: string;
  /** 준비 중 상태의 한국어 안내 */
  notice?: string;
  /** 요청 범위의 공식 Ruleset (docs/RULESETS.md) */
  ruleset?: string | null;
}

export function buildMeta(input: {
  dataEnvironment: DataEnvironment;
  now: Date;
  lastUpdatedAt: Date | null;
  page?: number;
  pageSize?: number;
  total?: number;
  policy?: RankingPolicy;
  status?: "ok" | "unavailable";
  unavailableReason?: string;
}): ApiMeta {
  return {
    ...(input.page !== undefined ? { page: input.page, pageSize: input.pageSize, total: input.total } : {}),
    dataEnvironment: input.dataEnvironment,
    isMockData: input.dataEnvironment === "mock",
    lastUpdatedAt: input.lastUpdatedAt ? input.lastUpdatedAt.toISOString() : null,
    generatedAt: input.now.toISOString(),
    ...(input.policy ? { policy: input.policy } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.unavailableReason ? { unavailableReason: input.unavailableReason } : {}),
  };
}

export function jsonOk(data: unknown, meta: ApiMeta) {
  return NextResponse.json({ data, meta }, { headers: { "Cache-Control": "no-store" } });
}

export function jsonError(code: ApiErrorCode, status: number) {
  return NextResponse.json(
    { error: { code: code.endsWith("_NOT_FOUND") ? "NOT_FOUND" : code, message: getMessages().api[code] } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * region / gameMode 설정이 확정되지 않은 영역: 오류가 아니라 "준비 중" 상태로 응답한다(200).
 * 확인되지 않은 값을 만들어 넣지 않고 빈 목록을 돌려준다.
 */
export function scopeNotConfiguredResponse(error: GameScopeNotConfiguredError, now = new Date()) {
  return jsonOk([], {
    ...buildMeta({
      dataEnvironment: error.dataEnvironment,
      now,
      lastUpdatedAt: null,
      status: "unavailable",
      unavailableReason: "GAME_SCOPE_NOT_CONFIGURED",
    }),
    notice: getMessages().api.GAME_SCOPE_NOT_CONFIGURED,
  });
}

/** 요청한 Ruleset의 데이터가 아직 없음: 오류가 아니라 "데이터 준비 중" (200) */
export function rulesetNotAvailableResponse(error: RulesetNotAvailableError, now = new Date()) {
  return jsonOk([], {
    ...buildMeta({
      dataEnvironment: error.dataEnvironment,
      now,
      lastUpdatedAt: null,
      status: "unavailable",
      unavailableReason: "RULESET_NOT_AVAILABLE",
    }),
    ruleset: error.ruleset,
    notice: getMessages().api.RULESET_NOT_AVAILABLE,
  });
}

/** 예외를 API 오류 응답으로 바꾼다. 내부 오류 내용은 응답에 넣지 않는다. */
export function handleApiError(error: unknown) {
  if (error instanceof GameScopeNotConfiguredError) return scopeNotConfiguredResponse(error);
  if (error instanceof RulesetNotAvailableError) return rulesetNotAvailableResponse(error);
  if (error instanceof InvalidQueryError) return jsonError("INVALID_QUERY", 400);
  if (error instanceof ConfigurationError || error instanceof DatabaseIdentityError) {
    console.error(error);
    return jsonError("SERVICE_UNAVAILABLE", 503);
  }
  console.error(error);
  return jsonError("INTERNAL_ERROR", 500);
}
