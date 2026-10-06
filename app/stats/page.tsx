import type { Metadata } from "next";
import { EmptyState } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.stats;
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.stats() });
}

export default function StatsPage() {
  const m = getMessages().stats;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={m.title} />
      <EmptyState title={m.body} body={m.planned} />
      <EmptyState title={m.upcomingTitle} body={m.upcomingBody} />
    </div>
  );
}
