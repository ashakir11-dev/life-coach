import { describe, expect, it } from "vitest";
import { toolContributions } from "./index";

describe("tool contribution registry", () => {
  it("mounts lease-purchase-finance and the birth-certificate guide only", () => {
    expect(toolContributions.map((tool) => tool.id)).toEqual([
      "lease-purchase-finance",
      "us-birth-certificate",
    ]);
    const serialized = JSON.stringify(toolContributions.map((tool) => tool.id));
    expect(serialized).not.toMatch(/paycheck|housing|pickup|childcare/i);
    for (const tool of toolContributions) {
      expect(tool.targets).toEqual(["educate", "sandbox", "compare"]);
      expect(tool.inputSchema).toBeTypeOf("object");
      expect(tool.evaluate).toBeTypeOf("function");
      expect(tool.version).toBe("1.0.0");
      expect(tool.aliases.length).toBeGreaterThan(0);
    }
  });

  it("evaluates a guest acquisition without a profile write", () => {
    const tool = toolContributions[0];
    expect(tool).toBeDefined();
    const result = tool!.evaluate(
      {
        termMonths: 36,
        cash: { amountDue: "100.00" },
      },
      { asOf: "2026-11-27" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("profileWrites" in result).toBe(false);
  });
});
