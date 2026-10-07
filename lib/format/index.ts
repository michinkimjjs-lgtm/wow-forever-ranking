/**
 * 시간 / 숫자 표시 (명세서 §20)
 * - DB는 UTC, 화면은 대한민국 표준시(Asia/Seoul)
 * - 절대 시각: 2026년 10월 6일 오후 3:42
 * - 서버의 시스템 시간대에 의존하지 않도록 timeZone을 항상 지정한다.
 */
import { DEFAULT_LOCALE, getMessages, t } from "@/lib/i18n";

export const DISPLAY_TIME_ZONE = "Asia/Seoul";

const dateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatKstDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 날짜만: 2026년 10월 7일 (KST) */
export function formatKstDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatRelativeTime(date: Date, now: Date): string {
  const messages = getMessages().common.time;
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return messages.justNow;
  if (diffMinutes < 60) return t(messages.minutesAgo, { n: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t(messages.hoursAgo, { n: diffHours });
  return t(messages.daysAgo, { n: Math.floor(diffHours / 24) });
}

/** 평균 장비 레벨: 소수점 2자리 */
export function formatAverageItemLevel(value: number | null): string {
  return value === null ? getMessages().common.status.none : value.toFixed(2);
}

const integerFormatter = new Intl.NumberFormat(DEFAULT_LOCALE);
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatPercent(ratio: number): string {
  return String(Math.round(ratio * 100));
}
