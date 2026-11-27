import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isCadence, type Cadence } from "@/domain/cadence";
import { households, plans, takeHomeFacts } from "./schema";
import type { HouseholdRepository, SavedPlan, TakeHomeFact } from "./types";

type Database = ReturnType<typeof drizzle>;

let database: Database | null = null;

function getDatabase(url: string): Database {
  if (!database) {
    database = drizzle(postgres(url, { max: 1 }));
  }
  return database;
}

function asCadence(value: string): Cadence {
  if (!isCadence(value)) throw new Error(`Stored cadence is not supported: ${value}`);
  return value;
}

export function createDrizzleRepository(url: string): HouseholdRepository {
  const db = getDatabase(url);

  async function ensureHousehold(householdId: string, at: string) {
    await db.insert(households).values({ id: householdId, createdAt: at }).onConflictDoNothing();
  }

  return {
    async listFacts(householdId) {
      const rows = await db
        .select()
        .from(takeHomeFacts)
        .where(eq(takeHomeFacts.householdId, householdId));
      return rows.map((row) => ({
        key: "income.take_home" as const,
        contextId: row.contextId,
        label: row.label,
        amountCents: row.amountCents,
        cadence: asCadence(row.cadence),
        unit: "USD" as const,
        revision: row.revision,
        confirmedAt: row.confirmedAt,
        origin: "user-entered" as const,
      }));
    },
    async saveFacts(householdId, facts) {
      const at = facts[0]?.confirmedAt ?? new Date().toISOString();
      await ensureHousehold(householdId, at);
      await db.delete(takeHomeFacts).where(eq(takeHomeFacts.householdId, householdId));
      if (facts.length === 0) return;
      await db.insert(takeHomeFacts).values(
        facts.map((fact) => ({
          id: crypto.randomUUID(),
          householdId,
          contextId: fact.contextId,
          label: fact.label,
          amountCents: fact.amountCents,
          cadence: fact.cadence,
          unit: fact.unit,
          revision: fact.revision,
          confirmedAt: fact.confirmedAt,
          origin: fact.origin,
        })),
      );
    },
    async listPlans(householdId) {
      const rows = await db.select().from(plans).where(eq(plans.householdId, householdId));
      return rows.map(rowToPlan);
    },
    async getPlan(householdId, planId) {
      const rows = await db
        .select()
        .from(plans)
        .where(eq(plans.householdId, householdId));
      return rows.map(rowToPlan).find((plan) => plan.id === planId) ?? null;
    },
    async findPlanByIdempotency(householdId, key) {
      const rows = await db.select().from(plans).where(eq(plans.householdId, householdId));
      return rows.map(rowToPlan).find((plan) => plan.idempotencyKey === key) ?? null;
    },
    async savePlan(householdId, plan) {
      await ensureHousehold(householdId, plan.createdAt);
      await db.insert(plans).values({
        id: plan.id,
        householdId,
        name: plan.name,
        toolId: plan.toolId,
        toolVersion: plan.toolVersion,
        input: plan.input,
        result: plan.result,
        createdAt: plan.createdAt,
        idempotencyKey: plan.idempotencyKey,
      });
    },
  };
}

function rowToPlan(row: {
  id: string;
  householdId: string;
  name: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  result: unknown;
  createdAt: string;
  idempotencyKey: string | null;
}): SavedPlan {
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    toolId: row.toolId,
    toolVersion: row.toolVersion,
    input: row.input,
    result: row.result,
    createdAt: row.createdAt,
    idempotencyKey: row.idempotencyKey,
  };
}

export type { TakeHomeFact };
