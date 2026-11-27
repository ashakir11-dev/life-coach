import { readGuestId } from "@/server/guest";
import { getRepository } from "@/server/repository";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HouseholdList } from "./household-list";

export const metadata: Metadata = { title: "Household" };

export default function HouseholdPage() {
  return (
    <>
      <h1>Household</h1>
      <p className="lede">
        Remembered facts stay here until you change them. Trying a different number in a comparison does not update
        them.
      </p>
      <Suspense fallback={<p>Loading household facts…</p>}>
        <HouseholdFacts />
      </Suspense>
    </>
  );
}

async function HouseholdFacts() {
  const householdId = await readGuestId();
  const facts = householdId ? await getRepository().listFacts(householdId) : [];
  return <HouseholdList initialFacts={facts} />;
}
