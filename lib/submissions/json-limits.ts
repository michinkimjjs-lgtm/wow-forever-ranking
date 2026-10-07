/**
 * JSON 크기·깊이 제한 검사 (브라우저와 서버에서 함께 쓴다. node 전용 모듈을 쓰지 않는다)
 */
export interface JsonLimits {
  maxDepth: number;
  maxStringLength: number;
  maxNodes: number;
}

export type JsonLimitError = "INVALID_JSON" | "JSON_TOO_DEEP" | "STRING_TOO_LONG" | "TOO_MANY_VALUES" | "FORBIDDEN_KEY";

/** 객체 키로 받지 않는 이름 (프로토타입 오염 방지) */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** 반복문으로 검사한다(재귀 없음). 깊이가 큰 입력으로 스택이 넘치지 않게 한다. */
export function checkJsonLimits(value: unknown, limits: JsonLimits): JsonLimitError | null {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 1 }];
  let nodes = 0;
  while (stack.length > 0) {
    const { value: current, depth } = stack.pop()!;
    nodes += 1;
    if (nodes > limits.maxNodes) return "TOO_MANY_VALUES";
    if (typeof current === "string") {
      if (current.length > limits.maxStringLength) return "STRING_TOO_LONG";
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    if (depth > limits.maxDepth) return "JSON_TOO_DEEP";
    if (Array.isArray(current)) {
      for (const item of current) stack.push({ value: item, depth: depth + 1 });
    } else {
      for (const [key, item] of Object.entries(current)) {
        if (FORBIDDEN_KEYS.has(key)) return "FORBIDDEN_KEY";
        if (key.length > limits.maxStringLength) return "STRING_TOO_LONG";
        stack.push({ value: item, depth: depth + 1 });
      }
    }
  }
  return null;
}

/** JSON.parse + 제한 검사 */
export function parseJsonWithLimits(
  text: string,
  limits: JsonLimits,
): { ok: true; value: unknown } | { ok: false; error: JsonLimitError } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
  const error = checkJsonLimits(value, limits);
  return error ? { ok: false, error } : { ok: true, value };
}
