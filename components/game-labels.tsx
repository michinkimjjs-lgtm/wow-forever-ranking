import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/domain/enums";
import { formatKstDateTime, formatRelativeTime } from "@/lib/format";
import { getMessages, labelOf } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** 직업 색상 (표시용 스타일. 코드가 없으면 기본 색) */
const CLASS_COLORS: Record<string, string> = {
  warrior: "#c69b6d",
  paladin: "#f48cba",
  hunter: "#aad372",
  rogue: "#fff468",
  priest: "#ffffff",
  shaman: "#2a8ef0",
  mage: "#3fc7eb",
  warlock: "#8788ee",
  druid: "#ff7c0a",
};

export function ClassLabel({ code }: { code: string | null }) {
  const color = code ? CLASS_COLORS[code] : undefined;
  return <span style={color ? { color } : undefined}>{labelOf(getMessages().game.classes, code)}</span>;
}

export function FactionLabel({ code }: { code: string | null }) {
  return (
    <span className={cn(code === "alliance" && "text-alliance", code === "horde" && "text-horde")}>
      {labelOf(getMessages().game.factions, code)}
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const label = getMessages().game.verificationStatuses[status];
  const variant =
    status === "VERIFIED" || status === "LOG_VERIFIED"
      ? "success"
      : status === "MOCK"
        ? "warning"
        : status === "COMMUNITY_SUBMITTED"
          ? "info"
          : "default";
  return <Badge variant={variant}>{label}</Badge>;
}

export function CharacterLink({
  character,
  className,
}: {
  character: { characterName: string; region: string; gameMode: string; slug: string; classCode?: string | null };
  className?: string;
}) {
  const color = character.classCode ? CLASS_COLORS[character.classCode] : undefined;
  return (
    <Link
      href={routes.character(character)}
      className={cn("font-medium hover:underline", className)}
      style={color ? { color } : undefined}
    >
      {character.characterName}
    </Link>
  );
}

export function GuildLink({
  guild,
  region,
  gameMode,
}: {
  guild: { name: string; slug: string } | null;
  region: string;
  gameMode: string;
}) {
  if (!guild) return <span className="text-subtle">{getMessages().common.status.none}</span>;
  return (
    <Link href={routes.guild({ region, gameMode, slug: guild.slug })} className="text-foreground/90 hover:text-accent hover:underline">
      {guild.name}
    </Link>
  );
}

/** 상대 시각을 보여주고, 마우스를 올리면 KST 절대 시각을 보여준다. */
export function RelativeTime({ date, now }: { date: Date; now: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatKstDateTime(date)} className="text-muted">
      {formatRelativeTime(date, now)}
    </time>
  );
}

const QUALITY_CLASS: Record<string, string> = {
  poor: "text-quality-poor",
  common: "text-quality-common",
  uncommon: "text-quality-uncommon",
  rare: "text-quality-rare",
  epic: "text-quality-epic",
};

export function ItemName({ name, quality }: { name: string; quality: string | null }) {
  return <span className={cn(quality ? QUALITY_CLASS[quality] : undefined)}>{name}</span>;
}
