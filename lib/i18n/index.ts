/**
 * 사용자 문자열 접근 (CLAUDE.md §3)
 * 현재 기본 locale은 ko-KR 하나다. 영어를 추가할 때는 locales/en을 만들고 getMessages가 locale을 받도록 확장한다.
 */
import { ko, type Messages } from "@/locales/ko";

export const DEFAULT_LOCALE = "ko-KR";
export const HTML_LANG = "ko";

export function getMessages(): Messages {
  return ko;
}

/** "{name}" 형태의 자리표시자를 값으로 바꾼다. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** 코드 → 한국어 이름. 알 수 없는 코드는 "알 수 없음"으로 표시한다. */
export function labelOf(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return ko.common.status.none;
  return map[code] ?? ko.common.status.unknown;
}
