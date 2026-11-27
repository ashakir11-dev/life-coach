import type { Cadence } from "@/domain/cadence";

export type TakeHomeFact = {
  key: "income.take_home";
  contextId: string;
  label: string;
  amountCents: number;
  cadence: Cadence;
  unit: "USD";
  revision: number;
  confirmedAt: string;
  origin: "user-entered";
};

export type SavedPlan = {
  id: string;
  householdId: string;
  name: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  result: unknown;
  createdAt: string;
  idempotencyKey: string | null;
};

export type HouseholdRepository = {
  listFacts(householdId: string): Promise<TakeHomeFact[]>;
  saveFacts(householdId: string, facts: TakeHomeFact[]): Promise<void>;
  listPlans(householdId: string): Promise<SavedPlan[]>;
  getPlan(householdId: string, planId: string): Promise<SavedPlan | null>;
  findPlanByIdempotency(householdId: string, key: string): Promise<SavedPlan | null>;
  savePlan(householdId: string, plan: SavedPlan): Promise<void>;
};
