"use client";

import { ErrorSummary } from "@/components/error-summary";
import { FactOrigin } from "@/components/fact-origin";
import { OptionComparison } from "@/components/option-comparison";
import { SourceNote } from "@/components/source-note";
import { cadencePhrase, isCadence, ordinaryMonthLabelFor, type PayCadence } from "@/domain/cadence";
import type { HousingResult } from "@/domain/housing";
import { centsToInput, formatUsd } from "@/domain/money";
import { fieldHref } from "@/lib/fields";
import { formatConfirmedAt } from "@/lib/dates";
import type { TakeHomeFact } from "@/server/types";
import { useRef, useState, type FormEvent } from "react";

type JobDraft = {
  id: string;
  label: string;
  netPay: string;
  cadence: "" | PayCadence;
};

type OptionDraft = {
  id: string;
  name: string;
  monthlyPayment: string;
  upfrontCash: string;
};

const FREQUENCIES: { value: Exclude<PayCadence, "unsure">; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Once a month" },
];

function isHousingResult(value: unknown): value is HousingResult {
  return Boolean(value && typeof value === "object" && "options" in value && "incomeCents" in value);
}

function factToJob(fact: TakeHomeFact): JobDraft {
  return {
    id: fact.contextId,
    label: fact.label,
    netPay: centsToInput(fact.amountCents),
    cadence: fact.cadence,
  };
}

export function HousingForm({ initialFacts }: { initialFacts: TakeHomeFact[] }) {
  const [savedFacts, setSavedFacts] = useState(initialFacts);
  const [useSaved, setUseSaved] = useState(initialFacts.length > 0);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialFacts.map((fact) => fact.contextId));
  const [jobs, setJobs] = useState<JobDraft[]>(
    initialFacts.length > 0
      ? initialFacts.map(factToJob)
      : [{ id: "job-1", label: "", netPay: "", cadence: "" }],
  );
  const [basis, setBasis] = useState<"ordinary-month" | "monthly-average">("ordinary-month");
  const [commitments, setCommitments] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([
    { id: "option-a", name: "Apartment A", monthlyPayment: "", upfrontCash: "" },
    { id: "option-b", name: "Apartment B", monthlyPayment: "", upfrontCash: "" },
  ]);
  const [result, setResult] = useState<HousingResult | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [planName, setPlanName] = useState("Housing comparison");
  const [rememberFacts, setRememberFacts] = useState(false);
  const [planHref, setPlanHref] = useState("");
  const secondPaymentRef = useRef<HTMLInputElement>(null);

  const selectedFacts = savedFacts.filter((fact) => selectedIds.includes(fact.contextId));
  const activeJobs = useSaved ? selectedFacts.map(factToJob) : jobs;
  const ordinaryLabel = ordinaryMonthLabelFor(
    activeJobs.flatMap((job) => (isCadence(job.cadence) ? [job.cadence] : [])),
  );
  const missing = result?.missing ?? [];
  const errors = missing.map((item) => ({ ...item, href: fieldHref(item.path) }));
  const readyToRemember = jobs.some((job) => job.netPay.trim() !== "" && isCadence(job.cadence));
  const differsFromSaved =
    savedFacts.length === 0 ||
    jobs.some((job) => {
      const saved = savedFacts.find((fact) => fact.contextId === job.id);
      if (!saved) return true;
      return saved.cadence !== job.cadence || centsToInput(saved.amountCents) !== job.netPay;
    });

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaveMessage("");
    setPlanHref("");
    const response = await fetch("/api/v1/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolId: "housing",
        input: {
          jobs: activeJobs.map((job) => ({
            id: job.id,
            label: job.label,
            netPay: job.netPay,
            cadence: job.cadence || undefined,
          })),
          basis,
          commitmentsMonthly: commitments,
          options: options.map((option) => ({
            id: option.id,
            name: option.name,
            monthlyPayment: option.monthlyPayment,
            upfrontCash: option.upfrontCash,
          })),
        },
      }),
    });
    const body = (await response.json()) as { result?: unknown; error?: string };
    setPending(false);
    setSubmitCount((count) => count + 1);
    if (!response.ok || !isHousingResult(body.result)) {
      setStatusMessage(body.error ?? "The comparison did not finish. Your entries are still here.");
      return;
    }
    setResult(body.result);
    setStatusMessage(body.result.answer ?? "Some answers are still needed.");
  }

  async function updateHouseholdPay() {
    setSaveMessage("");
    const response = await fetch("/api/v1/household/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevisions: savedFacts.map((fact) => ({
          contextId: fact.contextId,
          revision: fact.revision,
        })),
        facts: jobs
          .filter((job) => isCadence(job.cadence))
          .map((job) => ({
            contextId: job.id,
            label: job.label,
            netPay: job.netPay,
            cadence: job.cadence,
          })),
      }),
    });
    const body = (await response.json()) as { facts?: TakeHomeFact[]; error?: string };
    if (!response.ok || !body.facts) {
      setSaveMessage(body.error ?? "Household pay was not updated. The comparison amounts are still here.");
      return;
    }
    setSavedFacts(body.facts);
    setSelectedIds(body.facts.map((fact) => fact.contextId));
    setUseSaved(true);
    setJobs(body.facts.map(factToJob));
    setSaveMessage("Household pay updated. The housing options were not changed.");
  }

  async function saveComparison() {
    setSaveMessage("");
    const response = await fetch("/api/v1/plans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        name: planName,
        toolId: "housing",
        rememberFacts,
        input: {
          jobs: activeJobs.map((job) => ({
            id: job.id,
            label: job.label,
            netPay: job.netPay,
            cadence: job.cadence || undefined,
          })),
          basis,
          commitmentsMonthly: commitments,
          options,
        },
      }),
    });
    const body = (await response.json()) as { plan?: { id: string }; error?: string };
    if (!response.ok || !body.plan) {
      setSaveMessage(body.error ?? "The comparison was not saved. Your entries are still here.");
      return;
    }
    if (rememberFacts) {
      const factsResponse = await fetch("/api/v1/household/facts");
      const factsBody = (await factsResponse.json()) as { facts?: TakeHomeFact[] };
      if (factsBody.facts) {
        setSavedFacts(factsBody.facts);
        setUseSaved(true);
      }
    }
    setPlanHref(`/plans/${body.plan.id}`);
    setSaveMessage(`Saved “${planName}”.`);
  }

  return (
    <div className="stack">
      <p className="visually-hidden" aria-live="polite">
        {statusMessage}
      </p>
      {result ? (
        <HousingAnswer
          result={result}
          onChangeOption={() => secondPaymentRef.current?.focus()}
          optionName={options[1]?.name || "the second option"}
        />
      ) : null}
      <ErrorSummary errors={errors} submitCount={submitCount} />
      <form id="tool-form" className="stack" onSubmit={onSubmit} noValidate>
        <section className="card stack">
          <h2>Take-home pay</h2>
          {useSaved ? (
            <div className="stack">
              <p>Is this still your take-home pay?</p>
              {selectedFacts.map((fact) => (
                <FactOrigin
                  key={fact.contextId}
                  amountLabel={`${formatUsd(fact.amountCents)} ${cadencePhrase(fact.cadence)}`}
                  originLabel={`from your saved paycheck · confirmed ${formatConfirmedAt(fact.confirmedAt)}`}
                />
              ))}
              {savedFacts.length > 1 ? (
                <fieldset>
                  <legend>Which paychecks should this comparison use?</legend>
                  {savedFacts.map((fact) => (
                    <label key={fact.contextId} className="choice">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(fact.contextId)}
                        onChange={(event) => {
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, fact.contextId]
                              : current.filter((id) => id !== fact.contextId),
                          );
                        }}
                      />
                      <span>
                        {fact.label}: {formatUsd(fact.amountCents)} {cadencePhrase(fact.cadence)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="button-row">
                <button type="button" className="button button-secondary" onClick={() => setUseSaved(true)}>
                  Yes, use this
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setJobs(selectedFacts.map(factToJob));
                    setUseSaved(false);
                  }}
                >
                  Enter a new amount
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setJobs(selectedFacts.map(factToJob));
                    setUseSaved(false);
                  }}
                >
                  Change for this comparison
                </button>
              </div>
            </div>
          ) : (
            <div className="stack">
              {savedFacts.length > 0
                ? jobs.map((job) => (
                    <FactOrigin
                      key={job.id}
                      amountLabel={job.netPay ? `$${job.netPay} entered here` : "New amount"}
                      originLabel="for this comparison only"
                    />
                  ))
                : null}
              {jobs.map((job, index) => (
                <fieldset key={job.id} className="stack" id={`job-${index}-frequency`}>
                  <legend>{job.label || `Paycheck ${index + 1}`}</legend>
                  <div className="field">
                    <label htmlFor={`job-${index}-net-pay`}>Take-home amount (USD)</label>
                    <input
                      id={`job-${index}-net-pay`}
                      className="text-input"
                      inputMode="decimal"
                      value={job.netPay}
                      placeholder="For example, 2400"
                      onChange={(event) =>
                        setJobs((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, netPay: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <p className="group-label">How often are you paid?</p>
                    {FREQUENCIES.map((frequency) => (
                      <label key={frequency.value} className="choice">
                        <input
                          type="radio"
                          name={`housing-cadence-${job.id}`}
                          value={frequency.value}
                          checked={job.cadence === frequency.value}
                          onChange={() =>
                            setJobs((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, cadence: frequency.value } : item,
                              ),
                            )
                          }
                        />
                        <span>{frequency.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="button-row">
                {savedFacts.length > 0 ? (
                  <button type="button" className="button button-secondary" onClick={() => setUseSaved(true)}>
                    Use saved pay
                  </button>
                ) : null}
                {!useSaved && readyToRemember && differsFromSaved ? (
                  <button type="button" className="button button-secondary" onClick={() => void updateHouseholdPay()}>
                    {savedFacts.length > 0 ? "Update household pay" : "Remember this pay"}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <fieldset className="card stack">
          <legend>Which month should the answer use?</legend>
          <label className="choice">
            <input
              type="radio"
              name="basis"
              value="ordinary-month"
              checked={basis === "ordinary-month"}
              onChange={() => setBasis("ordinary-month")}
            />
            <span>{ordinaryLabel}</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="basis"
              value="monthly-average"
              checked={basis === "monthly-average"}
              onChange={() => setBasis("monthly-average")}
            />
            <span>Monthly average</span>
          </label>
          <p className="hint">The selected basis is shown in the answer. It does not change household pay.</p>
        </fieldset>

        <div className="field">
          <label htmlFor="commitments">Other monthly commitments (USD)</label>
          <input
            id="commitments"
            className="text-input"
            inputMode="decimal"
            value={commitments}
            placeholder="For example, 1500"
            aria-invalid={missing.some((item) => item.path === "commitmentsMonthly") || undefined}
            aria-describedby="commitments-hint"
            onChange={(event) => setCommitments(event.target.value)}
          />
          <p id="commitments-hint" className="hint">
            Loans or other monthly bills you want counted. Enter 0 if there are none. Food and utilities you leave
            out are not included.
          </p>
        </div>

        <div className="option-grid">
          {options.map((option, index) => (
            <fieldset key={option.id} className="card stack">
              <legend>Option {index + 1}</legend>
              <div className="field">
                <label htmlFor={`option-${index}-name`}>Option name</label>
                <input
                  id={`option-${index}-name`}
                  className="text-input"
                  value={option.name}
                  onChange={(event) => updateOption(index, { name: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`option-${index}-payment`}>Monthly payment (USD)</label>
                <input
                  id={`option-${index}-payment`}
                  ref={index === 1 ? secondPaymentRef : undefined}
                  className="text-input"
                  inputMode="decimal"
                  value={option.monthlyPayment}
                  placeholder="For example, 2500"
                  onChange={(event) => updateOption(index, { monthlyPayment: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`option-${index}-upfront`}>Cash needed up front (USD)</label>
                <input
                  id={`option-${index}-upfront`}
                  className="text-input"
                  inputMode="decimal"
                  value={option.upfrontCash}
                  placeholder="For example, 3000"
                  onChange={(event) => updateOption(index, { upfrontCash: event.target.value })}
                />
              </div>
            </fieldset>
          ))}
        </div>

        <div className="button-row">
          <button type="submit" className="button button-primary" disabled={pending}>
            {result ? "Update the comparison" : "See what I would have left"}
          </button>
          <button type="button" className="button button-secondary" onClick={() => secondPaymentRef.current?.focus()}>
            Change {options[1]?.name || "option 2"} monthly payment
          </button>
        </div>
      </form>

      {result?.status === "complete" ? (
        <section className="card stack">
          <h2>Save comparison</h2>
          <p>Saving the comparison keeps household pay as it is, unless you check the box.</p>
          <div className="field">
            <label htmlFor="plan-name">Comparison name</label>
            <input
              id="plan-name"
              className="text-input"
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
            />
          </div>
          <label className="choice">
            <input
              type="checkbox"
              checked={rememberFacts}
              onChange={(event) => setRememberFacts(event.target.checked)}
            />
            <span>Also remember this take-home pay</span>
          </label>
          <button type="button" className="button button-primary" onClick={() => void saveComparison()}>
            Save comparison
          </button>
          {planHref ? (
            <p>
              <a href={planHref}>View my plan</a>
            </p>
          ) : null}
        </section>
      ) : null}
      {saveMessage ? (
        <p role="status" className={saveMessage.includes("not") ? "field-error" : "hint"}>
          {saveMessage}
        </p>
      ) : null}
    </div>
  );
}

function HousingAnswer({
  result,
  onChangeOption,
  optionName,
}: {
  result: HousingResult;
  onChangeOption: () => void;
  optionName: string;
}) {
  const columns = result.options.map((option) => ({ id: option.id, name: option.name }));
  const cell = (cents: number | null) => (cents == null ? "Unknown" : formatUsd(cents));
  return (
    <section className="result stack">
      <p className="result-kicker">{result.basisLabel}</p>
      <h2 className="result-answer">{result.answer ?? "Enter the missing amounts to compare the options."}</h2>
      <p className="result-note">{result.limitations[0]}</p>
      <OptionComparison
        caption={result.basisLabel}
        columns={columns}
        rows={[
          {
            id: "pay",
            label: "Take-home pay",
            values: Object.fromEntries(result.options.map((option) => [option.id, cell(result.incomeCents)])),
          },
          {
            id: "commitments",
            label: "Other entered commitments",
            values: Object.fromEntries(result.options.map((option) => [option.id, cell(result.commitmentsCents)])),
          },
          {
            id: "payment",
            label: "Monthly housing payment",
            values: Object.fromEntries(result.options.map((option) => [option.id, cell(option.monthlyPaymentCents)])),
          },
          {
            id: "left",
            label: "Left after entered costs",
            emphasis: true,
            values: Object.fromEntries(
              result.options.map((option) => [option.id, cell(option.leftAfterEnteredCostsCents)]),
            ),
          },
          {
            id: "upfront",
            label: "Cash needed to move in",
            emphasis: true,
            values: Object.fromEntries(result.options.map((option) => [option.id, cell(option.upfrontCashCents)])),
          },
        ]}
      />
      {result.difference ? (
        <p>
          <strong>Why these numbers differ: </strong>
          {result.difference.narrative}
        </p>
      ) : null}
      {result.assumptions.length > 0 ? (
        <p>
          <strong>Pay assumption: </strong>
          {result.assumptions.join(" ")}
        </p>
      ) : null}
      <button type="button" className="button button-secondary" onClick={onChangeOption}>
        Change {optionName} monthly payment
      </button>
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
