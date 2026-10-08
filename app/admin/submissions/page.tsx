import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { getAdminSettings } from "@/lib/config/env";
import { dataOriginOf } from "@/lib/domain/data-origin";
import { SUBMISSION_REVIEW_STATUSES, type SubmissionReviewStatus } from "@/lib/domain/enums";
import { formatKstDateTime, formatPercent } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { getServerContext } from "@/lib/server/context";
import { listSubmissions, type SubmissionComparison, type SubmissionRow } from "@/lib/submissions/review";
import { acceptAction, logoutAction, rejectAction } from "../actions";

const PAGE_SIZE = 50;

/** 제출 데이터는 Collector(애드온) 파일이다. 데이터 출처 구분은 커뮤니티 제출 (lib/domain/data-origin.ts) */
const SUBMISSION_DATA_ORIGIN = dataOriginOf("addon");

const STATUS_VARIANT: Record<SubmissionReviewStatus, "info" | "success" | "default" | "danger"> = {
  PENDING: "info",
  ACCEPTED: "success",
  REJECTED: "default",
  CONFLICT: "danger",
};

/** 제출 요약 필드 → 미리보기 문구 키 */
const SUMMARY_FIELDS = [
  ["name", "name"],
  ["surname", "surname"],
  ["level", "level"],
  ["className", "className"],
  ["raceName", "race"],
  ["factionName", "faction"],
  ["guildName", "guild"],
  ["gearCount", "gearCount"],
  ["averageItemLevel", "averageItemLevel"],
  ["highestItemLevel", "highestItemLevel"],
  ["coverage", "coverage"],
  ["sourceBuild", "build"],
] as const;

function ReviewForm({ row, returnStatus }: { row: SubmissionRow; returnStatus: string }) {
  const a = getMessages().admin.submissions.actions;
  return (
    <form action={acceptAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="returnStatus" value={returnStatus} />
      <input
        name="note"
        maxLength={500}
        placeholder={a.note}
        aria-label={a.note}
        className="h-8 rounded-md border border-border-strong bg-surface-raised px-2 text-xs text-foreground"
      />
      {row.reviewStatus === "CONFLICT" ? (
        <label className="flex items-center gap-2 text-xs text-warning">
          <input type="checkbox" name="overrideConflict" className="h-4 w-4" />
          {a.overrideConflict}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          {a.accept}
        </Button>
        <Button type="submit" formAction={rejectAction} size="sm" variant="outline">
          {a.reject}
        </Button>
      </div>
    </form>
  );
}

function Detail({ row }: { row: SubmissionRow }) {
  const m = getMessages();
  const d = m.admin.submissions.detail;
  const none = m.admin.submissions.none;
  const comparison = row.comparison as SubmissionComparison | null;
  const issues = (row.issues as { code?: string; path?: string }[]) ?? [];
  const summary = row.summary as Record<string, unknown>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-accent">{d.summary}</summary>
      <div className="mt-2 flex flex-col gap-2 text-muted">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="text-subtle">{d.channel}</dt>
          <dd>{m.admin.submissions.channel[row.channel]}</dd>
          <dt className="text-subtle">{d.dataSource}</dt>
          <dd>{m.game.dataOrigins[SUBMISSION_DATA_ORIGIN]}</dd>
          <dt className="text-subtle">{d.reviewStatus}</dt>
          <dd>{m.submit.reviewStatuses[row.reviewStatus]}</dd>
          <dt className="text-subtle">{d.collector}</dt>
          <dd>{typeof summary.collectorVersion === "string" ? summary.collectorVersion : none}</dd>
          <dt className="text-subtle">{d.exportSchema}</dt>
          <dd>{typeof summary.exportSchemaVersion === "number" ? summary.exportSchemaVersion : none}</dd>
        </dl>
        <div>
          <p className="text-subtle">{d.preview}</p>
          <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {SUMMARY_FIELDS.map(([key, label]) => (
              <li key={key} className="break-words">
                {m.submit.preview[label]}: {summary[key] === null || summary[key] === undefined ? none : String(summary[key])}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-subtle">{d.changes}</p>
          {comparison && comparison.changes.length > 0 ? (
            <ul>
              {comparison.changes.map((c) => (
                <li key={c.field}>
                  {m.submit.changeFields[c.field] ?? c.field}: {c.before ?? none} → {c.after ?? none}
                </li>
              ))}
            </ul>
          ) : (
            <p>{d.noChanges}</p>
          )}
        </div>
        {issues.length > 0 ? (
          <div>
            <p className="text-subtle">{d.issues}</p>
            <ul>
              {issues.map((issue, i) => (
                <li key={i}>
                  {(issue.code && (m.admin.submissions.issueCodes[issue.code] ??
                    m.submissions.issues[issue.code as keyof typeof m.submissions.issues])) ?? issue.code}
                  {issue.path ? ` (${issue.path})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {row.consentVersion ? (
          <p>
            {d.consent}:{" "}
            {t(d.consentValue, {
              consent: row.consentVersion,
              policy: row.policyVersion ?? none,
              at: row.consentedAt ? formatKstDateTime(row.consentedAt) : none,
            })}
          </p>
        ) : null}
        {row.reviewedAt ? (
          <p>
            {d.reviewedAt}: {formatKstDateTime(row.reviewedAt)}
          </p>
        ) : null}
        {row.reviewNote ? (
          <p className="break-words">
            {d.note}: {row.reviewNote}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; result?: string }>;
}) {
  if (!getAdminSettings().enabled) notFound();
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const m = getMessages();
  const a = m.admin.submissions;
  const params = await searchParams;
  const status = SUBMISSION_REVIEW_STATUSES.find((s) => s === params.status);
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.page ?? "1", 10) || 1));
  const ctx = await getServerContext();

  const header = (
    <PageHeader title={a.title} description={a.description}>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm">
          {m.admin.logout}
        </Button>
      </form>
    </PageHeader>
  );

  if (ctx.appEnv === "mock") {
    return (
      <>
        {header}
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{a.mockEnvironment}</p>
      </>
    );
  }

  const { rows, total, counts } = await listSubmissions(ctx.db, ctx.appEnv, { status, page, pageSize: PAGE_SIZE });
  const outcome = params.result ? (a.outcomes[params.result] ?? m.submit.reviewStatuses[params.result as SubmissionReviewStatus]) : null;
  const none = a.none;

  return (
    <>
      {header}
      {outcome ? (
        <p role="status" className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-2 text-sm text-foreground">
          {outcome}
        </p>
      ) : null}
      <nav className="flex flex-wrap gap-2 text-sm" aria-label={a.columns.status}>
        <Link href="/admin/submissions" className={!status ? "text-accent" : "text-muted hover:text-foreground"}>
          {a.filterAll}
        </Link>
        {SUBMISSION_REVIEW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/submissions?status=${s}`}
            className={status === s ? "text-accent" : "text-muted hover:text-foreground"}
          >
            {m.submit.reviewStatuses[s]} ({counts[s]})
          </Link>
        ))}
      </nav>
      <p className="text-xs text-subtle">{t(a.total, { total })}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">{a.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-border text-xs text-subtle">
              <tr>
                <th className="px-3 py-2">{a.columns.id}</th>
                <th className="px-3 py-2">{a.columns.character}</th>
                <th className="px-3 py-2">{a.columns.origin}</th>
                <th className="px-3 py-2">{a.columns.submittedAt}</th>
                <th className="px-3 py-2">{a.columns.observedAt}</th>
                <th className="px-3 py-2">{a.columns.level}</th>
                <th className="px-3 py-2">{a.columns.coverage}</th>
                <th className="px-3 py-2">{a.columns.verification}</th>
                <th className="px-3 py-2">{a.columns.duplicate}</th>
                <th className="px-3 py-2">{a.columns.conflict}</th>
                <th className="px-3 py-2">{a.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const comparison = row.comparison as SubmissionComparison | null;
                const reviewable = row.reviewStatus === "PENDING" || row.reviewStatus === "CONFLICT";
                return (
                  <tr key={row.id} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-muted" title={row.id}>
                      {row.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-foreground">{row.characterName}</p>
                      <Detail row={row} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <Badge>{a.channel[row.channel]}</Badge>
                        <Badge variant="info">{m.game.dataOrigins[SUBMISSION_DATA_ORIGIN]}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{formatKstDateTime(row.submittedAt)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{row.observedAt ? formatKstDateTime(row.observedAt) : none}</td>
                    <td className="px-3 py-2">{row.level ?? none}</td>
                    <td className="px-3 py-2">{row.gearCoverage !== null ? `${formatPercent(row.gearCoverage)}%` : none}</td>
                    <td className="px-3 py-2">
                      <Badge>{m.game.verificationStatuses[row.verificationStatus]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.duplicateCount > 0 ? t(a.duplicateValue, { count: row.duplicateCount }) : a.no}
                    </td>
                    <td className="px-3 py-2 text-xs">{row.reviewStatus === "CONFLICT" || comparison?.conflict ? a.yes : a.no}</td>
                    <td className="flex min-w-[220px] flex-col gap-2 px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={STATUS_VARIANT[row.reviewStatus]}>{m.submit.reviewStatuses[row.reviewStatus]}</Badge>
                        {row.blockedReason ? <Badge variant="warning">{a.blocked[row.blockedReason] ?? row.blockedReason}</Badge> : null}
                      </div>
                      {reviewable ? <ReviewForm row={row} returnStatus={status ?? ""} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > page * PAGE_SIZE ? (
        <Link className="text-sm text-accent" href={`/admin/submissions?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) })}`}>
          {m.common.actions.next}
        </Link>
      ) : null}
    </>
  );
}
