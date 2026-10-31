/**
 * robots.txt 확인 (단순 규칙: 해당 User-agent 그룹, 없으면 "*" 그룹의 Allow/Disallow 중 가장 긴 일치)
 * 와일드카드(*, $)는 지원하지 않는다. 판단할 수 없으면 허용하지 않는 쪽으로 처리한다.
 */

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      // 빈 Disallow는 전체 허용을 뜻한다
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** userAgentToken: 우리 수집기 이름 (예: foreverrankimagecollector) */
export function isPathAllowed(robotsText: string, userAgentToken: string, path: string): boolean {
  const group = pickGroup(parseRobots(robotsText), userAgentToken);
  if (!group) return true;
  // 와일드카드 규칙은 해석하지 않는다 → 허용하지 않는 쪽으로
  if (group.rules.some((r) => /[*$]/.test(r.path))) return false;
  let best: { allow: boolean; path: string } | null = null;
  for (const rule of group.rules) {
    if (path.startsWith(rule.path) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

function pickGroup(groups: Group[], token: string): Group | undefined {
  const t = token.toLowerCase();
  return groups.find((g) => g.agents.some((a) => a !== "*" && t.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
}
