"use client";

import { cadencePhrase } from "@/domain/cadence";
import { centsToInput, formatUsd } from "@/domain/money";
import { formatConfirmedAt } from "@/lib/dates";
import type { TakeHomeFact } from "@/server/types";
import { useState } from "react";

export function HouseholdList({ initialFacts }: { initialFacts: TakeHomeFact[] }) {
  const [facts, setFacts] = useState(initialFacts);
  const [message, setMessage] = useState("");

  async function removeFact(contextId: string) {
    const response = await fetch("/api/v1/household/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevisions: facts.map((fact) => ({ contextId: fact.contextId, revision: fact.revision })),
        facts: facts
          .filter((fact) => fact.contextId !== contextId)
          .map((fact) => ({
            contextId: fact.contextId,
            label: fact.label,
            netPay: centsToInput(fact.amountCents),
            cadence: fact.cadence,
          })),
      }),
    });
    const body = (await response.json()) as { facts?: TakeHomeFact[]; error?: string };
    if (!response.ok || !body.facts) {
      setMessage(body.error ?? "That fact is still saved. Try removing it again.");
      return;
    }
    setFacts(body.facts);
    setMessage("Removed from household facts. Saved comparisons keep the amounts they were saved with.");
  }

  if (facts.length === 0) {
    return (
      <p>You have not chosen to remember any household facts yet. Saving is separate from trying a number in a tool.</p>
    );
  }

  return (
    <div className="stack">
      <p role="status">{message}</p>
      <ul className="fact-list">
        {facts.map((fact) => (
          <li key={fact.contextId} className="card stack">
            <h2>{fact.label}</h2>
            <p>
              {formatUsd(fact.amountCents)} {cadencePhrase(fact.cadence)} · you entered this · confirmed{" "}
              {formatConfirmedAt(fact.confirmedAt)}
            </p>
            <p className="hint">Used by housing cash flow.</p>
            <button type="button" className="button button-secondary" onClick={() => void removeFact(fact.contextId)}>
              Remove {fact.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">
        On this copy, remembered facts stay with this browser until the app restarts, unless a database is connected.
      </p>
    </div>
  );
}
