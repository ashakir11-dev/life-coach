import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluateHousing } from "./housing";

const example = {
  jobs: [{ id: "job-1", label: "Main job", netPay: "2400", cadence: "biweekly" as const }],
  basis: "ordinary-month" as const,
  commitmentsMonthly: "1500",
  options: [
    { id: "a", name: "Apartment A", monthlyPayment: "2500", upfrontCash: "3000" },
    { id: "b", name: "Apartment B", monthlyPayment: "2700", upfrontCash: "4500" },
  ] as const,
};

describe("evaluateHousing", () => {
  test("compares monthly cash left and upfront cash for two named options", () => {
    const result = evaluateHousing(example);

    expect(result.status).toBe("complete");
    expect(result.basisLabel).toBe("Two-paycheck month");
    expect(result.incomeCents).toBe(480_000);
    expect(result.commitmentsCents).toBe(150_000);
    expect(result.options[0]).toMatchObject({
      name: "Apartment A",
      monthlyPaymentCents: 250_000,
      upfrontCashCents: 300_000,
      leftAfterEnteredCostsCents: 80_000,
    });
    expect(result.options[1]).toMatchObject({
      name: "Apartment B",
      monthlyPaymentCents: 270_000,
      upfrontCashCents: 450_000,
      leftAfterEnteredCostsCents: 60_000,
    });
    expect(result.answer).toBe(
      "In a two-paycheck month, you'd have $800 left with Apartment A or $600 left with Apartment B after the costs you entered.",
    );
    expect(result.difference?.narrative).toBe(
      "Apartment B costs $200 more per month and requires $1,500 more up front.",
    );
    expect(result.limitations).toContain(
      "Food, utilities and any other costs you left out still need to come from that amount.",
    );
    expect(result.limitations.join(" ")).toMatch(/not a rent-versus-buy/i);
  });

  test("uses the monthly average when that basis is selected", () => {
    const result = evaluateHousing({ ...example, basis: "monthly-average" });

    expect(result.incomeCents).toBe(520_000);
    expect(result.basisLabel).toBe("Monthly average");
    expect(result.options[0]?.leftAfterEnteredCostsCents).toBe(120_000);
    expect(result.options[1]?.leftAfterEnteredCostsCents).toBe(100_000);
    expect(result.answer).toBe(
      "In an average month, you'd have $1,200 left with Apartment A or $1,000 left with Apartment B after the costs you entered.",
    );
  });

  test("changing one option's payment leaves take-home pay unchanged", () => {
    const input = {
      ...example,
      options: [
        example.options[0],
        { ...example.options[1], monthlyPayment: "2800" },
      ] as const,
    };

    const result = evaluateHousing(input);

    expect(result.incomeCents).toBe(480_000);
    expect(result.options[0]?.leftAfterEnteredCostsCents).toBe(80_000);
    expect(result.options[1]?.leftAfterEnteredCostsCents).toBe(50_000);
    expect(input.options[1].monthlyPayment).toBe("2800");
    expect(result.difference?.narrative).toBe(
      "Apartment B costs $300 more per month and requires $1,500 more up front.",
    );
  });

  test("asks for commitments and does not treat a blank as zero", () => {
    const result = evaluateHousing({ ...example, commitmentsMonthly: "" });

    expect(result.status).toBe("partial");
    expect(result.answer).toBeNull();
    expect(result.options[0]?.leftAfterEnteredCostsCents).toBeNull();
    expect(result.missing).toContainEqual({
      path: "commitmentsMonthly",
      question: "Enter other monthly commitments, or enter 0 if there are none.",
    });
  });

  test("allows zero commitments", () => {
    const result = evaluateHousing({ ...example, commitmentsMonthly: "0" });

    expect(result.status).toBe("complete");
    expect(result.commitmentsCents).toBe(0);
    expect(result.options[0]?.leftAfterEnteredCostsCents).toBe(230_000);
  });

  test("shows when an option costs more than the entered income", () => {
    const result = evaluateHousing({
      ...example,
      options: [
        example.options[0],
        { ...example.options[1], monthlyPayment: "4000" },
      ] as const,
    });

    expect(result.options[1]?.leftAfterEnteredCostsCents).toBe(-70_000);
    expect(result.answer).toBe(
      "In a two-paycheck month, you'd have $800 left with Apartment A or be $700 over with Apartment B after the costs you entered.",
    );
  });

  test("says when twice-a-month pay makes both month views match", () => {
    const result = evaluateHousing({
      ...example,
      jobs: [{ id: "job-1", netPay: "2400", cadence: "semimonthly" }],
    });

    expect(result.incomeCents).toBe(480_000);
    expect(result.assumptions.join(" ")).toMatch(/24 paychecks/);
  });
});

describe("housing module boundary", () => {
  test("the calculator source does not import React, Next, or the network", () => {
    const source = readFileSync(new URL("./housing.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']react["']|from ["']next|node:http|fetch\(/);
  });
});
