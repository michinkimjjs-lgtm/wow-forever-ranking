"use client";

import { Button } from "@/components/ui/button";
import { ko } from "@/locales/ko";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const m = ko.common;
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">{m.error.title}</h1>
      <p className="text-sm text-muted">{m.error.body}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        {m.actions.retry}
      </Button>
    </div>
  );
}
