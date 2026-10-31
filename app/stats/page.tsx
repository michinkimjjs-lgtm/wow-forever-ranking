import type { Metadata } from "next";
import { EmptyState } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { StatsDemoPreview } from "@/components/demo/stats-demo-preview";
import { getGameScope } from "@/lib/config";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.stats;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.stats() });
}

export default function StatsPage() {
  const m = getMessages().stats;
  const appEnv = getAppEnvironmentSafe();
  // 실제 데이터 설정이 확인되지 않은 배포(beta·live, 디자인 확인용 Preview)에서는 화면 미리보기를 함께 보여 준다
  const showDemo = isDesignPreviewDeployment() || (appEnv !== null && appEnv !== "mock" && !getGameScope(appEnv));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={m.title} />
      <EmptyState title={m.body} body={m.planned} />
      <EmptyState title={m.upcomingTitle} body={m.upcomingBody} />
      {showDemo ? <StatsDemoPreview /> : null}
    </div>
  );
}
