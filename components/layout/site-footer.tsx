import { getMessages } from "@/lib/i18n";

export function SiteFooter() {
  const m = getMessages().common;
  return (
    <footer className="mt-12 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-subtle sm:flex-row sm:justify-between">
        <p>{m.footer.disclaimer}</p>
        <p>{m.footer.timezone}</p>
      </div>
    </footer>
  );
}
