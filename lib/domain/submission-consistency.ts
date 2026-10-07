/**
 * 같은 캐릭터의 여러 제출 비교 (docs/COMMUNITY-RANKING-PLAN.md §6, §7)
 *
 * 식별 우선순위 (Realm은 추가하지 않는다)
 * 1. stableId: 공식 공급원의 안정적인 캐릭터 ID (공식 API가 열리면)
 * 2. guid: 클라이언트 UnitGUID (Collector 제출)
 * 3. 자연 키: region + gameMode + 전체 이름(이름 + 성) 정규화
 * 4. 제출 이력: 위 키로 묶은 뒤 레벨·직업 흐름이 맞는지 비교
 *
 * 이 모듈은 판단만 한다. 저장된 값이나 검증 상태를 바꾸지 않는다.
 */
import { normalizeName } from "./names";

export interface SubmittedObservation {
  submissionId: string;
  /** 제출자를 구분하는 익명 키 (Uploader 설치 단위 해시 등). 없으면 null → 독립 제출로 세지 않음 */
  submitterKey: string | null;
  observedAt: Date;
  region: string;
  gameMode: string;
  characterName: string;
  stableId?: string | null;
  guid?: string | null;
  level: number;
  classCode?: string | null;
  raceCode?: string | null;
  factionCode?: string | null;
}

export type IdentityKeyKind = "stable" | "guid" | "natural";

export function identityKeyOf(obs: SubmittedObservation): { kind: IdentityKeyKind; key: string } {
  if (obs.stableId) return { kind: "stable", key: `stable:${obs.stableId}` };
  if (obs.guid) return { kind: "guid", key: `guid:${obs.guid}` };
  return { kind: "natural", key: naturalKeyOf(obs) };
}

export function naturalKeyOf(obs: Pick<SubmittedObservation, "region" | "gameMode" | "characterName">): string {
  return `name:${obs.region}|${obs.gameMode}|${normalizeName(obs.characterName)}`;
}

/**
 * 제출을 캐릭터 단위로 묶는다.
 * 강한 키(stable / guid)가 있는 제출은 그 키로 묶고, 강한 키가 없는 제출은 같은 자연 키를 가진
 * 강한 키 그룹이 정확히 하나일 때만 그 그룹에 붙인다. 둘 이상이면(이름 재사용 등) 따로 둔다.
 */
export function groupByCharacter(observations: readonly SubmittedObservation[]): SubmittedObservation[][] {
  const groups = new Map<string, SubmittedObservation[]>();
  const strongByNatural = new Map<string, Set<string>>();
  for (const obs of observations) {
    const id = identityKeyOf(obs);
    if (id.kind === "natural") continue;
    if (!groups.has(id.key)) groups.set(id.key, []);
    groups.get(id.key)!.push(obs);
    const natural = naturalKeyOf(obs);
    if (!strongByNatural.has(natural)) strongByNatural.set(natural, new Set());
    strongByNatural.get(natural)!.add(id.key);
  }
  for (const obs of observations) {
    if (identityKeyOf(obs).kind !== "natural") continue;
    const natural = naturalKeyOf(obs);
    const strong = strongByNatural.get(natural);
    const key = strong && strong.size === 1 ? [...strong][0]! : natural;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(obs);
  }
  return [...groups.values()].map((g) => [...g].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime()));
}

export type SubmissionIssueCode =
  | "LEVEL_DECREASE"
  | "SAME_TIME_DIFFERENT_LEVEL"
  | "CLASS_CHANGED"
  | "STRONG_ID_MISMATCH"
  | "RACE_OR_FACTION_CHANGED"
  | "NAME_CHANGED";

export interface SubmissionIssue {
  code: SubmissionIssueCode;
  severity: "conflict" | "warning" | "info";
  submissionIds: string[];
}

export type SubmissionConsistency = "SINGLE" | "CONSISTENT" | "CORROBORATED" | "CONFLICT";

export interface SubmissionComparison {
  status: SubmissionConsistency;
  issues: SubmissionIssue[];
  /** 가장 최근 상태(레벨·직업)에 동의하는 서로 다른 제출자 수 */
  independentAgreements: number;
}

/**
 * 한 캐릭터의 제출들을 비교한다.
 * - 레벨이 시간이 지나 낮아짐, 같은 시각(허용 오차 안)에 레벨이 다름, 직업 변경, 강한 키 불일치 → conflict
 * - 종족·진영 변경 → warning (게임 서비스로 바뀔 수 있는지 Forever에서는 확인 필요)
 * - 같은 강한 키에서 이름 변경 → info (이름 변경으로 보고 같은 캐릭터 유지)
 */
export function compareSubmissions(
  observations: readonly SubmittedObservation[],
  options: { sameTimeToleranceMs?: number } = {},
): SubmissionComparison {
  const tolerance = options.sameTimeToleranceMs ?? 5 * 60_000;
  const list = [...observations].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  if (list.length <= 1) return { status: "SINGLE", issues: [], independentAgreements: list[0]?.submitterKey ? 1 : 0 };

  const issues: SubmissionIssue[] = [];
  const add = (code: SubmissionIssueCode, severity: SubmissionIssue["severity"], ids: string[]) => {
    if (!issues.some((i) => i.code === code && i.submissionIds.join() === ids.join())) issues.push({ code, severity, submissionIds: ids });
  };

  for (const kind of ["stableId", "guid"] as const) {
    const values = new Set(list.map((o) => o[kind]).filter((v): v is string => !!v));
    if (values.size > 1) add("STRONG_ID_MISMATCH", "conflict", list.filter((o) => o[kind]).map((o) => o.submissionId));
  }

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const ids = [a.submissionId, b.submissionId];
      const gap = b.observedAt.getTime() - a.observedAt.getTime();
      if (gap <= tolerance && a.level !== b.level) add("SAME_TIME_DIFFERENT_LEVEL", "conflict", ids);
      else if (b.level < a.level) add("LEVEL_DECREASE", "conflict", ids);
      if (a.classCode && b.classCode && a.classCode !== b.classCode) add("CLASS_CHANGED", "conflict", ids);
      if ((a.raceCode && b.raceCode && a.raceCode !== b.raceCode) || (a.factionCode && b.factionCode && a.factionCode !== b.factionCode)) {
        add("RACE_OR_FACTION_CHANGED", "warning", ids);
      }
      const sameStrong = (a.stableId && a.stableId === b.stableId) || (a.guid && a.guid === b.guid);
      if (sameStrong && normalizeName(a.characterName) !== normalizeName(b.characterName)) add("NAME_CHANGED", "info", ids);
    }
  }

  const latest = list[list.length - 1]!;
  const agreeing = new Set(
    list
      .filter((o) => o.level === latest.level && (o.classCode ?? null) === (latest.classCode ?? null) && o.submitterKey)
      .map((o) => o.submitterKey!),
  );
  const status: SubmissionConsistency = issues.some((i) => i.severity === "conflict")
    ? "CONFLICT"
    : agreeing.size >= 2
      ? "CORROBORATED"
      : "CONSISTENT";
  return { status, issues, independentAgreements: agreeing.size };
}
