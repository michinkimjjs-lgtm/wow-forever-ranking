import type { Metadata } from "next";
import { CodeBlock, ContributeNav, ContributeStepper, RuntimeCheckBadge } from "@/components/contribute/contribute-nav";
import { PageHeader } from "@/components/page-header";
import { collectorManifest } from "@/lib/collector/manifest";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.contributeHowToUse;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/contribute/how-to-use" });
}

export default function ContributeHowToUsePage() {
  const c = getMessages().contribute;
  const h = c.howToUse;
  // 테스트용 예시 파일은 테스트 데이터 배포(mock)에서만 제공한다.
  const isTestEnvironment = getAppEnvironmentSafe() === "mock";
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={h.title}>
        <p className="text-sm text-muted">{h.lead}</p>
      </PageHeader>

      <ContributeNav current="howToUse" />

      <section aria-labelledby="commands-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <h2 id="commands-title" className="mb-3 text-base font-semibold text-foreground">
          {h.commandsTitle}
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th scope="col" className="w-28 pb-2 sm:w-36">
                {h.commandColumn}
              </th>
              <th scope="col" className="pb-2">
                {h.descriptionColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {h.commands.map((row) => (
              <tr key={row.command} className="border-t border-border align-top">
                <td className="py-2 pr-3">
                  <code className="whitespace-nowrap rounded bg-background px-1.5 py-0.5 font-mono text-xs text-accent">{row.command}</code>
                </td>
                <td className="py-2 text-muted">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-subtle">{h.commandsNote}</p>
      </section>

      <section aria-labelledby="flow-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 id="flow-title" className="text-base font-semibold text-foreground">
            {h.flowTitle}
          </h2>
          <RuntimeCheckBadge />
        </div>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          {h.flow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-subtle">
          {h.autoTitle}: {h.auto}
        </p>
      </section>

      <section aria-labelledby="file-title" className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="file-title" className="text-base font-semibold text-foreground">
            {h.fileTitle}
          </h2>
          <RuntimeCheckBadge />
        </div>
        <CodeBlock>{h.fileLocation}</CodeBlock>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {h.fileRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="text-xs text-subtle">{h.fileRuntime}</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="version-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="version-title" className="mb-2 text-sm font-semibold text-foreground">
            {h.versionTitle}
          </h2>
          <p className="text-sm text-muted">
            {t(h.version, { collector: collectorManifest.version, schema: collectorManifest.exportSchemaVersion })}
          </p>
        </section>
        <section aria-labelledby="known-issue-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 id="known-issue-title" className="text-sm font-semibold text-foreground">
              {h.knownIssueTitle}
            </h2>
            <RuntimeCheckBadge />
          </div>
          <p className="text-sm text-muted">{h.knownIssue}</p>
        </section>
      </div>

      {isTestEnvironment ? (
        <section aria-labelledby="test-title" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-4">
          <h2 id="test-title" className="text-sm font-semibold text-warning">
            {h.testTitle}
          </h2>
          <p className="text-sm text-muted">{h.testBody}</p>
          <p className="text-xs text-subtle">{h.testNote}</p>
          <a
            href={routes.contributeTestExport()}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-warning/60 px-4 text-sm text-foreground hover:bg-surface-raised sm:w-auto sm:self-start"
          >
            {h.testButton}
          </a>
        </section>
      ) : null}

      <ContributeStepper previous="install" next="submit" />
    </div>
  );
}
