import "server-only";
/**
 * 관리자 로그인 (docs/ADMIN-REVIEW.md §1)
 * - 관리자 토큰(SUBMISSIONS_ADMIN_TOKEN)으로 로그인하면 서명한 쿠키(HttpOnly, SameSite=Strict, /admin 경로)를 준다.
 * - 쿠키에는 만료 시각과 서명만 있다. 토큰 원문은 들어 있지 않다. 토큰을 바꾸면 기존 로그인은 모두 무효가 된다.
 */
import { cookies } from "next/headers";
import { submissionPolicy } from "@/config/submissions";
import { getAdminSettings } from "@/lib/config/env";
import { signAdminSession, verifyAdminSession } from "@/lib/submissions/security";

export const ADMIN_COOKIE = "fr_admin_session";

export async function isAdminAuthenticated(now = new Date()): Promise<boolean> {
  const settings = getAdminSettings();
  if (!settings.enabled) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminSession(settings.secret!, settings.adminToken!, value, now);
}

export async function startAdminSession(now = new Date()): Promise<void> {
  const settings = getAdminSettings();
  if (!settings.enabled) return;
  const expiresAt = new Date(now.getTime() + submissionPolicy.adminSessionMinutes * 60_000);
  (await cookies()).set(ADMIN_COOKIE, signAdminSession(settings.secret!, settings.adminToken!, expiresAt), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    expires: expiresAt,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}
