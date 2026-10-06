import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MockBanner } from "@/components/layout/mock-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { HTML_LANG, getMessages } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { getAppEnvironmentSafe } from "@/lib/server/context";
import "./globals.css";

// 모든 화면은 요청 시점의 데이터와 배포 설정(APP_DATA_ENVIRONMENT)으로 렌더링한다.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const seo = getMessages().seo.home;
  return pageMetadata({ title: seo.title, description: seo.description, path: "/" });
}

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // 배포 설정을 읽지 못하면 안전하게 Mock 안내를 표시한다.
  const appEnv = getAppEnvironmentSafe();
  const showMockBanner = appEnv !== "beta" && appEnv !== "live";
  return (
    <html lang={HTML_LANG}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        {showMockBanner ? <MockBanner /> : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
