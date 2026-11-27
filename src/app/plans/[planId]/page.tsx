import { getTool } from "@/registry";
import { readGuestId } from "@/server/guest";
import { getRepository } from "@/server/repository";
import { formatConfirmedAt } from "@/lib/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Saved comparison" };

export default function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  return (
    <Suspense fallback={<p>Loading this comparison…</p>}>
      <SavedPlan params={params} />
    </Suspense>
  );
}

async function SavedPlan({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const householdId = await readGuestId();
  const plan = householdId ? await getRepository().getPlan(householdId, planId) : null;
  if (!plan) notFound();
  const tool = getTool(plan.toolId);
  const result = plan.result as { answer?: string | null; basisLabel?: string; limitations?: string[] };
  const input = plan.input as { basis?: string };

  return (
    <>
      <p className="eyebrow">Saved comparison</p>
      <h1>{plan.name}</h1>
      <p className="lede">
        Saved {formatConfirmedAt(plan.createdAt)}
        {tool ? ` from “${tool.question}”` : ""}. {result.basisLabel ?? input.basis ?? "The saved basis"} was the month
        used for this result.
      </p>
      {result.answer ? <p className="result-answer">{result.answer}</p> : null}
      {result.limitations?.[0] ? <p className="result-note">{result.limitations[0]}</p> : null}
      <p>This keeps the amounts from when you saved it. Household pay changes only when you update them on purpose.</p>
      <p>
        <Link href="/plans">Back to my plans</Link>
      </p>
    </>
  );
}
