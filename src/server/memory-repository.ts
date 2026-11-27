import type { HouseholdRepository, SavedPlan, TakeHomeFact } from "./types";

type MemoryState = {
  facts: Map<string, TakeHomeFact[]>;
  plans: Map<string, SavedPlan[]>;
};

export function createMemoryRepository(): HouseholdRepository {
  const state: MemoryState = {
    facts: new Map(),
    plans: new Map(),
  };

  return {
    async listFacts(householdId) {
      return (state.facts.get(householdId) ?? []).map((fact) => ({ ...fact }));
    },
    async saveFacts(householdId, facts) {
      state.facts.set(
        householdId,
        facts.map((fact) => ({ ...fact })),
      );
    },
    async listPlans(householdId) {
      return (state.plans.get(householdId) ?? []).map((plan) => ({ ...plan }));
    },
    async getPlan(householdId, planId) {
      return state.plans.get(householdId)?.find((plan) => plan.id === planId) ?? null;
    },
    async findPlanByIdempotency(householdId, key) {
      return state.plans.get(householdId)?.find((plan) => plan.idempotencyKey === key) ?? null;
    },
    async savePlan(householdId, plan) {
      const plans = state.plans.get(householdId) ?? [];
      plans.push({ ...plan });
      state.plans.set(householdId, plans);
    },
  };
}

const globalStore = globalThis as typeof globalThis & {
  __dayfolioMemory?: HouseholdRepository;
};

export function getMemoryRepository(): HouseholdRepository {
  if (!globalStore.__dayfolioMemory) {
    globalStore.__dayfolioMemory = createMemoryRepository();
  }
  return globalStore.__dayfolioMemory;
}
