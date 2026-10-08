import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  const m = getMessages().common;
  const items = [
    { href: routes.home(), label: m.nav.home, match: "/" },
    { href: routes.ranking("level"), label: m.nav.rankings, match: "/rankings" },
    { href: routes.characters(), label: m.nav.characters, match: "/characters" },
    { href: routes.guilds(), label: m.nav.guilds, match: "/guilds" },
    { href: routes.stats(), label: m.nav.stats, match: "/stats" },
    { href: routes.contribute(), label: m.nav.contribute, match: "/contribute" },
  ];
  const upcoming = [m.nav.dungeons, m.nav.raids, m.nav.worldFirst];

  return (
    <header className="border-b border-border bg-surface/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-6">
        <Link href={routes.home()} className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-accent">{m.siteName}</span>
          <span className="text-xs text-muted">{m.siteTagline}</span>
        </Link>
        <NavLinks items={items} label={m.nav.label} />
        <div className="hidden items-center gap-2 text-xs text-subtle lg:ml-auto lg:flex">
          {upcoming.map((label) => (
            <span key={label} className="rounded border border-dashed border-border px-2 py-1" title={m.nav.comingSoon}>
              {label} · {m.nav.comingSoon}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
