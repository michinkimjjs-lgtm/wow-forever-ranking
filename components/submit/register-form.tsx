"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getMessages, t } from "@/lib/i18n";
import { MANUAL_SCHEMA, MANUAL_SCHEMA_VERSION, manualCharacterSchema } from "@/lib/submissions/manual-schema";
import { findSensitiveData } from "@/lib/submissions/sensitive";

export interface RegisterFormProps {
  endpoint: string;
  csrfToken: string | null;
  consentVersion: string;
  policyVersion: string;
  /** Battle.net 지역 코드 (config/registration.ts) */
  regions: readonly string[];
  /** 등록할 수 있는 게임 규칙 코드 (AVAILABLE만) */
  rulesets: readonly string[];
  /** 장비 슬롯 코드 (Gear Profile 순서). 비어 있으면 장비 입력을 숨긴다 */
  slots: readonly string[];
  limits: { maxEquipment: number; maxNoteLength: number; maxUrlLength: number; minNoteLength: number };
  submitEnabled: boolean;
  /** mock 배포: 저장하지 않고 검증만 */
  verifyOnly: boolean;
}

interface EquipmentRow {
  key: number;
  slot: string;
  itemName: string;
  itemId: string;
  itemLevel: string;
}

interface RegisterResponse {
  mode: "dry-run" | "queued" | "duplicate";
  submissionId: string | null;
  reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "CONFLICT" | null;
  verificationStatus: "COMMUNITY_SUBMITTED";
  dataSource: "user_submission";
  duplicate: boolean;
  blockedReason: string | null;
  warnings: string[];
}

/** 지금 시각을 KST 기준 datetime-local 값(YYYY-MM-DDTHH:mm)으로 */
function nowKstInput(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 16);
}

/** datetime-local 값(KST)을 ISO 8601(+09:00)로. 서버의 시간대에 의존하지 않는다 */
function kstInputToIso(value: string): string {
  return `${value}:00+09:00`;
}

const optionalInt = (value: string) => (value.trim() === "" ? undefined : Number(value));

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </>
  );
}

export function RegisterForm(props: RegisterFormProps) {
  const m = getMessages();
  const r = m.register;
  const f = r.form;
  const [region, setRegion] = useState("");
  const [ruleset, setRuleset] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [level, setLevel] = useState("");
  const [className, setClassName] = useState("");
  const [raceName, setRaceName] = useState("");
  const [factionName, setFactionName] = useState("");
  const [guildName, setGuildName] = useState("");
  const [observedAt, setObservedAt] = useState(nowKstInput);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [note, setNote] = useState("");
  const [agreements, setAgreements] = useState({ dataUsage: false, noPersonalData: false, accurateInformation: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  const allAgreed = agreements.dataUsage && agreements.noPersonalData && agreements.accurateInformation;
  const usedSlots = new Set(equipment.map((e) => e.slot));

  function reset() {
    setRegion("");
    setRuleset("");
    setName("");
    setSurname("");
    setLevel("");
    setClassName("");
    setRaceName("");
    setFactionName("");
    setGuildName("");
    setObservedAt(nowKstInput());
    setEquipment([]);
    setScreenshotUrl("");
    setNote("");
    setAgreements({ dataUsage: false, noPersonalData: false, accurateInformation: false });
    setErrors([]);
    setResult(null);
  }

  function updateItem(key: number, changes: Partial<EquipmentRow>) {
    setEquipment((list) => list.map((e) => (e.key === key ? { ...e, ...changes } : e)));
  }

  function buildPayload() {
    return {
      schema: MANUAL_SCHEMA,
      schemaVersion: MANUAL_SCHEMA_VERSION,
      region,
      ruleset,
      name,
      surname,
      level: level.trim() === "" ? undefined : Number(level),
      className,
      raceName,
      factionName,
      guildName,
      observedAt: observedAt ? kstInputToIso(observedAt) : "",
      equipment: equipment.map((e) => ({
        slot: e.slot,
        itemName: e.itemName,
        itemId: optionalInt(e.itemId),
        itemLevel: optionalInt(e.itemLevel),
      })),
      evidence: { screenshotUrl: screenshotUrl.trim() || undefined, note },
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!props.csrfToken || !props.submitEnabled || !allAgreed) return;
    setErrors([]);
    const payload = buildPayload();
    // 브라우저에서 먼저 같은 스키마로 확인한다. 서버도 다시 확인한다.
    const checked = manualCharacterSchema.safeParse(payload);
    if (!checked.success) {
      setErrors([...new Set(checked.error.issues.map((i) => i.message))]);
      return;
    }
    if (findSensitiveData(checked.data).length > 0) {
      setErrors([m.submissions.errors.SENSITIVE_DATA]);
      return;
    }
    setSending(true);
    try {
      const response = await fetch(`${props.endpoint}${props.verifyOnly ? "?dryRun=true" : ""}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-forever-rank-csrf": props.csrfToken },
        body: JSON.stringify({
          registration: checked.data,
          consent: {
            consentVersion: props.consentVersion,
            policyVersion: props.policyVersion,
            agreements: { dataUsage: true, noPersonalData: true, accurateInformation: true },
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: RegisterResponse; error?: { message?: string; issues?: { message?: string }[] } }
        | null;
      if (!response.ok || !body?.data) {
        const issues = body?.error?.issues?.map((i) => i.message).filter((v): v is string => Boolean(v)) ?? [];
        setErrors([body?.error?.message ?? r.errors.UNKNOWN, ...new Set(issues)]);
        return;
      }
      setResult(body.data);
    } catch {
      setErrors([r.errors.NETWORK]);
    } finally {
      setSending(false);
    }
  }

  if (result) {
    const message =
      result.mode === "dry-run"
        ? result.blockedReason
          ? r.result.dryRunMappingPending
          : r.result.dryRun
        : result.duplicate
          ? r.result.duplicate
          : result.blockedReason
            ? r.result.mappingPending
            : result.reviewStatus === "CONFLICT"
              ? r.result.conflict
              : r.result.queued;
    return (
      <section role="status" className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">{r.result.title}</h2>
        <p className="text-sm text-foreground">{message}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {result.submissionId ? <Row label={m.submit.result.submissionId} value={result.submissionId} /> : null}
          {result.reviewStatus ? <Row label={m.submit.result.reviewStatus} value={m.submit.reviewStatuses[result.reviewStatus]} /> : null}
          <Row label={r.scope.source} value={m.game.dataSources[result.dataSource]} />
          <Row label={m.submit.result.verificationStatus} value={m.game.verificationStatuses[result.verificationStatus]} />
        </dl>
        {result.warnings.length > 0 ? (
          <div className="text-xs text-muted">
            <p className="text-subtle">{r.result.warnings}</p>
            <ul className="list-disc pl-5">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            {r.actions.reset}
          </Button>
        </div>
      </section>
    );
  }

  const canSubmit = props.submitEnabled && props.csrfToken !== null && allAgreed && !sending;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset className="grid gap-3 rounded-lg border border-border bg-surface px-4 py-4 sm:grid-cols-2">
        <legend className="px-1 text-base font-semibold text-foreground">{f.sections.character}</legend>
        <Field label={f.region} hint={f.regionHint} htmlFor="reg-region">
          <NativeSelect id="reg-region" value={region} onChange={(e) => setRegion(e.target.value)} required>
            <option value="">{f.regionPlaceholder}</option>
            {props.regions.map((code) => (
              <option key={code} value={code}>
                {r.regions[code] ?? code}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={f.ruleset} hint={f.rulesetHint} htmlFor="reg-ruleset">
          <NativeSelect id="reg-ruleset" value={ruleset} onChange={(e) => setRuleset(e.target.value)} required>
            <option value="">{f.rulesetPlaceholder}</option>
            {props.rulesets.map((code) => (
              <option key={code} value={code}>
                {m.game.rulesets[code as keyof typeof m.game.rulesets] ?? code}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={f.name} htmlFor="reg-name">
          <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} required autoComplete="off" />
        </Field>
        <Field label={f.surname} htmlFor="reg-surname">
          <Input id="reg-surname" value={surname} onChange={(e) => setSurname(e.target.value)} maxLength={32} required autoComplete="off" />
        </Field>
        <p className="text-xs text-subtle sm:col-span-2">{f.nameHint}</p>
        <Field label={f.level} htmlFor="reg-level">
          <Input id="reg-level" type="number" inputMode="numeric" min={1} step={1} value={level} onChange={(e) => setLevel(e.target.value)} required />
        </Field>
        <Field label={f.className} hint={f.classHint} htmlFor="reg-class">
          <Input id="reg-class" value={className} onChange={(e) => setClassName(e.target.value)} maxLength={32} required autoComplete="off" />
        </Field>
        <Field label={f.raceName} htmlFor="reg-race">
          <Input id="reg-race" value={raceName} onChange={(e) => setRaceName(e.target.value)} maxLength={32} autoComplete="off" />
        </Field>
        <Field label={f.factionName} htmlFor="reg-faction">
          <Input id="reg-faction" value={factionName} onChange={(e) => setFactionName(e.target.value)} maxLength={32} autoComplete="off" />
        </Field>
        <Field label={f.guildName} htmlFor="reg-guild">
          <Input id="reg-guild" value={guildName} onChange={(e) => setGuildName(e.target.value)} maxLength={64} autoComplete="off" />
        </Field>
        <Field label={f.observedAt} hint={f.observedAtHint} htmlFor="reg-observed">
          <Input id="reg-observed" type="datetime-local" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} required />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
        <legend className="px-1 text-base font-semibold text-foreground">{f.sections.equipment}</legend>
        {props.slots.length === 0 ? (
          <p className="text-sm text-muted">{f.noSlotProfile}</p>
        ) : (
          <>
            <p className="text-xs text-subtle">{t(f.equipmentHint, { max: props.limits.maxEquipment })}</p>
            {equipment.map((item, index) => (
              <div key={item.key} className="grid gap-2 rounded-md border border-border px-3 py-3 sm:grid-cols-[8rem_1fr_8rem_7rem_auto] sm:items-end">
                <Field label={f.slot} htmlFor={`reg-slot-${item.key}`}>
                  <NativeSelect id={`reg-slot-${item.key}`} value={item.slot} onChange={(e) => updateItem(item.key, { slot: e.target.value })}>
                    <option value="">{f.slotPlaceholder}</option>
                    {props.slots.map((code) => (
                      <option key={code} value={code} disabled={code !== item.slot && usedSlots.has(code)}>
                        {m.game.slots[code] ?? code}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={f.itemName} htmlFor={`reg-item-${item.key}`}>
                  <Input id={`reg-item-${item.key}`} value={item.itemName} maxLength={128} onChange={(e) => updateItem(item.key, { itemName: e.target.value })} />
                </Field>
                <Field label={f.itemId} htmlFor={`reg-itemid-${item.key}`}>
                  <Input id={`reg-itemid-${item.key}`} type="number" inputMode="numeric" min={1} value={item.itemId} onChange={(e) => updateItem(item.key, { itemId: e.target.value })} />
                </Field>
                <Field label={f.itemLevel} htmlFor={`reg-ilvl-${item.key}`}>
                  <Input id={`reg-ilvl-${item.key}`} type="number" inputMode="numeric" min={1} value={item.itemLevel} onChange={(e) => updateItem(item.key, { itemLevel: e.target.value })} />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${f.removeItem} ${index + 1}`}
                  onClick={() => setEquipment((list) => list.filter((e) => e.key !== item.key))}
                >
                  {f.removeItem}
                </Button>
              </div>
            ))}
            {equipment.length < Math.min(props.limits.maxEquipment, props.slots.length) ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEquipment((list) => [...list, { key: nextKey, slot: "", itemName: "", itemId: "", itemLevel: "" }]);
                    setNextKey((k) => k + 1);
                  }}
                >
                  {f.addItem}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
        <legend className="px-1 text-base font-semibold text-foreground">{f.sections.evidence}</legend>
        <p className="text-xs text-subtle">{t(f.evidenceRequired, { min: props.limits.minNoteLength })}</p>
        <Field label={f.screenshotUrl} hint={f.screenshotHint} htmlFor="reg-url">
          <Input
            id="reg-url"
            type="url"
            inputMode="url"
            value={screenshotUrl}
            maxLength={props.limits.maxUrlLength}
            onChange={(e) => setScreenshotUrl(e.target.value)}
          />
        </Field>
        <Field label={f.note} hint={t(f.noteHint, { min: props.limits.minNoteLength })} htmlFor="reg-note">
          <textarea
            id="reg-note"
            value={note}
            maxLength={props.limits.maxNoteLength}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle focus-visible:border-accent"
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
        <legend className="px-1 text-base font-semibold text-foreground">{r.consent.title}</legend>
        {(["dataUsage", "noPersonalData", "accurateInformation"] as const).map((key) => (
          <label key={key} className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={agreements[key]}
              onChange={(e) => setAgreements((a) => ({ ...a, [key]: e.target.checked }))}
            />
            <span>{r.consent[key]}</span>
          </label>
        ))}
        <p className="text-xs text-subtle">
          {r.consent.required} · {t(m.submit.consent.version, { consent: props.consentVersion, policy: props.policyVersion })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
            {sending ? r.actions.submitting : props.verifyOnly ? r.actions.verify : r.actions.submit}
          </Button>
          <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
            {r.actions.reset}
          </Button>
        </div>
        {errors.length > 0 ? (
          <ul role="alert" className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </fieldset>
    </form>
  );
}
