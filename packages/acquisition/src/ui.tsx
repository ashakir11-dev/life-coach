"use client";

import { toolClassName } from "@dayfolio/tool-chrome";
import "@dayfolio/tool-chrome/styles.css";
import { useId, useState } from "react";
import { describeAcquisitionChanges } from "./changes";
import { evaluateAcquisition, type AcquisitionEvaluation } from "./evaluate";
import { acquisitionManifest, sampleComparisonInput } from "./fixtures";
import type { AcquisitionInput } from "./schema";

export type AcquisitionToolProps = {
  asOf: string;
  onSaveRequest?: (draft: { input: AcquisitionInput; result: AcquisitionEvaluation }) => void;
};

type FinanceMode = "calculate" | "quote";

export function AcquisitionTool({ asOf, onSaveRequest }: AcquisitionToolProps) {
  const [input, setInput] = useState<AcquisitionInput>({ currency: "USD" });
  const [baseline, setBaseline] = useState<AcquisitionInput | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [mode, setMode] = useState<FinanceMode>("calculate");
  const [saveNote, setSaveNote] = useState("");
  const result = evaluateAcquisition(input, { asOf });
  const [shown, setShown] = useState(result.ok ? result : null);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const resultKey = result.ok ? JSON.stringify(result) : null;
  if (resultKey && resultKey !== shownKey && result.ok) {
    setShown(result);
    setShownKey(resultKey);
  }
  const answer = result.ok ? result : shown;
  const stale = !result.ok && answer !== null;

  function commit(next: AcquisitionInput, nextMode = mode) {
    const normalized = normalizeFinance(next, nextMode);
    const nextResult = evaluateAcquisition(normalized, { asOf });
    if (nextResult.ok) {
      if (baseline) {
        const effect = describeAcquisitionChanges(baseline, normalized, { asOf });
        if (effect.affected.length > 0) {
          setChangeSummary(effect.summary);
          setBaseline(normalized);
        }
      } else {
        setBaseline(normalized);
        setChangeSummary("Comparison updated.");
      }
    }
    setMode(nextMode);
    setInput(normalized);
    setSaveNote("");
  }

  return (
    <article className={toolClassName}>
      <header>
        <h1>{acquisitionManifest.question}</h1>
        <p className="df-lead">
          See the cash due at signing and the monthly payment for the same item over the term you
          choose. You can try a lease quote, a finance quote or estimate, and paying cash. No
          account is required.
        </p>
      </header>

      {answer && (answer.compare || answer.paths.some((path) => path.complete)) ? (
        <section className="df-answer" aria-labelledby="acquisition-answer">
          <h2 id="acquisition-answer">
            {answer.compare
              ? `Over ${answer.termMonths} months`
              : "Cash for the path you entered"}
          </h2>
          <p>{answer.compare?.narrative ?? answer.educate.summary}</p>
          <ul className="df-list">
            {answer.limitations.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {answer.compare ? (
            <div className="df-table-wrap">
              <table className="df-table">
                <caption>{answer.compare.periodLabel}. Amounts are cash you pay, in US dollars.</caption>
                <thead>
                  <tr>
                    <th scope="col">Cash</th>
                    {answer.compare.columns.map((column) => (
                      <th key={column.id} scope="col">
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {answer.compare.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      {answer.compare?.columns.map((column) => (
                        <td key={column.id}>{row.cells[column.id]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {answer.paths
            .filter((path) => path.notes.length > 0)
            .map((path) => (
              <p key={path.id} className="df-note">
                {path.name}: {path.notes.join(" ")}
              </p>
            ))}
          <p className="df-status" role="status">
            {stale
              ? "These figures use the previous valid inputs. Fix the highlighted amount to update them."
              : changeSummary || "Comparison updated."}
          </p>
        </section>
      ) : null}

      <form
        className="df-section"
        onSubmit={(event) => {
          event.preventDefault();
          commit(input);
        }}
      >
        <h2>Your quotes</h2>
        <Field
          label="Item"
          value={input.itemLabel ?? ""}
          onChange={(value) => commit({ ...input, itemLabel: value || undefined })}
        />
        <Field
          label="Term in months"
          hint="Lease, finance, and cash all use this same term."
          inputMode="numeric"
          value={input.termMonths?.toString() ?? ""}
          onChange={(value) => {
            const termMonths = Number(value);
            commit({
              ...input,
              termMonths: value === "" || Number.isNaN(termMonths) ? undefined : termMonths,
            });
          }}
        />

        <fieldset>
          <legend>Lease</legend>
          <MoneyField
            label="Monthly payment"
            hint="US dollars each month"
            value={input.lease?.monthlyPayment ?? ""}
            onChange={(monthlyPayment) =>
              commit({ ...input, lease: { ...input.lease, monthlyPayment } })
            }
          />
          <MoneyField
            label="Amount due at signing"
            hint="US dollars"
            value={input.lease?.dueAtSigning ?? ""}
            onChange={(dueAtSigning) => commit({ ...input, lease: { ...input.lease, dueAtSigning } })}
          />
          <MoneyField
            label="Refundable portion"
            hint="Optional. Still counted in the upfront cash."
            value={input.lease?.refundablePortion ?? ""}
            onChange={(refundablePortion) =>
              commit({
                ...input,
                lease: {
                  ...input.lease,
                  refundablePortion: refundablePortion || undefined,
                },
              })
            }
          />
        </fieldset>

        <fieldset>
          <legend>Finance</legend>
          <div role="radiogroup" aria-label="How to enter finance">
            <label className="df-choice">
              <input
                type="radio"
                name="finance-mode"
                checked={mode === "quote"}
                onChange={() => commit(input, "quote")}
              />
              I have a lender quote
            </label>
            <label className="df-choice">
              <input
                type="radio"
                name="finance-mode"
                checked={mode === "calculate"}
                onChange={() => commit(input, "calculate")}
              />
              Estimate from the price and rate
            </label>
          </div>
          {mode === "quote" ? (
            <>
              <MoneyField
                label="Quoted monthly payment"
                hint="US dollars each month"
                value={input.finance?.quotedMonthlyPayment ?? ""}
                onChange={(quotedMonthlyPayment) =>
                  commit({ ...input, finance: { ...input.finance, quotedMonthlyPayment } })
                }
              />
              <MoneyField
                label="Quote due at signing"
                hint="US dollars"
                value={input.finance?.quoteDueAtSigning ?? ""}
                onChange={(quoteDueAtSigning) =>
                  commit({ ...input, finance: { ...input.finance, quoteDueAtSigning } })
                }
              />
            </>
          ) : (
            <>
              <MoneyField
                label="Price"
                hint="US dollars"
                value={input.finance?.purchasePrice ?? ""}
                onChange={(purchasePrice) =>
                  commit({ ...input, finance: { ...input.finance, purchasePrice } })
                }
              />
              <MoneyField
                label="Down payment"
                hint="US dollars. Enter 0.00 if there is no down payment."
                value={input.finance?.downPayment ?? ""}
                onChange={(downPayment) =>
                  commit({ ...input, finance: { ...input.finance, downPayment } })
                }
              />
              <MoneyField
                label="Fees at signing"
                hint="Optional. US dollars. Blank counts as $0."
                value={input.finance?.feesAtSigning ?? ""}
                onChange={(feesAtSigning) =>
                  commit({
                    ...input,
                    finance: { ...input.finance, feesAtSigning: feesAtSigning || undefined },
                  })
                }
              />
              <Field
                label="Annual rate"
                hint="Percent per year, such as 6 or 6.5. The estimate divides it by 12."
                inputMode="decimal"
                value={input.finance?.aprPercent ?? ""}
                onChange={(value) =>
                  commit({
                    ...input,
                    finance: { ...input.finance, aprPercent: value || undefined },
                  })
                }
              />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Pay cash</legend>
          <MoneyField
            label="Amount due"
            hint="US dollars up front. The monthly purchase payment is $0."
            value={input.cash?.amountDue ?? ""}
            onChange={(amountDue) => commit({ ...input, cash: { amountDue } })}
          />
        </fieldset>

        {!result.ok ? <ErrorList errors={result.errors.map((error) => error.message)} /> : null}
        {answer?.ok ? (
          <MissingList questions={answer.sandbox.missing.map((item) => item.question)} />
        ) : null}

        <div className="df-actions">
          <button className="df-button" type="submit">
            Update comparison
          </button>
          <button
            className="df-button df-button-secondary"
            type="button"
            onClick={() => commit(sampleComparisonInput, "calculate")}
          >
            Try a sample comparison
          </button>
          <button
            className="df-button df-button-secondary"
            type="button"
            onClick={() => {
              if (!answer) return;
              onSaveRequest?.({ input, result });
              setSaveNote(
                "Your comparison stays on this page. Saving an account is separate, and this tool does not require one.",
              );
            }}
          >
            Save comparison
          </button>
        </div>
        {saveNote ? (
          <p className="df-status" role="status">
            {saveNote}
          </p>
        ) : null}
      </form>

      {answer ? (
        <details className="df-section">
          <summary>See the calculation and sources</summary>
          {answer.sandbox.math.map((item) => (
            <div key={item.pathId}>
              <h2>{item.pathId}</h2>
              <ol className="df-list">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
          <h2>Assumptions</h2>
          <ul className="df-list">
            {answer.educate.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2>Sources</h2>
          <ul className="df-list">
            {answer.educate.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url}>{source.title}</a>
                <span className="df-source"> {source.note}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint} inputMode="decimal" value={value} onChange={onChange} />
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="df-field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span id={hintId} className="df-hint">
          {hint}
        </span>
      ) : null}
      <input
        id={id}
        inputMode={inputMode}
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function MissingList({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <div>
      <h2>Still needed</h2>
      <ul className="df-list">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="df-list">
      {errors.map((error) => (
        <li key={error} className="df-error">
          {error}
        </li>
      ))}
    </ul>
  );
}

function normalizeFinance(input: AcquisitionInput, mode: FinanceMode): AcquisitionInput {
  if (!input.finance) return input;
  if (mode === "quote") {
    return {
      ...input,
      finance: {
        quotedMonthlyPayment: input.finance.quotedMonthlyPayment,
        quoteDueAtSigning: input.finance.quoteDueAtSigning,
      },
    };
  }
  return {
    ...input,
    finance: {
      purchasePrice: input.finance.purchasePrice,
      downPayment: input.finance.downPayment,
      feesAtSigning: input.finance.feesAtSigning,
      feesFinanced: input.finance.feesFinanced,
      aprPercent: input.finance.aprPercent,
    },
  };
}
