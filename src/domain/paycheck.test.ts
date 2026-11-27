import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluatePaycheck } from "./paycheck";

const biweekly = {
  jobs: [{ id: "job-1", label: "Main job", netPay: "2400", cadence: "biweekly" as const }],
};

describe("evaluatePaycheck", () => {
  test("turns $2,400 every two weeks into a $4,800 pay month and a $5,200 average", () => {
    const result = evaluatePaycheck(biweekly);

    expect(result.status).toBe("complete");
    expect(result.jobs[0]?.paychecksPerYear).toBe(26);
    expect(result.jobs[0]?.ordinaryMonthCents).toBe(480_000);
    expect(result.jobs[0]?.averageMonthlyCents).toBe(520_000);
    expect(result.jobs[0]?.annualCents).toBe(6_240_000);
    expect(result.combined.ordinaryMonthLabel).toBe("Two-paycheck month");
    expect(result.combined.ordinaryMonthCents).toBe(480_000);
    expect(result.combined.averageMonthlyCents).toBe(520_000);
    expect(result.answer).toBe(
      "In a two-paycheck month, you take home $4,800. Across the year, that averages $5,200 a month.",
    );
    expect(result.explanation.join(" ")).toContain("26 paychecks");
    expect(result.explanation.join(" ")).toContain("24 paychecks");
    expect(result.scheduleComparison[0]?.biweekly.averageMonthlyCents).toBe(520_000);
    expect(result.scheduleComparison[0]?.semimonthly.paychecksPerYear).toBe(24);
    expect(result.scheduleComparison[0]?.semimonthly.averageMonthlyCents).toBe(480_000);
    expect(result.limitations.join(" ")).toMatch(/does not estimate taxes/i);
  });

  test("shows that twice a month makes the average match a two-paycheck month", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "2400", cadence: "semimonthly" }],
    });

    expect(result.jobs[0]?.paychecksPerYear).toBe(24);
    expect(result.combined.ordinaryMonthCents).toBe(480_000);
    expect(result.combined.averageMonthlyCents).toBe(480_000);
    expect(result.answer).toBe(
      "In a two-paycheck month, you take home $4,800. Because twice a month is 24 paychecks a year, the monthly average is also $4,800.",
    );
  });

  test("counts four paychecks in an ordinary week-based month", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "2400", cadence: "weekly" }],
    });

    expect(result.jobs[0]?.paychecksPerYear).toBe(52);
    expect(result.combined.ordinaryMonthCents).toBe(960_000);
    expect(result.combined.averageMonthlyCents).toBe(1_040_000);
    expect(result.answer).toContain("$9,600");
    expect(result.answer).toContain("$10,400");
  });

  test("keeps a monthly paycheck equal to the monthly average", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "2400", cadence: "monthly" }],
    });

    expect(result.jobs[0]?.paychecksPerYear).toBe(12);
    expect(result.combined.ordinaryMonthCents).toBe(240_000);
    expect(result.combined.averageMonthlyCents).toBe(240_000);
  });

  test("adds jobs with different pay schedules", () => {
    const result = evaluatePaycheck({
      jobs: [
        { id: "job-1", label: "Main job", netPay: "2400", cadence: "biweekly" },
        { id: "job-2", label: "Weekend job", netPay: "1000", cadence: "monthly" },
      ],
    });

    expect(result.combined.ordinaryMonthLabel).toBe("Typical pay month");
    expect(result.combined.ordinaryMonthCents).toBe(580_000);
    expect(result.combined.averageMonthlyCents).toBe(620_000);
    expect(result.answer).toBe(
      "In a typical pay month, you take home $5,800. Across the year, that averages $6,200 a month.",
    );
  });

  test("asks for a payday amount and does not treat a blank as zero", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "", cadence: "biweekly" }],
    });

    expect(result.status).toBe("partial");
    expect(result.answer).toBeNull();
    expect(result.combined.averageMonthlyCents).toBeNull();
    expect(result.missing).toContainEqual({
      path: "jobs.0.netPay",
      question: "Enter the amount you take home each payday",
    });
  });

  test("accepts a zero paycheck as a real amount", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "0", cadence: "biweekly" }],
    });

    expect(result.status).toBe("complete");
    expect(result.combined.ordinaryMonthCents).toBe(0);
    expect(result.missing).toEqual([]);
  });

  test("explains 26 and 24 when the pay frequency is unsure", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "2400", cadence: "unsure" }],
    });

    expect(result.status).toBe("partial");
    expect(result.answer).toBeNull();
    expect(result.missing).toContainEqual({
      path: "jobs.0.cadence",
      question: "Choose how often you are paid",
    });
    expect(result.explanation.join(" ")).toContain("26 paychecks");
    expect(result.explanation.join(" ")).toContain("24 paychecks");
    expect(result.scheduleComparison[0]?.biweekly.averageMonthlyCents).toBe(520_000);
    expect(result.scheduleComparison[0]?.semimonthly.averageMonthlyCents).toBe(480_000);
  });

  test("rounds the monthly average half up to the nearest cent", () => {
    const result = evaluatePaycheck({
      jobs: [{ id: "job-1", netPay: "1000.01", cadence: "biweekly" }],
    });

    expect(result.jobs[0]?.averageMonthlyCents).toBe(216_669);
  });
});

describe("paycheck module boundary", () => {
  test("the calculator source does not import React, Next, or the network", () => {
    const source = readFileSync(new URL("./paycheck.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']react["']|from ["']next|node:http|fetch\(/);
  });
});
