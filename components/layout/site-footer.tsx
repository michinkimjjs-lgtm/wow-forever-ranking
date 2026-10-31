import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { BLIZZARD_WOW_NOTICE } from "@/lib/legal/blizzard-notice";
import { routes } from "@/lib/routes";

export function SiteFooter() {
  const m = getMessages().common;
  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-subtle">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <p>{m.footer.disclaimer}</p>
          <div className="flex gap-3">
            <Link href={routes.contribute()} className="text-muted hover:text-foreground">
              {m.footer.contribute}
            </Link>
            <Link href={routes.submit()} className="text-muted hover:text-foreground">
              {m.footer.submit}
            </Link>
          </div>
          <p>{m.footer.timezone}</p>
        </div>
        {/* 비공식 팬 사이트·저작권·상표 고지 */}
        <div data-legal-notice="true" className="flex flex-col gap-0.5 border-t border-border pt-3">
          <p>{m.footer.fanSite}</p>
          <p>{m.footer.nonCommercial}</p>
          <p>{m.footer.copyright}</p>
          <p lang="en">{BLIZZARD_WOW_NOTICE}</p>
        </div>
      </div>
    </footer>
  );
}
