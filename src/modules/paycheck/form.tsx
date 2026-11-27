"use client";

import { ErrorSummary } from "@/components/error-summary";
import { OptionComparison } from "@/components/option-comparison";
import { SourceNote } from "@/components/source-note";
import { CADENCES, type PayCadence } from "@/domain/cadence";
import { formatUsd } from "@/domain/money";
import type { PaycheckResult } from "@/domain/paycheck";
import { fieldHref } from "@/lib/fields";
import type { TakeHomeFact } from "@/server/types";
import { useState, type FormEvent } from "react";

type JobDraft = {
  id: string;
  label: string;
  netPay: string;
  cadence: "" | PayCadence;
};

const FREQUENCIES: { value: PayCadence; label: string }[] = [
  ...Object.values(CADENCES).map((cadence) => ({ value: cadence.id, label: cadence.label })),
  { value: "unsure", label: "I'm not sure" },
];

function newJob(): JobDraft {
  return { id: crypto.randomUUID(), label: "", netPay: "", cadence: "" };
}

function isPaycheckResult(value: unknown): value is PaycheckResult {
  return Boolean(value && typeof value === "object" && "combined" in value && "missing" in value);
}

export function PaycheckForm({ initialFacts }: { initialFacts: TakeHomeFact[] }) {
  const [jobs, setJobs] = useState<JobDraft[]>([
    { id: "job-1", label: "", netPay: "", cadence: "" },
  ]);
  const [savedFacts, setSavedFacts] = useState(initialFacts);
  const [result, setResult] = useState<PaycheckResult | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [conflicts, setConflicts] = useState<{ contextId: string; storedLabel: string; proposedNetPay: string | null }[]>([]);

  const missing = result?.missing ?? [];
  const errors = missing.map((item) => ({ ...item, href: fieldHref(item.path) }));

  function updateJob(index: number, patch: Partial<JobDraft>) {
    setJobs((current) => current.map((job, jobIndex) => (jobIndex === index ? { ...job, ...patch } : job)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaveError("");
    const response = await fetch("/api/v1/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolId: "paycheck",
        input: {
          jobs: jobs.map((job) => ({
            id: job.id,
            label: job.label,
            netPay: job.netPay,
            cadence: job.cadence || undefined,
          })),
        },
      }),
    });
    const body = (await response.json()) as { result?: unknown; error?: string };
    setPending(false);
    setSubmitCount((count) => count + 1);
    if (!response.ok || !isPaycheckResult(body.result)) {
      setStatusMessage(body.error ?? "The calculation did not finish. Your entries are still here.");
      return;
    }
    setResult(body.result);
    setStatusMessage(body.result.answer ?? "Some answers are still needed.");
  }

  async function rememberPay(expected = savedFacts) {
    setSaveError("");
    setConflicts([]);
    const response = await fetch("/api/v1/household/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevisions: expected.map((fact) => ({
          contextId: fact.contextId,
          revision: fact.revision,
        })),
        facts: jobs
          .filter((job) => job.cadence && job.cadence !== "unsure")
          .map((job) => ({
            contextId: job.id,
            label: job.label,
            netPay: job.netPay,
            cadence: job.cadence,
          })),
      }),
    });
    const body = (await response.json()) as {
      facts?: TakeHomeFact[];
      conflicts?: { contextId: string; stored: TakeHomeFact; proposedNetPay: string | null }[];
      error?: string;
    };
    if (response.status === 409 && body.conflicts) {
      setConflicts(
        body.conflicts.map((conflict) => ({
          contextId: conflict.contextId,
          storedLabel: `${formatUsd(conflict.stored.amountCents)} ${conflict.stored.cadence}`,
          proposedNetPay: conflict.proposedNetPay,
        })),
      );
      setSavedFacts(body.conflicts.map((conflict) => conflict.stored));
      setSaveError("Household pay was already changed. Compare the saved amount with what you entered, then choose which to keep.");
      return;
    }
    if (!response.ok || !body.facts) {
      setSaveError(body.error ?? "The pay was not saved. Your entries are still here.");
      return;
    }
    setSavedFacts(body.facts);
    setStatusMessage("Household pay saved. A comparison can still use a different amount.");
  }

  return (
    <div className="stack">
      <p className="visually-hidden" aria-live="polite">
        {statusMessage}
      </p>
      {result ? <PaycheckAnswer result={result} /> : null}
      <ErrorSummary errors={errors} submitCount={submitCount} />
      <form id="tool-form" className="stack" onSubmit={onSubmit} noValidate>
        {jobs.map((job, index) => (
          <fieldset key={job.id} className="card stack" id={`job-${index}-frequency`}>
            <legend>{jobs.length > 1 ? `Paycheck ${index + 1}` : "This paycheck"}</legend>
            <div className="field">
              <label htmlFor={`job-${index}-label`}>Job name (optional)</label>
              <input
                id={`job-${index}-label`}
                className="text-input"
                value={job.label}
                onChange={(event) => updateJob(index, { label: event.target.value })}
                autoComplete="organization-title"
              />
            </div>
            <div className="field" role="radiogroup" aria-labelledby={`job-${index}-frequency-label`}>
              <p id={`job-${index}-frequency-label`} className="group-label">
                How often are you paid?
              </p>
              {FREQUENCIES.map((frequency) => (
                <label key={frequency.value} className="choice">
                  <input
                    type="radio"
                    name={`cadence-${job.id}`}
                    value={frequency.value}
                    checked={job.cadence === frequency.value}
                    onChange={() => updateJob(index, { cadence: frequency.value })}
                  />
                  <span>{frequency.label}</span>
                </label>
              ))}
              <p className="hint">Every two weeks is 26 paychecks a year. Twice a month is 24.</p>
            </div>
            <div className="field">
              <label htmlFor={`job-${index}-net-pay`}>Take-home amount (USD)</label>
              <input
                id={`job-${index}-net-pay`}
                className="text-input"
                inputMode="decimal"
                value={job.netPay}
                placeholder="For example, 2400"
                aria-invalid={missing.some((item) => item.path === `jobs.${index}.netPay`) || undefined}
                aria-describedby={`job-${index}-net-pay-hint`}
                onChange={(event) => updateJob(index, { netPay: event.target.value })}
                onBlur={() => {
                  const numeric = job.netPay.replace(/[$,\s]/g, "");
                  if (/^\d+(\.\d{1,2})?$/.test(numeric)) updateJob(index, { netPay: numeric });
                }}
              />
              <p id={`job-${index}-net-pay-hint`} className="hint">
                Use the amount you take home each payday, after taxes and withholdings.
              </p>
            </div>
            <details>
              <summary>Why we ask about pay frequency</summary>
              <p>
                Every two weeks and twice a month can both look like two paychecks. A year has 26 paychecks
                when you are paid every two weeks, and 24 when you are paid twice a month.
              </p>
            </details>
          </fieldset>
        ))}
        <div className="button-row">
          <button type="submit" className="button button-primary" disabled={pending}>
            {result ? "Update the answer" : "See my monthly pay"}
          </button>
          {result?.status === "complete" ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setJobs((current) => [...current, newJob()])}
            >
              Add another job
            </button>
          ) : null}
        </div>
      </form>
      {result?.status === "complete" ? (
        <div className="card stack">
          <h2>Remember this pay</h2>
          <p>Saving writes these paychecks to your household. Editing the amounts above does not.</p>
          <button type="button" className="button button-primary" onClick={() => void rememberPay()}>
            Remember this pay
          </button>
          {saveError ? (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          ) : null}
          {conflicts.map((conflict) => (
            <div key={conflict.contextId} className="stack">
              <p>Saved amount: {conflict.storedLabel}</p>
              <p>Amount you entered: {conflict.proposedNetPay ?? "Removed"}</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void rememberPay(savedFacts)}
              >
                Save my new amount
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaycheckAnswer({ result }: { result: PaycheckResult }) {
  const ordinary = result.combined.ordinaryMonthCents;
  const average = result.combined.averageMonthlyCents;
  return (
    <section className="result stack">
      <h2>Answer</h2>
      {result.answer ? <p className="result-answer">{result.answer}</p> : <p>Enter the missing amounts to see a total.</p>}
      <p className="result-note">{result.limitations[0]}</p>
      {ordinary != null && average != null ? (
        <OptionComparison
          caption={`${result.combined.ordinaryMonthLabel} compared with the monthly average`}
          columns={[
            { id: "ordinary", name: result.combined.ordinaryMonthLabel },
            { id: "average", name: "Monthly average" },
          ]}
          rows={[
            {
              id: "take-home",
              label: "Take-home pay",
              emphasis: true,
              values: {
                ordinary: formatUsd(ordinary),
                average: formatUsd(average),
              },
            },
          ]}
        />
      ) : null}
      {result.scheduleComparison.map((comparison) => (
        <OptionComparison
          key={comparison.jobId}
          caption={`${comparison.jobLabel}: the same payday amount on two schedules${
            comparison.yourCadence ? `. Your entry is ${CADENCES[comparison.yourCadence].label.toLowerCase()}.` : ""
          }`}
          columns={[
            { id: "biweekly", name: "Every two weeks (26)" },
            { id: "semimonthly", name: "Twice a month (24)" },
          ]}
          rows={[
            {
              id: "count",
              label: "Paychecks in a year",
              values: { biweekly: "26", semimonthly: "24" },
            },
            {
              id: "ordinary",
              label: "Typical pay month",
              values: {
                biweekly: formatUsd(comparison.biweekly.ordinaryMonthCents),
                semimonthly: formatUsd(comparison.semimonthly.ordinaryMonthCents),
              },
            },
            {
              id: "average",
              label: "Monthly average",
              emphasis: true,
              values: {
                biweekly: formatUsd(comparison.biweekly.averageMonthlyCents),
                semimonthly: formatUsd(comparison.semimonthly.averageMonthlyCents),
              },
            },
          ]}
        />
      ))}
      <div className="stack">
        {result.explanation.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {result.calculation.length > 0 ? (
        <details>
          <summary>See the calculation</summary>
          <ul>
            {result.calculation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {result.sources[0] ? <SourceNote title={result.sources[0].title} note={result.sources[0].note} /> : null}
    </section>
  );
}
