import type { Metadata } from "next";
import { RankingPageView } from "@/components/ranking/ranking-page";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo["gear"];
  return pageMetadata({ title: seo.title, description: seo.description, path: routes.ranking("gear") });
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <RankingPageView type="gear" searchParams={await searchParams} />;
}
