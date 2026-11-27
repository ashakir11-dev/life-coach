import { isCadence, type Cadence } from "@/domain/cadence";
import { parseUsd } from "@/domain/money";
import { evaluateToolInput } from "./evaluate";
import type { HouseholdRepository, SavedPlan, TakeHomeFact } from "./types";

export type FactDraft = {
  contextId: string;
  label?: string;
  netPay: string;
  cadence: Cadence;
};

export type ReplaceFactsRequest = {
  expectedRevisions: { contextId: string; revision: number }[];
  facts: FactDraft[];
};

export type FactConflict = {
  contextId: string;
  stored: TakeHomeFact;
  proposedNetPay: string | null;
};

export type ReplaceFactsResult =
  | { ok: true; facts: TakeHomeFact[] }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; conflicts: FactConflict[] };

type Clock = () => string;

export async function replaceTakeHomeFacts(
  repo: HouseholdRepository,
  householdId: string,
  input: ReplaceFactsRequest,
  clock: Clock,
): Promise<ReplaceFactsResult> {
  const current = await repo.listFacts(householdId);
  const expected = new Map(input.expectedRevisions.map((item) => [item.contextId, item.revision]));
  const conflicts: FactConflict[] = [];

  for (const fact of current) {
    if (expected.get(fact.contextId) !== fact.revision) {
      const proposed = input.facts.find((item) => item.contextId === fact.contextId);
      conflicts.push({
        contextId: fact.contextId,
        stored: fact,
        proposedNetPay: proposed?.netPay ?? null,
      });
    }
  }

  if (conflicts.length > 0) return { ok: false, status: 409, conflicts };

  const next: TakeHomeFact[] = [];
  for (const draft of input.facts) {
    const parsed = parseUsd(draft.netPay);
    if (!parsed.ok || !isCadence(draft.cadence)) {
      return {
        ok: false,
        status: 400,
        error: "Enter a take-home amount and how often it is paid.",
      };
    }
    const previous = current.find((fact) => fact.contextId === draft.contextId);
    next.push({
      key: "income.take_home",
      contextId: draft.contextId,
      label: draft.label?.trim() || "Paycheck",
      amountCents: parsed.cents,
      cadence: draft.cadence,
      unit: "USD",
      revision: previous ? previous.revision + 1 : 1,
      confirmedAt: clock(),
      origin: "user-entered",
    });
  }

  await repo.saveFacts(householdId, next);
  return { ok: true, facts: next };
}

type JobLike = {
  id?: string;
  label?: string;
  netPay?: string;
  cadence?: string;
};

function jobsFromInput(input: unknown): FactDraft[] {
  if (!input || typeof input !== "object" || !("jobs" in input) || !Array.isArray(input.jobs)) return [];
  return input.jobs.flatMap((job: JobLike) => {
    if (!job.id || !job.netPay || !isCadence(job.cadence)) return [];
    return [{ contextId: job.id, label: job.label, netPay: job.netPay, cadence: job.cadence }];
  });
}

export type CreatePlanRequest = {
  name: string;
  toolId: string;
  input: unknown;
  rememberFacts: boolean;
};

export type CreatePlanResult =
  | { ok: true; plan: SavedPlan }
  | { ok: false; status: 400 | 404 | 409; error: string; conflicts?: FactConflict[] };

export async function createPlan(
  repo: HouseholdRepository,
  householdId: string,
  body: CreatePlanRequest,
  clock: Clock,
  idempotencyKey: string | null,
): Promise<CreatePlanResult> {
  if (idempotencyKey) {
    const existing = await repo.findPlanByIdempotency(householdId, idempotencyKey);
    if (existing) return { ok: true, plan: existing };
  }

  const evaluated = evaluateToolInput(body.toolId, body.input);
  if (!evaluated.ok) {
    return { ok: false, status: evaluated.status, error: "Check the answers and try the comparison again." };
  }

  if (body.rememberFacts) {
    const current = await repo.listFacts(householdId);
    const saved = await replaceTakeHomeFacts(
      repo,
      householdId,
      {
        expectedRevisions: current.map((fact) => ({
          contextId: fact.contextId,
          revision: fact.revision,
        })),
        facts: jobsFromInput(body.input),
      },
      clock,
    );
    if (!saved.ok) {
      return {
        ok: false,
        status: saved.status,
        error: saved.status === 400 ? saved.error : "Household pay changed somewhere else. Review it before saving.",
        conflicts: saved.status === 409 ? saved.conflicts : undefined,
      };
    }
  }

  const plan: SavedPlan = {
    id: crypto.randomUUID(),
    householdId,
    name: body.name.trim() || "Saved comparison",
    toolId: evaluated.toolId,
    toolVersion: evaluated.toolVersion,
    input: body.input,
    result: evaluated.result,
    createdAt: clock(),
    idempotencyKey,
  };
  await repo.savePlan(householdId, plan);
  return { ok: true, plan };
}
