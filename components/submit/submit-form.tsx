"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import type { GearProfile } from "@/lib/config";
import { formatKstDateTime, formatPercent } from "@/lib/format";
import { getMessages, t } from "@/lib/i18n";
import { characterExportV1Schema, type CharacterExportV1 } from "@/lib/submissions/export-schema";
import { parseJsonWithLimits, type JsonLimits } from "@/lib/submissions/json-limits";
import { buildExportPreview, extractExportJson, type ExportPreview } from "@/lib/submissions/preview";
import { findSensitiveData } from "@/lib/submissions/sensitive";

export interface SubmitFormProps {
  endpoint: string;
  csrfToken: string | null;
  consentVersion: string;
  policyVersion: string;
  maxBytes: number;
  limits: JsonLimits;
  slotProfile: GearProfile | null;
  /** false면 미리보기까지만 (제출 기능 꺼짐) */
  submitEnabled: boolean;
  /** mock 배포: 저장하지 않고 검증만 */
  verifyOnly: boolean;
}

type ClientError = keyof ReturnType<typeof getMessages>["submit"]["errors"];

interface SubmitResponse {
  mode: "dry-run" | "stored" | "queued" | "duplicate";
  submissionId: string | null;
  reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "CONFLICT" | null;
  verificationStatus: "COMMUNITY_SUBMITTED";
  duplicate: boolean;
  blockedReason: string | null;
  changes: { field: string; before: string | number | null; after: string | number | null }[];
  conflict: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </>
  );
}

export function SubmitForm(props: SubmitFormProps) {
  const m = getMessages();
  const s = m.submit;
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [data, setData] = useState<CharacterExportV1 | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [agreeUsage, setAgreeUsage] = useState(false);
  const [agreeNoPersonal, setAgreeNoPersonal] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sizeKb = Math.floor(props.maxBytes / 1024);
  const fail = (code: ClientError) => setFileError(t(s.errors[code], { size: sizeKb }));

  function reset() {
    setFileError(null);
    setData(null);
    setPreview(null);
    setAgreeUsage(false);
    setAgreeNoPersonal(false);
    setServerError(null);
    setResult(null);
    setFileName(null);
    setInputKey((k) => k + 1);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    setData(null);
    setPreview(null);
    setResult(null);
    setServerError(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    // .lua 파일은 JSON보다 커질 수 있으므로 두 배까지 읽고, 꺼낸 JSON을 다시 제한한다.
    if (file.size > props.maxBytes * 2) return fail("TOO_LARGE");
    setReading(true);
    try {
      const content = await file.text();
      const extracted = extractExportJson(file.name, content);
      if (!extracted.ok) return fail(extracted.error);
      if (new TextEncoder().encode(extracted.json).length > props.maxBytes) return fail("TOO_LARGE");
      const parsed = parseJsonWithLimits(extracted.json, props.limits);
      if (!parsed.ok) return fail(parsed.error === "INVALID_JSON" ? "INVALID_JSON" : "JSON_LIMIT");
      if (findSensitiveData(parsed.value).length > 0) return fail("SENSITIVE");
      const checked = characterExportV1Schema.safeParse(parsed.value);
      if (!checked.success) return fail("SCHEMA");
      setData(checked.data);
      setPreview(buildExportPreview(checked.data, props.slotProfile));
    } catch {
      fail("READ_FAILED");
    } finally {
      setReading(false);
    }
  }

  async function onSubmit() {
    if (!data || !agreeUsage || !agreeNoPersonal || !props.csrfToken) return;
    setSending(true);
    setServerError(null);
    try {
      const response = await fetch(`${props.endpoint}${props.verifyOnly ? "?dryRun=true" : ""}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-forever-rank-csrf": props.csrfToken },
        body: JSON.stringify({
          export: data,
          consent: {
            consentVersion: props.consentVersion,
            policyVersion: props.policyVersion,
            agreements: { dataUsage: true, noPersonalData: true },
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: SubmitResponse; error?: { message?: string; issues?: { message?: string }[] } }
        | null;
      if (!response.ok || !body?.data) {
        const issues = body?.error?.issues?.map((i) => i.message).filter(Boolean) ?? [];
        setServerError([body?.error?.message ?? s.errors.UNKNOWN, ...new Set(issues)].join(" "));
        return;
      }
      setResult(body.data);
    } catch {
      setServerError(s.errors.NETWORK);
    } finally {
      setSending(false);
    }
  }

  const p = s.preview;
  const none = p.none;
  const canSubmit = props.submitEnabled && data !== null && agreeUsage && agreeNoPersonal && !sending && result === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-4">
        <p id="export-file-label" className="text-sm font-medium text-foreground">
          {s.file.label}
        </p>
        {/* 브라우저 기본 파일 선택 UI(영어 "Choose File")는 숨기고 한국어 버튼을 쓴다. */}
        <input
          key={inputKey}
          ref={fileInput}
          id="export-file"
          type="file"
          accept=".json,.lua,application/json"
          onChange={onFile}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            aria-describedby="export-file-name export-file-formats"
            className="w-full sm:w-auto"
          >
            {fileName ? s.file.change : s.file.choose}
          </Button>
          <p id="export-file-name" className="min-w-0 break-all text-sm" aria-live="polite">
            {fileName ? (
              <>
                <span className="text-subtle">{s.file.selected}</span> <span className="text-foreground">{fileName}</span>
              </>
            ) : (
              <span className="text-muted">{s.file.none}</span>
            )}
          </p>
        </div>
        <p id="export-file-formats" className="text-xs text-subtle">
          {t(s.file.formats, { size: sizeKb })}
        </p>
        <p className="text-xs text-subtle">{s.file.hint}</p>
        {reading ? <p className="text-xs text-muted">{s.file.reading}</p> : null}
        {fileError ? (
          <p role="alert" className="text-sm text-danger">
            {fileError}
          </p>
        ) : null}
      </div>

      {preview ? (
        <section aria-labelledby="preview-title" className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="preview-title" className="mb-3 text-base font-semibold text-foreground">
            {p.title}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <Row label={p.name} value={preview.name ?? none} />
            <Row label={p.surname} value={preview.surname ?? none} />
            <Row label={p.level} value={preview.level !== null ? String(preview.level) : none} />
            <Row label={p.className} value={preview.className ?? none} />
            <Row label={p.race} value={preview.raceName ?? none} />
            <Row label={p.faction} value={preview.factionName ?? none} />
            <Row label={p.guild} value={preview.guildName ?? p.noGuild} />
            <Row label={p.gearCount} value={t(p.gearCountValue, { count: preview.gearCount, withLevel: preview.gearWithItemLevel })} />
            <Row label={p.averageItemLevel} value={preview.averageItemLevel !== null ? preview.averageItemLevel.toFixed(2) : none} />
            <Row label={p.highestItemLevel} value={preview.highestItemLevel !== null ? String(preview.highestItemLevel) : none} />
            <Row label={p.coverage} value={preview.coverage !== null ? `${formatPercent(preview.coverage)}%` : none} />
            <Row label={p.observedAt} value={preview.observedAt ? formatKstDateTime(new Date(preview.observedAt)) : none} />
            <Row label={p.build} value={preview.sourceBuild ?? none} />
          </dl>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
            {preview.coverageStatus !== null && preview.coverageStatus !== "OK" ? <li className="text-warning">{p.coverageLow}</li> : null}
            <li>{p.note}</li>
            <li>{p.clientNames}</li>
            <li>{p.hiddenId}</li>
          </ul>
        </section>
      ) : null}

      {data && result === null ? (
        <section aria-labelledby="consent-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
          <h2 id="consent-title" className="text-base font-semibold text-foreground">
            {s.consent.title}
          </h2>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={agreeUsage}
              onChange={(e) => setAgreeUsage(e.target.checked)}
            />
            <span>{s.consent.dataUsage}</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={agreeNoPersonal}
              onChange={(e) => setAgreeNoPersonal(e.target.checked)}
            />
            <span>{s.consent.noPersonalData}</span>
          </label>
          <p className="text-xs text-subtle">
            {s.consent.required} · {t(s.consent.version, { consent: props.consentVersion, policy: props.policyVersion })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
              {sending ? s.actions.submitting : props.verifyOnly ? s.actions.verify : s.actions.submit}
            </Button>
            <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
              {s.actions.reset}
            </Button>
          </div>
          {serverError ? (
            <p role="alert" className="text-sm text-danger">
              {serverError}
            </p>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section role="status" className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-4">
          <h2 className="text-base font-semibold text-foreground">{s.result.title}</h2>
          <p className="text-sm text-foreground">
            {result.mode === "dry-run"
              ? result.blockedReason
                ? s.result.dryRunMappingPending
                : s.result.dryRun
              : result.duplicate
                ? s.result.duplicate
                : result.blockedReason
                  ? s.result.mappingPending
                  : result.reviewStatus === "CONFLICT"
                    ? s.result.conflict
                    : result.reviewStatus === "ACCEPTED"
                      ? s.result.accepted
                      : s.result.queued}
          </p>
          {result.submissionId ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <Row label={s.result.submissionId} value={result.submissionId} />
              <Row label={s.result.reviewStatus} value={result.reviewStatus ? s.reviewStatuses[result.reviewStatus] : none} />
              <Row label={s.result.verificationStatus} value={m.game.verificationStatuses[result.verificationStatus]} />
            </dl>
          ) : null}
          {result.changes.length > 0 ? (
            <div className="text-sm">
              <p className="mb-1 text-subtle">{s.result.changes}</p>
              <ul className="flex flex-col gap-0.5 text-muted">
                {result.changes.map((c) => (
                  <li key={c.field}>
                    {s.changeFields[c.field] ?? c.field}: {c.before ?? none} → {c.after ?? none}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              {s.actions.reset}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
