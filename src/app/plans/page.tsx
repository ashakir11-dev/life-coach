import { getTool } from "@/registry";
import { readGuestId } from "@/server/guest";
import { getRepository } from "@/server/repository";
import { formatConfirmedAt } from "@/lib/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "My plans" };

export default function PlansPage() {
  return (
    <>
      <h1>My plans</h1>
      <Suspense fallback={<p>Loading saved comparisons…</p>}>
        <PlanList />
      </Suspense>
    </>
  );
}

async function PlanList() {
  const householdId = await readGuestId();
  const plans = householdId ? await getRepository().listPlans(householdId) : [];
  if (plans.length === 0) {
    return (
      <div className="stack">
        <p>Your saved comparisons and checklists will appear here.</p>
        <p>
          <Link href="/">Explore a question</Link>
        </p>
      </div>
    );
  }

  return (
    <ul className="fact-list">
      {plans.map((plan) => {
        const tool = getTool(plan.toolId);
        return (
          <li key={plan.id} className="card stack">
            <h2>
              <Link href={`/plans/${plan.id}`}>{plan.name}</Link>
            </h2>
            <p className="hint">
              {tool?.question ?? plan.toolId} · saved {formatConfirmedAt(plan.createdAt)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
