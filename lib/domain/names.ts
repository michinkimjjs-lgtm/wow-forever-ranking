/**
 * 이름 정규화와 슬러그 (명세서 §7.2, §21)
 * - 정규화: 유니코드 NFC → 앞뒤 공백 제거 → 연속 공백 하나로 → 소문자
 * - 슬러그: 정규화 이름의 공백을 '-'로 바꾼 값. 한글은 로마자로 바꾸지 않는다.
 */
export function normalizeName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function toSlug(name: string): string {
  return normalizeName(name).replace(/ /g, "-");
}

/** LIKE 패턴에서 특수문자로 해석되는 문자를 이스케이프한다. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** URL 경로에서 받은 슬러그를 저장 형식으로 맞춘다. (인코딩되어 있으면 해제) */
export function normalizeSlugParam(raw: string): string {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // 잘못된 인코딩이면 받은 값을 그대로 쓴다.
  }
  return toSlug(value);
}
