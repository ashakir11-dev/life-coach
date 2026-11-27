import { createDrizzleRepository } from "./drizzle-repository";
import { getMemoryRepository } from "./memory-repository";
import type { HouseholdRepository } from "./types";

export function getRepository(): HouseholdRepository {
  const url = process.env.DATABASE_URL;
  if (!url) return getMemoryRepository();
  return createDrizzleRepository(url);
}
