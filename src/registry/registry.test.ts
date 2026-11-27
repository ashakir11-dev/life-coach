import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { housingTool } from "../modules/housing/tool";
import { paycheckTool } from "../modules/paycheck/tool";
import { createRegistry } from "./registry";

const payInput = {
  jobs: [{ id: "job-1", label: "Main job", netPay: "2400", cadence: "biweekly" }],
};

describe("tool registry", () => {
  test("lists paycheck and housing with educate, sandbox, and compare", () => {
    const registry = createRegistry();
    registry.register(paycheckTool);
    registry.register(housingTool);

    const tools = registry.list();
    expect(tools.map((tool) => tool.id)).toEqual(["paycheck", "housing"]);
    for (const tool of tools) {
      expect(tool.targets).toEqual(["educate", "sandbox", "compare"]);
      expect(tool.question.length).toBeGreaterThan(0);
      expect(tool.href.startsWith("/tools/")).toBe(true);
    }
    expect(tools.map((tool) => tool.id).join(" ")).not.toMatch(/pickup|childcare/i);
  });

  test("evaluates paycheck through the registry and rejects an unknown tool", () => {
    const registry = createRegistry();
    registry.register(paycheckTool);

    const result = registry.evaluate("paycheck", payInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.result as { combined: { averageMonthlyCents: number } };
      expect(result.toolVersion).toBe("1.0.0");
      expect(value.combined.averageMonthlyCents).toBe(520_000);
    }

    const missing = registry.evaluate("pickup", {});
    expect(missing).toMatchObject({ ok: false, status: 404 });
  });

  test("returns field issues for an invalid paycheck body", () => {
    const registry = createRegistry();
    registry.register(paycheckTool);

    const result = registry.evaluate("paycheck", { jobs: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  test("lets another tool register beside paycheck and housing", () => {
    const registry = createRegistry();
    registry.register(paycheckTool);
    registry.register(housingTool);
    registry.register({
      id: "example-guide",
      version: "1.0.0",
      domain: "life-admin",
      topic: "Life administration",
      question: "Where do I start this paperwork?",
      summary: "A stand-in tool used to prove registration.",
      aliases: ["paperwork"],
      href: "/tools/example-guide",
      targets: ["educate", "sandbox", "compare"],
      factBindings: { consumes: [], contributes: [] },
      coverage: "Example only",
      sources: [{ title: "Example", note: "Not a product tool." }],
      inputSchema: z.object({ note: z.string() }),
      evaluate: (input: unknown) => ({ echo: (input as { note: string }).note }),
    });

    expect(registry.list().map((tool) => tool.id)).toEqual([
      "paycheck",
      "housing",
      "example-guide",
    ]);
    const pay = registry.evaluate("paycheck", payInput);
    expect(pay.ok).toBe(true);
    const extra = registry.evaluate("example-guide", { note: "hello" });
    expect(extra.ok).toBe(true);
  });

  test("refuses a duplicate tool id", () => {
    const registry = createRegistry();
    registry.register(paycheckTool);
    expect(() => registry.register(paycheckTool)).toThrow(/already registered/i);
  });

  test("paycheck and housing modules do not import each other", () => {
    const paycheck = readFileSync(new URL("../modules/paycheck/tool.ts", import.meta.url), "utf8");
    const housing = readFileSync(new URL("../modules/housing/tool.ts", import.meta.url), "utf8");
    expect(paycheck).not.toMatch(/modules\/housing|evaluateHousing/);
    expect(housing).not.toMatch(/modules\/paycheck|evaluatePaycheck/);
  });
});
