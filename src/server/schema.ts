import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const takeHomeFacts = pgTable("take_home_facts", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  contextId: text("context_id").notNull(),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  cadence: text("cadence").notNull(),
  unit: text("unit").notNull(),
  revision: integer("revision").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }).notNull(),
  origin: text("origin").notNull(),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  name: text("name").notNull(),
  toolId: text("tool_id").notNull(),
  toolVersion: text("tool_version").notNull(),
  input: jsonb("input").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  idempotencyKey: text("idempotency_key"),
});
