import type { Metadata } from "next";
import { CodeBlock, ContributeNav, ContributeStepper, RuntimeCheckBadge } from "@/components/contribute/contribute-nav";
import { PageHeader } from "@/components/page-header";
import { collectorRelease } from "@/config/collector";
import { isCollectorDownloadAvailable } from "@/lib/collector/availability";
import { collectorManifest } from "@/lib/collector/manifest";
import { formatInteger } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.contributeDownload;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/contribute/download" });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-xs text-subtle sm:w-40 sm:text-sm">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ListSection({ id, title, items, tone = "default" }: { id: string; title: string; items: readonly string[]; tone?: "default" | "deny" }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface px-4 py-4">
      <h2 id={id} className="mb-2 text-sm font-semibold text-foreground">
        {title}
      </h2>
      <ul className="flex flex-col gap-1 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className={tone === "deny" ? "text-danger" : "text-success"}>
              {tone === "deny" ? "✕" : "✓"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ContributeDownloadPage() {
  const d = getMessages().contribute.download;
  const manifest = collectorManifest;
  // 다운로드 파일은 빌드 전에 만들어진다(scripts/build-collector.ts). 없으면 버튼 대신 준비 중 안내를 보여 준다.
  const available = isCollectorDownloadAvailable();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={d.title}>
        <p className="text-sm text-muted">{d.lead}</p>
      </PageHeader>

      <ContributeNav current="download" />

      <section aria-labelledby="addon-notice" className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-4">
        <h2 id="addon-notice" className="text-base font-semibold text-accent">
          {d.addonNotice}
        </h2>
        <p className="text-sm text-muted">{d.addonNoticeDetail}</p>
        {available ? (
          <a
            href={manifest.downloadPath}
            download={manifest.fileName}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-strong sm:w-auto sm:self-start"
          >
            {d.button}
          </a>
        ) : (
          <p role="status" className="text-sm text-warning">
            {d.unavailable}
          </p>
        )}
      </section>

      <section aria-labelledby="file-info" className="rounded-lg border border-border bg-surface px-4 py-3">
        <h2 id="file-info" className="mb-1 text-sm font-semibold text-foreground">
          {d.info.title}
        </h2>
        <dl>
          <Row label={d.info.collectorVersion}>
            <span className="tabular font-semibold text-accent">{manifest.version}</span>
          </Row>
          <Row label={d.info.exportSchemaVersion}>{t(d.info.exportSchemaValue, { version: manifest.exportSchemaVersion })}</Row>
          <Row label={d.info.client}>{d.info.clientValue}</Row>
          <Row label={d.info.interfaceVersion}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular">{manifest.interfaceVersion ?? "-"}</span>
              <RuntimeCheckBadge />
            </span>
          </Row>
          <Row label={d.info.fileName}>
            <span className="font-mono text-xs">{manifest.fileName}</span>
          </Row>
          <Row label={d.info.fileSize}>
            {t(d.info.fileSizeValue, { kb: (manifest.size / 1024).toFixed(1), bytes: formatInteger(manifest.size) })}
          </Row>
          <Row label={d.info.sha256}>
            <span className="block break-all font-mono text-xs" data-testid="collector-sha256">
              {manifest.sha256}
            </span>
          </Row>
          <Row label={d.info.releaseDate}>{manifest.releaseDate}</Row>
        </dl>
        <p className="mt-2 text-xs text-subtle">{d.info.sha256Help}</p>
        <div className="mt-1">
          <CodeBlock>{collectorRelease.checksumCommand}</CodeBlock>
        </div>
      </section>

      <section aria-labelledby="versions-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <h2 id="versions-title" className="mb-2 text-sm font-semibold text-foreground">
          {d.versionsTitle}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {d.versions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <ListSection id="collect-title" title={d.collectTitle} items={d.collect} />
        <ListSection id="not-collect-title" title={d.notCollectTitle} items={d.notCollect} tone="deny" />
        <section aria-labelledby="network-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="network-title" className="mb-2 text-sm font-semibold text-foreground">
            {d.networkTitle}
          </h2>
          <p className="text-sm text-foreground">{d.network}</p>
          <p className="mt-1 text-xs text-muted">{d.networkDetail}</p>
        </section>
        <section aria-labelledby="export-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="export-title" className="mb-2 text-sm font-semibold text-foreground">
            {d.exportTitle}
          </h2>
          <p className="text-sm text-foreground">{d.export}</p>
          <p className="mt-1 text-xs text-muted">{d.exportDetail}</p>
        </section>
      </div>

      <section aria-labelledby="contents-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <h2 id="contents-title" className="mb-2 text-sm font-semibold text-foreground">
          {d.contentsTitle}
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {manifest.files.map((file) => {
            const name = file.path.split("/").pop() ?? file.path;
            return (
              <li key={file.path} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="font-mono text-xs text-foreground">{file.path}</span>
                <span className="text-xs text-muted">{d.contentsDescription[name] ?? ""}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <ContributeStepper previous="overview" next="install" />
    </div>
  );
}
