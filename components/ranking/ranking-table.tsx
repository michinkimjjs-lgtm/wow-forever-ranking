import {
  CharacterLink,
  ClassLabel,
  FactionLabel,
  GuildLink,
  RelativeTime,
  VerificationBadge,
} from "@/components/game-labels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAverageItemLevel } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import type { RankingRow, RankingType } from "@/lib/ranking/types";
import { cn } from "@/lib/utils";

/** 랭킹 표. 순위는 서버가 계산한 값만 표시한다. */
export function RankingTable({ type, rows, now }: { type: RankingType; rows: RankingRow[]; now: Date }) {
  const c = getMessages().rankings.columns;
  const none = getMessages().common.status.none;

  const rankCell = (row: RankingRow) => (
    <TableCell className={cn("tabular w-14 font-semibold", row.rank <= 3 ? "text-accent" : "text-muted")}>{row.rank}</TableCell>
  );
  const nameCell = (row: RankingRow) => (
    <TableCell>
      <CharacterLink character={row} />
    </TableCell>
  );

  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>{c.rank}</TableHead>
          <TableHead>{c.character}</TableHead>
          {type === "level" && (
            <>
              <TableHead className="text-right">{c.level}</TableHead>
              <TableHead>{c.class}</TableHead>
              <TableHead>{c.faction}</TableHead>
              <TableHead className="hidden md:table-cell">{c.guild}</TableHead>
              <TableHead className="hidden sm:table-cell">{c.lastChecked}</TableHead>
              <TableHead className="hidden lg:table-cell">{c.verification}</TableHead>
            </>
          )}
          {type === "gear" && (
            <>
              <TableHead className="text-right">{c.averageItemLevel}</TableHead>
              <TableHead className="text-right">{c.highestItem}</TableHead>
              <TableHead>{c.class}</TableHead>
              <TableHead className="hidden sm:table-cell">{c.faction}</TableHead>
              <TableHead className="hidden md:table-cell">{c.guild}</TableHead>
              <TableHead className="hidden lg:table-cell">{c.lastChecked}</TableHead>
            </>
          )}
          {type === "highest-item" && (
            <>
              <TableHead className="text-right">{c.highestItemLevel}</TableHead>
              <TableHead className="text-right">{c.averageItemLevel}</TableHead>
              <TableHead className="hidden md:table-cell">{c.itemName}</TableHead>
              <TableHead>{c.class}</TableHead>
              <TableHead className="hidden sm:table-cell">{c.faction}</TableHead>
            </>
          )}
        </tr>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.characterId}>
            {rankCell(row)}
            {nameCell(row)}
            {type === "level" && (
              <>
                <TableCell className="tabular text-right font-semibold">{row.level}</TableCell>
                <TableCell>
                  <ClassLabel code={row.classCode} />
                </TableCell>
                <TableCell>
                  <FactionLabel code={row.factionCode} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <GuildLink guild={row.guild} region={row.region} gameMode={row.gameMode} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <RelativeTime date={row.lastSeenAt} now={now} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <VerificationBadge status={row.verificationStatus} />
                </TableCell>
              </>
            )}
            {type === "gear" && (
              <>
                <TableCell className="tabular text-right font-semibold">{formatAverageItemLevel(row.averageItemLevel)}</TableCell>
                <TableCell className="tabular text-right">{row.highestItemLevel ?? none}</TableCell>
                <TableCell>
                  <ClassLabel code={row.classCode} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <FactionLabel code={row.factionCode} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <GuildLink guild={row.guild} region={row.region} gameMode={row.gameMode} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <RelativeTime date={row.lastSeenAt} now={now} />
                </TableCell>
              </>
            )}
            {type === "highest-item" && (
              <>
                <TableCell className="tabular text-right font-semibold">{row.highestItemLevel ?? none}</TableCell>
                <TableCell className="tabular text-right">{formatAverageItemLevel(row.averageItemLevel)}</TableCell>
                <TableCell className="hidden max-w-64 truncate md:table-cell">{row.highestItemName ?? none}</TableCell>
                <TableCell>
                  <ClassLabel code={row.classCode} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <FactionLabel code={row.factionCode} />
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
