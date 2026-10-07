import Link from "next/link";
import type { DataEnvironment } from "@/lib/domain/enums";
import { getMessages, t } from "@/lib/i18n";

/**
 * region / gameMode 설정이 확정되지 않은 영역의 "준비 중" 화면 (Phase 3B).
 * 오류 화면이 아니다. 확인되지 않은 값은 표시하지 않는다.
 */
export function SetupPending({ dataEnvironment }: { dataEnvironment: DataEnvironment }) {
  const m = getMessages();
  const s = m.common.setupPending;
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center"
    >
      <p className="font-medium text-foreground">{s.title}</p>
      <p className="max-w-xl text-sm text-muted">{s.body}</p>
      <p className="max-w-xl text-xs text-subtle">{s.note}</p>
      <p className="text-xs text-subtle">{t(s.environment, { env: m.game.dataEnvironments[dataEnvironment] })}</p>
      <Link href="/submit" className="mt-1 text-sm text-accent hover:underline">
        {s.submitLink}
      </Link>
    </section>
  );
}
