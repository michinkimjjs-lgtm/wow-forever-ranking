import { Badge } from "@/components/ui/badge";
import type { GearProfile } from "@/lib/config";
import { formatPercent } from "@/lib/format";
import { getMessages, labelOf, t } from "@/lib/i18n";

/**
 * 장비 랭킹 계산 기준 안내 (docs/GEAR-PROFILE.md)
 *
 * - 화면 문구의 값은 모두 Gear Profile 설정에서 읽는다. 설정을 바꾸면 안내도 함께 바뀐다.
 * - 초안(DRAFT)은 "초안"으로 표시하고, 실제 장비 랭킹 계산에 쓰지 않는다는 점을 함께 알린다.
 */
export function GearProfilePanel({ profile }: { profile: GearProfile }) {
  const m = getMessages();
  const g = m.rankings.gearProfile;
  const slotName = (code: string) => labelOf(m.game.slots, code);
  const sorted = [...profile.slots].sort((a, b) => a.displayOrder - b.displayOrder);
  const counted = sorted.filter((s) => s.rankable && !profile.excludedSlots.includes(s.code));
  const excluded = sorted.filter((s) => !s.rankable || profile.excludedSlots.includes(s.code));
  const { minRankableSlotCount: count, minRankableSlotRatio: ratio } = profile.minimumCoverage;
  const entry =
    count !== undefined && ratio !== undefined
      ? t(g.entryBoth, { count, percent: formatPercent(ratio) })
      : count !== undefined
        ? t(g.entryCount, { count })
        : t(g.entryRatio, { percent: formatPercent(ratio ?? 0) });
  const rows = [
    { key: "counted", label: g.counted, value: counted.map((s) => slotName(s.code)).join(" · ") },
    { key: "excluded", label: g.excluded, value: excluded.map((s) => slotName(s.code)).join(" · ") },
    { key: "entry", label: g.entry, value: entry },
    { key: "empty", label: g.emptySlot, value: g.emptyPolicy[profile.emptySlotPolicy] },
    { key: "twoHand", label: g.twoHand, value: g.twoHandPolicy[profile.twoHandWeapon.policy] },
    {
      key: "highest",
      label: g.highestItem,
      value: profile.highestItemRequiresCoverage ? g.highestItemWithCoverage : g.highestItemWithoutCoverage,
    },
  ];
  return (
    <section
      data-gear-profile-panel={profile.status}
      aria-labelledby="gear-profile-title"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="gear-profile-title" className="text-sm font-semibold text-foreground">
          {g.title}
        </h2>
        <Badge variant={profile.status === "APPROVED" ? "success" : "warning"}>{g.status[profile.status]}</Badge>
        <span className="text-xs text-subtle">{t(g.version, { version: profile.version })}</span>
      </div>
      <p className="text-xs text-muted">{profile.status === "APPROVED" ? g.approvedNote : g.draftNote}</p>
      <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {rows.map((row) => (
          <div key={row.key} data-gear-profile-row={row.key} className="contents">
            <dt className="text-subtle">{row.label}</dt>
            <dd className="text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-subtle">{g.rounding}</p>
    </section>
  );
}
