import type { Metadata } from "next";
import Link from "next/link";
import { ContributeNav } from "@/components/contribute/contribute-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitForm } from "@/components/submit/submit-form";
import { collectorRelease } from "@/config/collector";
import { submissionPolicy } from "@/config/submissions";
import { resolveSlotMappingProfile } from "@/lib/config";
import { getPublicSubmissionSettings } from "@/lib/config/env";
import { getMessages, t } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { issueCsrfToken } from "@/lib/submissions/security";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.submit;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/submit" });
}

export default function SubmitPage() {
  const s = getMessages().submit;
  const appEnv = getAppEnvironmentSafe();
  const settings = getPublicSubmissionSettings();
  const enabled = settings.enabled && appEnv !== null;
  const verifyOnly = appEnv !== "beta" && appEnv !== "live";
  // 제출은 실제 영역(beta / live) 기준 설정으로 확인한다. mock 배포는 beta 기준으로 검증만 한다.
  const target = appEnv === "live" ? "live" : "beta";
  const slotProfile = resolveSlotMappingProfile(target, "*");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={s.title}>
        {s.description.map((line) => (
          <p key={line} className="text-sm text-muted">
            {line}
          </p>
        ))}
      </PageHeader>

      <ContributeNav current="submit" />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3 text-xs sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
        <dt className="text-subtle">{s.scope.range}</dt>
        <dd className="text-foreground">{s.scope.rangeValue}</dd>
        <dt className="text-subtle">{s.scope.source}</dt>
        <dd className="text-foreground">{s.scope.sourceValue}</dd>
        <dt className="text-subtle">{s.scope.verification}</dt>
        <dd className="text-foreground">{s.scope.verificationValue}</dd>
      </dl>

      {!enabled ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <p className="font-medium text-warning">{s.disabled.title}</p>
          <p className="text-muted">{s.disabled.body}</p>
        </div>
      ) : verifyOnly ? (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">{s.mockNotice}</p>
      ) : null}

      <section aria-labelledby="before-submit-title" className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-4">
        <h2 id="before-submit-title" className="mb-2 text-base font-semibold text-accent">
          {s.beforeSubmit.title}
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {s.beforeSubmit.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                ✓
              </span>
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          {s.beforeSubmit.noFile}{" "}
          <Link href={routes.contribute()} className="text-accent hover:underline">
            {s.beforeSubmit.guideLink}
          </Link>
        </p>
      </section>

      <SubmitForm
        endpoint="/api/v1/submissions/character"
        csrfToken={enabled && settings.secret ? issueCsrfToken(settings.secret, new Date()) : null}
        consentVersion={submissionPolicy.consentVersion}
        policyVersion={submissionPolicy.policyVersion}
        maxBytes={submissionPolicy.limits.maxBytes}
        limits={submissionPolicy.limits}
        slotProfile={slotProfile}
        submitEnabled={enabled}
        verifyOnly={verifyOnly}
        allowMockFixture={appEnv === "mock"}
        collectorVersion={collectorRelease.version}
        exportSchemaVersion={collectorRelease.exportSchemaVersion}
        supportedExportSchemaVersions={collectorRelease.supportedExportSchemaVersions}
      />

      <section aria-labelledby="howto-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <h2 id="howto-title" className="mb-2 text-base font-semibold text-foreground">
          {s.howTo.title}
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          {s.howTo.steps.map((step) => (
            <li key={step} className="break-words">
              {t(step, { collector: collectorRelease.version })}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-subtle">{s.howTo.note}</p>
        <p className="mt-1 text-xs text-subtle">
          {t(s.howTo.versions, {
            schemas: collectorRelease.supportedExportSchemaVersions.join(", "),
            collector: collectorRelease.version,
          })}
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {s.guide.map((section) => (
          <section key={section.title} className="rounded-lg border border-border bg-surface px-4 py-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">{section.title}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
