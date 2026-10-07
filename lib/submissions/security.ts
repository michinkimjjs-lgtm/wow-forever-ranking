/**
 * 공개 제출 보안 (docs/SUBMISSION-SYSTEM.md §5) — 서버 전용
 *
 * - CSRF: 제출 화면이 발급한 서명 토큰(유효 시간 제한) + Origin 확인
 * - 요청 제한용 일시 식별값: IP와 User-Agent를 날짜별 비밀값으로 HMAC한 값. 메모리에서만 쓰고 저장하지 않는다.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueCsrfToken(secret: string, now: Date): string {
  const issuedAt = String(now.getTime());
  return `${issuedAt}.${hmac(secret, `csrf:${issuedAt}`)}`;
}

export function verifyCsrfToken(secret: string, token: string | null, now: Date, ttlMinutes: number): boolean {
  if (!token) return false;
  const [issuedAt, signature, extra] = token.split(".");
  if (!issuedAt || !signature || extra !== undefined || !/^\d{1,16}$/.test(issuedAt)) return false;
  const age = now.getTime() - Number(issuedAt);
  if (age < -60_000 || age > ttlMinutes * 60_000) return false;
  return safeEqual(signature, hmac(secret, `csrf:${issuedAt}`));
}

/**
 * 같은 사이트에서 보낸 요청인지 확인한다.
 * Origin이 없거나 허용 목록에 없으면 거부한다. Sec-Fetch-Site가 있으면 same-origin이어야 한다.
 */
export function isSameOriginRequest(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}

/** 요청 제한용 일시 식별값. 날짜가 바뀌면 같은 클라이언트도 다른 값이 된다. */
export function temporaryClientKey(secret: string, request: Request, now: Date): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const day = now.toISOString().slice(0, 10);
  return hmac(secret, `client:${day}:${ip}:${ua}`).slice(0, 32);
}

/** 관리자 로그인 값 서명 (docs/ADMIN-REVIEW.md §1) */
export function signAdminSession(secret: string, adminToken: string, expiresAt: Date): string {
  const exp = String(expiresAt.getTime());
  const tokenDigest = hmac(secret, `admin-token:${adminToken}`);
  return `${exp}.${hmac(secret, `admin-session:${exp}:${tokenDigest}`)}`;
}

export function verifyAdminSession(secret: string, adminToken: string, value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const [exp, signature, extra] = value.split(".");
  if (!exp || !signature || extra !== undefined || !/^\d{1,16}$/.test(exp)) return false;
  if (Number(exp) <= now.getTime()) return false;
  const tokenDigest = hmac(secret, `admin-token:${adminToken}`);
  return safeEqual(signature, hmac(secret, `admin-session:${exp}:${tokenDigest}`));
}

export function adminTokenMatches(expected: string, given: string): boolean {
  return safeEqual(hmac("compare", given), hmac("compare", expected));
}
