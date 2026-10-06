/**
 * API 응답 형식 (명세서 §17)
 * 성공: { data, meta } / 오류: { error: { code, message } } — message는 한국어
 */
import { NextResponse } from "next/server";
import { DatabaseIdentityError } from "@/db/identity";
import { ConfigurationError } from "@/lib/config";
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

/** 예외를 API 오류 응답으로 바꾼다. 내부 오류 내용은 응답에 넣지 않는다. */
export function handleApiError(error: unknown) {
  if (error instanceof InvalidQueryError) return jsonError("INVALID_QUERY", 400);
  if (error instanceof ConfigurationError || error instanceof DatabaseIdentityError) {
    console.error(error);
    return jsonError("SERVICE_UNAVAILABLE", 503);
  }
  console.error(error);
  return jsonError("INTERNAL_ERROR", 500);
}
