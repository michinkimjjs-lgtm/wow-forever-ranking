import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";

export function SiteFooter() {
  const m = getMessages().common;
  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-subtle sm:flex-row sm:justify-between">
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
    </footer>
  );
}
