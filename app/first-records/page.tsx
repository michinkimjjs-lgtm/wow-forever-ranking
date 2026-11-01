import type { Metadata } from "next";
import { FirstRecordsDemoPreview } from "@/components/demo/first-records-demo-preview";
import { EmptyState } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { SetupPending } from "@/components/setup-pending";
import { getGameScope } from "@/lib/config";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.firstRecords;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.firstRecords() });
}

/**
 * 최초 달성 기록 (명세서 §8.4, §23)
 *
 * - 실제 기록 계산(first_records)은 데이터 연결 후 구현한다. 지금은 모든 배포에서 "준비 중"이다.
 * - 실제 데이터 설정이 확인되지 않은 배포(beta·live, 디자인 확인용 Preview)에서는 준비 중 안내 아래에 화면 미리보기를 보여 준다. DB를 쓰지 않는다.
 */
export default function FirstRecordsPage() {
  const f = getMessages().demo.firstRecords;
  const appEnv = getAppEnvironmentSafe();
  const preview = isDesignPreviewDeployment();
  const showDemo = preview || (appEnv !== null && appEnv !== "mock" && !getGameScope(appEnv));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={f.title} description={f.description} />
      {showDemo ? <SetupPending dataEnvironment={preview ? null : appEnv} /> : <EmptyState title={f.pending} body={f.pendingBody} />}
      {showDemo ? <FirstRecordsDemoPreview /> : null}
    </div>
  );
}
