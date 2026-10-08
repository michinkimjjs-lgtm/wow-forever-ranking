import type { Metadata } from "next";
import Link from "next/link";
import { CONTRIBUTE_HREF, ContributeNav, ContributeStepper, RankingBasisNotice } from "@/components/contribute/contribute-nav";
import { PageHeader } from "@/components/page-header";
import { getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.contribute;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/contribute" });
}

/** 단계 번호 → 안내 화면 (5단계 "검증 및 검토"는 링크 없음) */
const STEP_LINKS = [CONTRIBUTE_HREF.download, CONTRIBUTE_HREF.install, CONTRIBUTE_HREF.howToUse, CONTRIBUTE_HREF.submit, null];

export default function ContributePage() {
  const c = getMessages().contribute;
  const o = c.overview;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={o.title}>
        <p className="text-base text-foreground">{o.lead}</p>
        <p className="text-sm text-muted">{o.summary}</p>
      </PageHeader>

      <RankingBasisNotice />

      <section aria-labelledby="steps-title" className="flex flex-col gap-3">
        <h2 id="steps-title" className="text-lg font-semibold text-foreground">
          {o.stepsTitle}
        </h2>
        <ol className="flex flex-col gap-2">
          {o.steps.map((step, index) => {
            const href = STEP_LINKS[index];
            return (
              <li key={step.title} className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="break-words text-sm text-muted">{step.body}</p>
                  {href && step.link ? (
                    <Link href={href} className="text-sm text-accent hover:underline">
                      {step.link}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-subtle">
          {o.timeTitle}: {o.time}
        </p>
      </section>

      <ContributeNav current="overview" />

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="safety-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="safety-title" className="mb-2 text-sm font-semibold text-foreground">
            {o.safetyTitle}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {o.safety.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="glossary-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="glossary-title" className="mb-2 text-sm font-semibold text-foreground">
            {o.glossaryTitle}
          </h2>
          <dl className="flex flex-col gap-1.5 text-sm">
            {o.glossary.map((g) => (
              <div key={g.term}>
                <dt className="inline font-medium text-foreground">{g.term}</dt>
                <dd className="inline text-muted"> — {g.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <ContributeStepper next="download" nextLabel={o.start} />
    </div>
  );
}
