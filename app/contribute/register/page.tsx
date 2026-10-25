import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/submit/register-form";
import { registrationConfig } from "@/config/registration";
import { submissionPolicy } from "@/config/submissions";
import { resolveSlotMappingProfile } from "@/lib/config";
import { getPublicSubmissionSettings } from "@/lib/config/env";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { currentManualRegistrationStatus, submissionTargetEnvironment } from "@/lib/submissions/availability";
import { issueCsrfToken } from "@/lib/submissions/security";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.contributeRegister;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.contributeRegister() });
}

/**
 * 애드온 없이 캐릭터 직접 등록 (docs/DATA-COLLECTION-STRATEGY.md §2)
 * 기능이 꺼져 있거나 랭킹 반영에 필요한 게임 설정·매핑이 없으면 입력 양식을 렌더링하지 않고 안내만 보여 준다.
 */
export default function RegisterPage() {
  const r = getMessages().register;
  const appEnv = getAppEnvironmentSafe();
  const status = currentManualRegistrationStatus(appEnv);

  if (!status.open) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={r.title} />
        <section aria-labelledby="register-closed-title" role="status" className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-4">
          <h2 id="register-closed-title" className="text-base font-semibold text-warning">
            {r.closed.title}
          </h2>
          {/* 설정 미확인이 더 근본적인 이유이므로 기능 설정보다 먼저 안내한다 */}
          <p className="mt-2 text-sm text-foreground">{status.ready ? r.closed.featureOff : r.closed.setupMissing}</p>
          <p className="mt-2 text-sm text-muted">{r.closed.later}</p>
          <Link href={routes.contribute()} className="mt-3 inline-block text-sm text-accent hover:underline">
            {r.closed.backLink}
          </Link>
        </section>
      </div>
    );
  }

  const settings = getPublicSubmissionSettings();
  const verifyOnly = appEnv !== "beta" && appEnv !== "live";
  // 실제 영역(beta / live) 기준 장비 슬롯. mock 배포는 beta 기준으로 검증만 한다.
  const slotProfile = resolveSlotMappingProfile(submissionTargetEnvironment(appEnv), "*");
  const slots = [...(slotProfile?.slots ?? [])].sort((a, b) => a.displayOrder - b.displayOrder).map((s) => s.code);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={r.title}>
        {r.description.map((line) => (
          <p key={line} className="text-sm text-muted">
            {line}
          </p>
        ))}
      </PageHeader>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3 text-xs sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
        <dt className="text-subtle">{r.scope.source}</dt>
        <dd className="text-foreground">{r.scope.sourceValue}</dd>
        <dt className="text-subtle">{r.scope.verification}</dt>
        <dd className="text-foreground">{r.scope.verificationValue}</dd>
        <dt className="text-subtle">{r.scope.review}</dt>
        <dd className="text-foreground">{r.scope.reviewValue}</dd>
      </dl>

      {verifyOnly ? (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">{r.mockNotice}</p>
      ) : null}
      <p className="text-xs text-muted">{r.classNotice}</p>

      <RegisterForm
        endpoint="/api/v1/submissions/manual"
        csrfToken={settings.secret ? issueCsrfToken(settings.secret, new Date()) : null}
        consentVersion={submissionPolicy.consentVersion}
        policyVersion={submissionPolicy.policyVersion}
        regions={status.regions}
        rulesets={status.rulesets}
        slots={slots}
        limits={registrationConfig.limits}
        submitEnabled={status.open}
        verifyOnly={verifyOnly}
      />

      <section aria-labelledby="compare-title" className="rounded-lg border border-border bg-surface px-4 py-4">
        <h2 id="compare-title" className="mb-2 text-base font-semibold text-foreground">
          {r.compare.title}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {r.compare.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link href={routes.submit()} className="mt-2 inline-block text-sm text-accent hover:underline">
          {r.compare.collectorLink}
        </Link>
      </section>
    </div>
  );
}
