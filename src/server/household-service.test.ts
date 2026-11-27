import { describe, expect, test } from "vitest";
import { evaluateToolInput } from "./evaluate";
import {
  createPlan,
  replaceTakeHomeFacts,
} from "./household-service";
import { createMemoryRepository } from "./memory-repository";

const clock = () => "2026-11-27T20:00:00.000Z";

const payFacts = {
  expectedRevisions: [] as { contextId: string; revision: number }[],
  facts: [
    {
      contextId: "job-1",
      label: "Main job",
      netPay: "2400",
      cadence: "biweekly" as const,
    },
  ],
};

const housingInput = {
  jobs: [{ id: "job-1", label: "Main job", netPay: "2400", cadence: "biweekly" }],
  basis: "ordinary-month",
  commitmentsMonthly: "1500",
  options: [
    { id: "a", name: "Apartment A", monthlyPayment: "2500", upfrontCash: "3000" },
    { id: "b", name: "Apartment B", monthlyPayment: "2700", upfrontCash: "4500" },
  ],
};

describe("household facts", () => {
  test("saves take-home pay only through an explicit replacement", async () => {
    const repo = createMemoryRepository();
    const saved = await replaceTakeHomeFacts(repo, "guest-1", payFacts, clock);

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.facts[0]).toMatchObject({
      key: "income.take_home",
      contextId: "job-1",
      amountCents: 240_000,
      cadence: "biweekly",
      revision: 1,
      confirmedAt: "2026-11-27T20:00:00.000Z",
      origin: "user-entered",
    });
  });

  test("keeps households separate", async () => {
    const repo = createMemoryRepository();
    await replaceTakeHomeFacts(repo, "guest-1", payFacts, clock);
    await replaceTakeHomeFacts(repo, "guest-2", { expectedRevisions: [], facts: [] }, clock);

    expect(await repo.listFacts("guest-2")).toEqual([]);
    expect(await repo.listFacts("guest-1")).toHaveLength(1);
  });

  test("rejects a stale revision and leaves the stored fact in place", async () => {
    const repo = createMemoryRepository();
    await replaceTakeHomeFacts(repo, "guest-1", payFacts, clock);
    const updated = await replaceTakeHomeFacts(
      repo,
      "guest-1",
      {
        expectedRevisions: [{ contextId: "job-1", revision: 1 }],
        facts: [{ contextId: "job-1", label: "Main job", netPay: "2500", cadence: "biweekly" }],
      },
      () => "2026-11-27T21:00:00.000Z",
    );
    expect(updated.ok).toBe(true);

    const conflict = await replaceTakeHomeFacts(
      repo,
      "guest-1",
      {
        expectedRevisions: [{ contextId: "job-1", revision: 1 }],
        facts: [{ contextId: "job-1", label: "Main job", netPay: "2600", cadence: "biweekly" }],
      },
      clock,
    );

    expect(conflict.ok).toBe(false);
    if (conflict.ok || conflict.status !== 409) {
      throw new Error("expected a revision conflict");
    }
    expect(conflict.conflicts[0]?.stored.amountCents).toBe(250_000);
    expect(conflict.conflicts[0]?.proposedNetPay).toBe("2600");
    const facts = await repo.listFacts("guest-1");
    expect(facts[0]?.amountCents).toBe(250_000);
    expect(facts[0]?.revision).toBe(2);
  });

  test("evaluation does not change saved household pay", async () => {
    const repo = createMemoryRepository();
    await replaceTakeHomeFacts(repo, "guest-1", payFacts, clock);
    const before = await repo.listFacts("guest-1");

    const evaluated = evaluateToolInput("housing", {
      ...housingInput,
      options: [
        housingInput.options[0],
        { ...housingInput.options[1], monthlyPayment: "2800" },
      ],
    });

    expect(evaluated.ok).toBe(true);
    expect(await repo.listFacts("guest-1")).toEqual(before);
  });

  test("saving a plan keeps household pay unless rememberFacts is chosen", async () => {
    const repo = createMemoryRepository();
    await replaceTakeHomeFacts(repo, "guest-1", payFacts, clock);

    const plan = await createPlan(
      repo,
      "guest-1",
      {
        name: "Spring decisions",
        toolId: "housing",
        input: {
          ...housingInput,
          jobs: [{ id: "job-1", label: "Main job", netPay: "3000", cadence: "biweekly" }],
        },
        rememberFacts: false,
      },
      clock,
      "idem-1",
    );

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.result).toMatchObject({ incomeCents: 600_000 });
    expect((await repo.listFacts("guest-1"))[0]?.amountCents).toBe(240_000);

    const retry = await createPlan(
      repo,
      "guest-1",
      {
        name: "Spring decisions",
        toolId: "housing",
        input: housingInput,
        rememberFacts: true,
      },
      clock,
      "idem-1",
    );
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.plan.id).toBe(plan.plan.id);
    expect((await repo.listFacts("guest-1"))[0]?.amountCents).toBe(240_000);
    expect(await repo.listPlans("guest-1")).toHaveLength(1);
  });

  test("rememberFacts writes the pay used in the comparison", async () => {
    const repo = createMemoryRepository();
    const plan = await createPlan(
      repo,
      "guest-1",
      {
        name: "Housing comparison",
        toolId: "housing",
        input: housingInput,
        rememberFacts: true,
      },
      clock,
      null,
    );

    expect(plan.ok).toBe(true);
    expect((await repo.listFacts("guest-1"))[0]?.amountCents).toBe(240_000);
  });
});
