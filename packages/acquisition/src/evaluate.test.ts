import { describe, expect, it } from "vitest";
import {
  describeAcquisitionChanges,
  evaluateAcquisition,
} from "./index";

const asOf = { asOf: "2026-11-27" };

const threePaths = {
  itemLabel: "Used sedan",
  termMonths: 36,
  currency: "USD" as const,
  lease: {
    monthlyPayment: "350.00",
    dueAtSigning: "2000.00",
    refundablePortion: "400.00",
  },
  finance: {
    purchasePrice: "28000.00",
    downPayment: "2000.00",
    feesAtSigning: "500.00",
    aprPercent: "6",
  },
  cash: {
    amountDue: "27500.00",
  },
};

describe("lease, finance, and cash over the same term", () => {
  it("compares upfront cash, monthly cash, and cash over the shared term", () => {
    const result = evaluateAcquisition(threePaths, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.toolId).toBe("lease-purchase-finance");
    expect(result.termMonths).toBe(36);
    expect(result.educate.summary.length).toBeGreaterThan(40);
    expect(result.educate.paths.map((path) => path.id)).toEqual([
      "lease",
      "finance",
      "cash",
    ]);
    expect(result.limitations.join(" ")).toMatch(/insurance/i);
    expect(result.limitations.join(" ")).toMatch(/not a wealth comparison/i);
    expect(result.educate.sources.map((source) => source.url)).toContain(
      "https://www.consumerfinance.gov/ask-cfpb/what-should-i-know-about-leasing-versus-buying-a-car-en-815/",
    );

    const lease = result.paths.find((path) => path.id === "lease");
    const finance = result.paths.find((path) => path.id === "finance");
    const cash = result.paths.find((path) => path.id === "cash");
    expect(lease?.upfront?.cents).toBe(200000);
    expect(lease?.monthly?.cents).toBe(35000);
    expect(lease?.cashOverTerm?.cents).toBe(1_460_000);
    expect(lease?.notes.join(" ")).toMatch(/refundable/i);
    expect(finance?.upfront?.cents).toBe(250000);
    expect(finance?.monthly?.cents).toBe(79097);
    expect(finance?.cashOverTerm?.cents).toBe(3_097_492);
    expect(finance?.origins.monthly).toBe("calculated");
    expect(cash?.upfront?.cents).toBe(2_750_000);
    expect(cash?.monthly?.cents).toBe(0);
    expect(cash?.cashOverTerm?.cents).toBe(2_750_000);
    expect(cash?.origins.monthly).toBe("assumption");

    expect(result.compare?.rows.map((row) => row.id)).toEqual([
      "upfront",
      "monthly",
      "cash-over-term",
    ]);
    expect(result.compare?.rows[0]?.cells.lease).toBe("$2,000.00");
    expect(result.compare?.rows[1]?.cells.finance).toBe("$790.97");
    expect(result.compare?.rows[1]?.cells.cash).toBe("$0.00");
    expect(result.compare?.narrative).toMatch(/36 months/);
    expect(result.compare?.narrative).not.toMatch(/best deal|wealth|equity/i);
    expect(result.sandbox.math.find((item) => item.pathId === "finance")?.steps.join(" ")).toMatch(
      /half up/i,
    );
  });

  it("uses a lender quote without inventing a rate", () => {
    const result = evaluateAcquisition(
      {
        termMonths: 36,
        finance: {
          quotedMonthlyPayment: "400.00",
          quoteDueAtSigning: "1500.00",
        },
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finance = result.paths.find((path) => path.id === "finance");
    expect(finance?.monthly?.cents).toBe(40000);
    expect(finance?.upfront?.cents).toBe(150000);
    expect(finance?.cashOverTerm?.cents).toBe(1_590_000);
    expect(finance?.origins.monthly).toBe("entered");
    expect(
      result.sandbox.math.find((item) => item.pathId === "finance")?.steps.join(" "),
    ).not.toMatch(/annual rate/i);
  });

  it("asks for a down payment instead of treating a blank as zero", () => {
    const result = evaluateAcquisition(
      {
        termMonths: 36,
        finance: {
          purchasePrice: "28000.00",
          aprPercent: "6",
        },
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paths.find((path) => path.id === "finance")?.complete).toBe(false);
    expect(result.sandbox.missing.map((item) => item.question).join(" ")).toMatch(
      /down payment/i,
    );
    expect(result.compare).toBeNull();
  });

  it("counts a blank fee as zero only when that assumption is visible", () => {
    const result = evaluateAcquisition(
      {
        termMonths: 24,
        finance: {
          purchasePrice: "10000.00",
          downPayment: "0.00",
          aprPercent: "6.5",
        },
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finance = result.paths.find((path) => path.id === "finance");
    expect(finance?.upfront?.cents).toBe(0);
    expect(finance?.monthly?.cents).toBe(44546);
    expect(finance?.origins.feesAtSigning).toBe("assumption");
    expect(result.educate.assumptions.join(" ")).toMatch(/fees left blank/i);
  });

  it("divides a zero-rate balance into equal monthly cents", () => {
    const result = evaluateAcquisition(
      {
        termMonths: 12,
        finance: {
          purchasePrice: "1200.00",
          downPayment: "0.00",
          feesAtSigning: "0.00",
          feesFinanced: "0.00",
          aprPercent: "0",
        },
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paths.find((path) => path.id === "finance")?.monthly?.cents).toBe(10000);
  });

  it("returns one path and the educate block when the other paths are blank", () => {
    const result = evaluateAcquisition(
      {
        itemLabel: "Laptop",
        cash: { amountDue: "900.00" },
      },
      asOf,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paths.filter((path) => path.complete).map((path) => path.id)).toEqual([
      "cash",
    ]);
    expect(result.compare).toBeNull();
    expect(result.educate.paths).toHaveLength(3);
    expect(result.sandbox.missing.map((item) => item.path)).toEqual(
      expect.arrayContaining(["termMonths", "lease", "finance"]),
    );
  });

  it("rejects mixed finance inputs, bad refundable cash, and identification fields", () => {
    const mixed = evaluateAcquisition(
      {
        termMonths: 36,
        finance: {
          quotedMonthlyPayment: "400.00",
          purchasePrice: "28000.00",
          downPayment: "2000.00",
          aprPercent: "6",
        },
      },
      asOf,
    );
    expect(mixed.ok).toBe(false);
    if (mixed.ok) return;
    expect(mixed.errors.map((error) => error.message).join(" ")).toMatch(/quote or an estimate/i);

    const refund = evaluateAcquisition(
      {
        termMonths: 36,
        lease: {
          monthlyPayment: "350.00",
          dueAtSigning: "2000.00",
          refundablePortion: "2500.00",
        },
      },
      asOf,
    );
    expect(refund.ok).toBe(false);

    const ssn = evaluateAcquisition({ ssn: "123-45-6789", termMonths: 36 }, asOf);
    expect(ssn.ok).toBe(false);
    if (ssn.ok) return;
    expect(JSON.stringify(ssn)).not.toContain("123-45-6789");
    expect(ssn.errors.map((error) => error.message).join(" ")).toMatch(
      /identification numbers/i,
    );
  });

  it("names the finance inputs that moved and leaves lease and cash unchanged", () => {
    const after = {
      ...threePaths,
      finance: { ...threePaths.finance, downPayment: "3000.00" },
    };
    const effect = describeAcquisitionChanges(threePaths, after, asOf);
    expect(effect.changedInputs).toContain("Finance down payment");
    expect(effect.affected.join(" ")).toMatch(/Finance upfront/);
    expect(effect.affected.join(" ")).toMatch(/Finance monthly/);
    expect(effect.unchanged).toEqual(expect.arrayContaining(["Lease", "Pay cash"]));

    const updated = evaluateAcquisition(after, asOf);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.paths.find((path) => path.id === "finance")?.monthly?.cents).toBe(76055);
    expect(updated.paths.find((path) => path.id === "finance")?.upfront?.cents).toBe(350000);
    expect(updated.paths.find((path) => path.id === "lease")?.monthly?.cents).toBe(35000);
  });

  it("does not change the cash figures when the as-of date changes", () => {
    const first = evaluateAcquisition(threePaths, { asOf: "2026-11-27" });
    const second = evaluateAcquisition(threePaths, { asOf: "2027-01-02" });
    expect(first).toEqual(second);
  });
});
