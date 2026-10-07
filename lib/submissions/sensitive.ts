/**
 * 개인정보·인증정보로 보이는 값 검사 (docs/PRIVACY-DATA-POLICY.md §3)
 *
 * Character Export에는 게임 데이터만 있어야 한다. 아래와 같은 값이 보이면 제출을 받지 않는다.
 * 실수로 다른 파일이나 메모를 섞어 올리는 것을 막기 위한 장치이며, 완전한 탐지를 보장하지 않는다.
 * 브라우저와 서버에서 함께 쓴다.
 */
export type SensitiveKind =
  | "EMAIL"
  | "BATTLE_TAG"
  | "CREDENTIAL_KEYWORD"
  | "CARD_NUMBER"
  | "RESIDENT_NUMBER"
  | "PHONE_NUMBER"
  | "SENSITIVE_KEY";

const VALUE_PATTERNS: { kind: SensitiveKind; pattern: RegExp }[] = [
  { kind: "EMAIL", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { kind: "BATTLE_TAG", pattern: /[\p{L}\p{N}]{2,12}#\d{4,6}(?!\d)/u },
  {
    kind: "CREDENTIAL_KEYWORD",
    pattern: /password|passwd|passcode|비밀번호|패스워드|authenticator|인증기|인증 ?코드|\botp\b|security ?question|보안 ?질문/i,
  },
  { kind: "CARD_NUMBER", pattern: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/ },
  { kind: "RESIDENT_NUMBER", pattern: /(?<!\d)\d{6}-?[1-4]\d{6}(?!\d)/ },
  { kind: "PHONE_NUMBER", pattern: /(?<!\d)01[016789][ -]?\d{3,4}[ -]?\d{4}(?!\d)/ },
];

const KEY_PATTERN = /pass(word)?|비밀번호|secret|credential|token|email|이메일|battle ?tag|account|계정|card|카드|phone|전화/i;

export interface SensitiveFinding {
  path: string;
  kind: SensitiveKind;
}

export function findSensitiveData(value: unknown, maxFindings = 20): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  const stack: { value: unknown; path: string }[] = [{ value, path: "" }];
  while (stack.length > 0 && findings.length < maxFindings) {
    const { value: current, path } = stack.pop()!;
    if (typeof current === "string") {
      const hit = VALUE_PATTERNS.find((p) => p.pattern.test(current));
      if (hit) findings.push({ path: path || "(root)", kind: hit.kind });
    } else if (Array.isArray(current)) {
      current.forEach((item, i) => stack.push({ value: item, path: `${path}[${i}]` }));
    } else if (current && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) {
        const childPath = path ? `${path}.${key}` : key;
        if (KEY_PATTERN.test(key)) findings.push({ path: childPath, kind: "SENSITIVE_KEY" });
        stack.push({ value: item, path: childPath });
      }
    }
  }
  return findings;
}
