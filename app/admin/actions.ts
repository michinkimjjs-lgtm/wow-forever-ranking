"use server";
/**
 * 관리자 화면 서버 액션 (docs/ADMIN-REVIEW.md)
 * Next.js 서버 액션은 Origin과 Host가 다르면 거부한다(CSRF 보호). 액션마다 로그인을 다시 확인한다.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getExportMapping, resolveGearProfile, resolveSlotMappingProfile } from "@/lib/config";
import { getAdminSettings, getSubmissionSecret } from "@/lib/config/env";
import { endAdminSession, isAdminAuthenticated, startAdminSession } from "@/lib/admin/session";
import { getServerContext } from "@/lib/server/context";
import { acceptSubmission, rejectSubmission, type ReviewConfig } from "@/lib/submissions/admin-review";
import { FixedWindowRateLimiter } from "@/lib/submissions/rate-limit";
import { adminTokenMatches, temporaryClientKey } from "@/lib/submissions/security";

const loginLimiter = new FixedWindowRateLimiter(10, 15 * 60_000);

const reviewConfig: ReviewConfig = {
  mapping: getExportMapping,
  slotProfile: (env, gameMode) => resolveSlotMappingProfile(env, gameMode),
  rankingProfile: (env, gameMode) => resolveGearProfile(env, gameMode),
};

export async function loginAction(formData: FormData): Promise<void> {
  const settings = getAdminSettings();
  if (!settings.enabled) redirect("/admin/login");
  const h = await headers();
  const request = new Request("http://internal/admin/login", { headers: h });
  const now = new Date();
  if (!loginLimiter.take(temporaryClientKey(getSubmissionSecret()!, request, now), now.getTime())) {
    redirect("/admin/login?error=limited");
  }
  const token = String(formData.get("token") ?? "").slice(0, 512);
  if (!adminTokenMatches(settings.adminToken!, token)) redirect("/admin/login?error=1");
  await startAdminSession(now);
  redirect("/admin/submissions");
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}

function returnPath(formData: FormData, outcome: string): string {
  const status = String(formData.get("returnStatus") ?? "");
  const params = new URLSearchParams({ result: outcome });
  if (["PENDING", "ACCEPTED", "REJECTED", "CONFLICT"].includes(status)) params.set("status", status);
  return `/admin/submissions?${params.toString()}`;
}

export async function acceptAction(formData: FormData): Promise<void> {
  await review(formData, "accept");
}

export async function rejectAction(formData: FormData): Promise<void> {
  await review(formData, "reject");
}

async function review(formData: FormData, decision: "accept" | "reject"): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const ctx = await getServerContext();
  if (ctx.appEnv === "mock") redirect("/admin/submissions");
  const env = ctx.appEnv;
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  const outcome =
    decision === "accept"
      ? await acceptSubmission(ctx.db, env, id, {
          now: ctx.now,
          note,
          overrideConflict: formData.get("overrideConflict") === "on",
          config: reviewConfig,
        })
      : await rejectSubmission(ctx.db, env, id, { now: ctx.now, note });
  redirect(returnPath(formData, outcome.ok ? outcome.submission.reviewStatus : outcome.reason));
}
