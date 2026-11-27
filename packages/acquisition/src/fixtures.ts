import type { AcquisitionInput } from "./schema";

export const sampleComparisonInput: AcquisitionInput = {
  itemLabel: "Used sedan",
  termMonths: 36,
  currency: "USD",
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

export const acquisitionManifest = {
  id: "lease-purchase-finance" as const,
  version: "1.0.0" as const,
  domain: "household-purchases",
  question: "What would leasing, financing, or paying cash cost up front and each month?",
  summary: "Monthly cash and upfront cash for the same item over one term.",
  aliases: [
    "lease vs buy",
    "lease or finance",
    "car payment",
    "auto loan",
    "pay cash for a car",
    "should I lease",
  ],
  targets: ["educate", "sandbox", "compare"] as const,
  geographicCoverage: "United States",
  actions: ["compare", "sandbox"] as const,
  factBindings: [] as const,
  units: ["USD", "month"] as const,
};
