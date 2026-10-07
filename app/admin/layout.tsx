import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getMessages } from "@/lib/i18n";

// 관리자 화면은 검색 엔진에 노출하지 않는다.
export function generateMetadata(): Metadata {
  return { title: { absolute: getMessages().seo.admin.title }, robots: { index: false, follow: false } };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
