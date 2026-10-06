import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: { absolute: getMessages().seo.notFound.title } };

export default function NotFound() {
  const m = getMessages().common;
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">{m.notFound.title}</h1>
      <p className="text-sm text-muted">{m.notFound.body}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={routes.home()}>{m.actions.backHome}</Link>
      </Button>
    </div>
  );
}
