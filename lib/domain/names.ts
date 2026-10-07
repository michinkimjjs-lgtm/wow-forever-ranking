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

/**
 * WoW: Forever 전체 이름 (docs/RULESETS.md §3)
 * Forever는 realm이 없고 "이름 + 성" 전체 이름이 region 안에서 고유하다. 첫 이름만으로는 캐릭터를 식별하지 않는다.
 * 이름과 성을 잇는 실제 구분자는 확인되지 않았으므로(Runtime verification required) 호출하는 쪽이 설정값을 넘긴다.
 * 이름이나 성이 없거나 구분자를 모르면 null.
 */
export function buildFullName(
  name: string | null | undefined,
  surname: string | null | undefined,
  separator: string | null,
): string | null {
  const first = name?.trim();
  const last = surname?.trim();
  if (!first || !last || separator === null) return null;
  return `${first}${separator}${last}`;
}
