import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, ContributeNav, ContributeStepper, RuntimeCheckBadge } from "@/components/contribute/contribute-nav";
import { PageHeader } from "@/components/page-header";
import { collectorManifest } from "@/lib/collector/manifest";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.contributeInstall;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/contribute/install" });
}

/** 단계별로 이어지는 화면 (없으면 링크 없음) */
const STEP_LINK: Record<number, string> = { 0: routes.contributeDownload(), 7: routes.contributeHowToUse(), 9: routes.submit() };

/** 복사한 뒤의 폴더 모습 (파일 목록은 배포 manifest에서 가져온다) */
function folderTree(): string {
  const files = collectorManifest.files.map((f) => f.path.split("/").pop() ?? f.path);
  return [
    "Interface",
    "└── AddOns",
    `    └── ${collectorManifest.addonName}`,
    ...files.map((name, i) => `        ${i === files.length - 1 ? "└──" : "├──"} ${name}`),
  ].join("\n");
}

export default function ContributeInstallPage() {
  const c = getMessages().contribute;
  const i = c.install;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={i.title}>
        <p className="text-sm text-muted">{i.lead}</p>
      </PageHeader>

      <ContributeNav current="install" />

      <p role="note" className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
        {i.pathNotice}
      </p>

      <ol className="flex flex-col gap-2">
        {i.steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{step.title}</h2>
                {step.runtime ? <RuntimeCheckBadge /> : null}
              </div>
              <p className="break-words text-sm text-muted">{step.body}</p>
              {index === 2 ? <CodeBlock label={i.addonPathTitle}>{i.addonPath}</CodeBlock> : null}
              {index === 8 ? <CodeBlock label={i.resultPathTitle}>{i.resultPath}</CodeBlock> : null}
              {STEP_LINK[index] ? (
                <Link href={STEP_LINK[index]} className="text-sm text-accent hover:underline">
                  {index === 0 ? c.nav.download : index === 7 ? c.nav.howToUse : c.nav.submit}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="tree-title" className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="tree-title" className="text-sm font-semibold text-foreground">
            {i.treeTitle}
          </h2>
          <CodeBlock>{folderTree()}</CodeBlock>
          <p className="text-xs text-subtle">{i.resultPathTitle}</p>
          <CodeBlock>{i.resultPath}</CodeBlock>
          <p className="text-xs text-subtle">{i.accountFolder}</p>
        </section>
        <section aria-labelledby="trouble-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="trouble-title" className="mb-2 text-sm font-semibold text-foreground">
            {i.troubleTitle}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {i.trouble.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
        <RuntimeCheckBadge />
        <span>{c.runtimeCheckNote}</span>
      </p>

      <ContributeStepper previous="download" next="howToUse" />
    </div>
  );
}
