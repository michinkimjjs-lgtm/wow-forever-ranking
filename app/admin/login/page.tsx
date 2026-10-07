import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { submissionPolicy } from "@/config/submissions";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { getAdminSettings } from "@/lib/config/env";
import { getMessages, t } from "@/lib/i18n";
import { loginAction } from "../actions";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!getAdminSettings().enabled) notFound();
  if (await isAdminAuthenticated()) redirect("/admin/submissions");
  const m = getMessages().admin.login;
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <PageHeader
        title={m.title}
        description={t(m.description, { hours: Math.round(submissionPolicy.adminSessionMinutes / 60) })}
      />
      <form action={loginAction} className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
        <label htmlFor="token" className="text-sm text-foreground">
          {m.token}
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          maxLength={512}
          className="h-9 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-foreground"
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error === "limited" ? getMessages().submissions.errors.RATE_LIMITED : m.failed}
          </p>
        ) : null}
        <Button type="submit">{m.submit}</Button>
      </form>
    </div>
  );
}
