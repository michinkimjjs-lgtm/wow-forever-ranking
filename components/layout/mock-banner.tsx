import { getMessages } from "@/lib/i18n";

/** mock 배포의 모든 페이지에 표시한다. 끌 수 없다(명세서 §5). */
export function MockBanner() {
  const m = getMessages().common.mockBanner;
  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
        <strong className="font-semibold text-warning">{m.title}</strong>
        <span className="text-foreground">{m.body}</span>
        <span className="text-xs text-muted sm:ml-auto">{m.detail}</span>
      </div>
    </div>
  );
}
