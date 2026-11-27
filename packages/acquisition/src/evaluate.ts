import { levelPaymentCents, moneyFromCents, parseApr, parseMoneyCents } from "./money";
import {
  acquisitionInputSchema,
  rejectSensitiveKeys,
  type AcquisitionInput,
  type FieldError,
} from "./schema";

export const TOOL_ID = "lease-purchase-finance";
export const TOOL_VERSION = "1.0.0";

const CFPB_LEASE_URL =
  "https://www.consumerfinance.gov/ask-cfpb/what-should-i-know-about-leasing-versus-buying-a-car-en-815/";

const LIMITATIONS = [
  "Insurance, fuel, maintenance, and any taxes or fees you did not enter are not included.",
  "This is cash you pay up front and each month. It is not a wealth comparison.",
  "A calculated payment divides the rate by 12 and rounds half up to the cent. It is not the APR disclosure a lender must give you.",
  "Lease amounts are the quote you entered. This tool does not estimate a lease payment.",
];

export type Origin = "entered" | "calculated" | "assumption";

export type PathId = "lease" | "finance" | "cash";

export type PathResult = {
  id: PathId;
  name: string;
  complete: boolean;
  upfront?: ReturnType<typeof moneyFromCents>;
  monthly?: ReturnType<typeof moneyFromCents>;
  cashOverTerm?: ReturnType<typeof moneyFromCents>;
  origins: Record<string, Origin>;
  notes: string[];
};

export type AcquisitionSuccess = {
  ok: true;
  toolId: typeof TOOL_ID;
  toolVersion: typeof TOOL_VERSION;
  itemLabel: string | null;
  termMonths: number | null;
  currency: "USD";
  educate: {
    summary: string;
    paths: { id: PathId; title: string; explanation: string }[];
    assumptions: string[];
    limitations: string[];
    sources: { title: string; url: string; note: string }[];
  };
  sandbox: {
    math: { pathId: PathId; steps: string[] }[];
    missing: { path: string; question: string }[];
  };
  compare: null | {
    periodLabel: string;
    columns: { id: PathId; name: string }[];
    rows: { id: string; label: string; cells: Record<string, string> }[];
    narrative: string;
  };
  paths: PathResult[];
  limitations: string[];
};

export type AcquisitionFailure = {
  ok: false;
  toolId: typeof TOOL_ID;
  toolVersion: typeof TOOL_VERSION;
  errors: FieldError[];
};

export type AcquisitionEvaluation = AcquisitionSuccess | AcquisitionFailure;

const EDUCATE_PATHS: AcquisitionSuccess["educate"]["paths"] = [
  {
    id: "lease",
    title: "Lease",
    explanation:
      "You pay to use the item during the term, then you return it unless the contract has a separate buyout. Enter the monthly payment and the amount due at signing from the quote.",
  },
  {
    id: "finance",
    title: "Finance",
    explanation:
      "You borrow part of the price and repay it over the term. Enter a lender quote, or estimate the payment from the price, down payment, and rate.",
  },
  {
    id: "cash",
    title: "Pay cash",
    explanation:
      "You pay the full amount now. The monthly payment for the purchase is $0. The cash is spent up front.",
  },
];

export function evaluateAcquisition(
  raw: unknown,
  context: { asOf: string },
): AcquisitionEvaluation {
  if (!isIsoDate(context?.asOf)) {
    return failure([
      { path: "asOf", message: "Enter the date for this check as YYYY-MM-DD." },
    ]);
  }
  const sensitive = rejectSensitiveKeys(raw);
  if (sensitive) return failure([sensitive]);
  const parsed = acquisitionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "input",
        message: issue.message,
      })),
    );
  }
  return succeed(parsed.data);
}

function succeed(input: AcquisitionInput): AcquisitionEvaluation {
  const errors: FieldError[] = [];
  const missing: { path: string; question: string }[] = [];
  const assumptions = [
    "The term you enter applies to every path, so the totals cover the same period.",
  ];
  const paths: PathResult[] = [];
  const math: { pathId: PathId; steps: string[] }[] = [];
  let blankFee = false;

  if (input.termMonths === undefined) {
    missing.push({
      path: "termMonths",
      question: "How many months should the comparison cover? Lease and finance use that same term.",
    });
  }

  if (!input.lease) {
    missing.push({
      path: "lease",
      question: "What is the lease monthly payment and the amount due at signing?",
    });
  } else {
    const lease = buildLease(input, missing, errors);
    if (lease) {
      paths.push(lease.path);
      math.push({ pathId: "lease", steps: lease.steps });
    }
  }

  if (!input.finance) {
    missing.push({
      path: "finance",
      question:
        "Do you have a finance quote, or should we estimate it from the price, down payment, and rate?",
    });
  } else {
    const finance = buildFinance(input, missing, errors, () => {
      blankFee = true;
    });
    if (finance) {
      paths.push(finance.path);
      math.push({ pathId: "finance", steps: finance.steps });
    }
  }

  if (!input.cash) {
    missing.push({
      path: "cash",
      question: "What amount would you pay up front if you bought it with cash?",
    });
  } else if (input.cash.amountDue) {
    const upfront = moneyFromCents(parseMoneyCents(input.cash.amountDue));
    const path: PathResult = {
      id: "cash",
      name: "Pay cash",
      complete: true,
      upfront,
      monthly: moneyFromCents(0n),
      cashOverTerm: upfront,
      origins: { upfront: "entered", monthly: "assumption", cashOverTerm: "calculated" },
      notes: ["Monthly payment is $0 because paying cash does not spread the price across months."],
    };
    paths.push(path);
    math.push({
      pathId: "cash",
      steps: [
        `Upfront cash is the amount due you entered: ${upfront.formatted}.`,
        "Monthly payment for the purchase is $0.00.",
        `Cash over the term counts that upfront amount once: ${upfront.formatted}.`,
      ],
    });
  } else {
    missing.push({
      path: "cash.amountDue",
      question: "What amount would you pay up front if you bought it with cash?",
    });
  }

  if (errors.length > 0) return failure(errors);
  if (blankFee) {
    assumptions.push("Fees left blank are counted as $0. Enter a fee if the quote includes one.");
  }

  const complete = paths.filter((path) => path.complete && path.cashOverTerm && path.monthly && path.upfront);
  const compare =
    input.termMonths && complete.length >= 2
      ? buildCompare(complete, input.termMonths)
      : null;

  return {
    ok: true,
    toolId: TOOL_ID,
    toolVersion: TOOL_VERSION,
    itemLabel: input.itemLabel ?? null,
    termMonths: input.termMonths ?? null,
    currency: "USD",
    educate: {
      summary:
        "Compare the cash due at signing and the monthly payment for the same item over one term. You can lease it, finance it, or pay cash.",
      paths: EDUCATE_PATHS,
      assumptions,
      limitations: LIMITATIONS,
      sources: [
        {
          title: "What should I know about leasing versus buying a car?",
          url: CFPB_LEASE_URL,
          note: "Consumer Financial Protection Bureau, last reviewed September 12, 2023. The cash totals here are calculated from the amounts you enter.",
        },
      ],
    },
    sandbox: { math, missing },
    compare,
    paths,
    limitations: LIMITATIONS,
  };
}

function buildLease(
  input: AcquisitionInput,
  missing: { path: string; question: string }[],
  errors: FieldError[],
): { path: PathResult; steps: string[] } | null {
  const lease = input.lease;
  if (!lease) return null;
  if (!lease.monthlyPayment) {
    missing.push({
      path: "lease.monthlyPayment",
      question: "What is the lease monthly payment?",
    });
  }
  if (!lease.dueAtSigning) {
    missing.push({
      path: "lease.dueAtSigning",
      question: "What is the lease amount due at signing?",
    });
  }
  if (!lease.monthlyPayment || !lease.dueAtSigning) {
    return {
      path: {
        id: "lease",
        name: "Lease",
        complete: false,
        origins: {},
        notes: [],
      },
      steps: [],
    };
  }
  const monthly = parseMoneyCents(lease.monthlyPayment);
  const upfront = parseMoneyCents(lease.dueAtSigning);
  const notes: string[] = [];
  if (lease.refundablePortion) {
    const refundable = parseMoneyCents(lease.refundablePortion);
    if (refundable > upfront) {
      errors.push({
        path: "lease.refundablePortion",
        message: "The refundable portion cannot be more than the amount due at signing.",
      });
      return null;
    }
    notes.push(
      `Includes ${moneyFromCents(refundable).formatted} marked refundable. You still need that cash at signing, so it stays in the upfront total.`,
    );
  }
  const term = input.termMonths;
  const over = term === undefined ? undefined : upfront + monthly * BigInt(term);
  const upfrontMoney = moneyFromCents(upfront);
  const monthlyMoney = moneyFromCents(monthly);
  const steps = [
    `Upfront cash is the amount due at signing you entered: ${upfrontMoney.formatted}.`,
    ...notes,
    `Monthly payment is the quote you entered: ${monthlyMoney.formatted}.`,
  ];
  if (term !== undefined && over !== undefined) {
    steps.push(
      `Cash over ${term} months = upfront + monthly × ${term} = ${moneyFromCents(over).formatted}.`,
    );
  }
  return {
    path: {
      id: "lease",
      name: "Lease",
      complete: term !== undefined,
      upfront: upfrontMoney,
      monthly: monthlyMoney,
      cashOverTerm: over === undefined ? undefined : moneyFromCents(over),
      origins: {
        upfront: "entered",
        monthly: "entered",
        ...(over === undefined ? {} : { cashOverTerm: "calculated" as const }),
      },
      notes,
    },
    steps,
  };
}

function buildFinance(
  input: AcquisitionInput,
  missing: { path: string; question: string }[],
  errors: FieldError[],
  onBlankFee: () => void,
): { path: PathResult; steps: string[] } | null {
  const finance = input.finance;
  if (!finance) return null;
  const hasQuote =
    finance.quotedMonthlyPayment !== undefined || finance.quoteDueAtSigning !== undefined;
  const hasCalculate =
    finance.purchasePrice !== undefined ||
    finance.downPayment !== undefined ||
    finance.aprPercent !== undefined ||
    finance.feesAtSigning !== undefined ||
    finance.feesFinanced !== undefined;
  if (hasQuote && hasCalculate) {
    errors.push({
      path: "finance",
      message: "Choose a lender quote or an estimate. Entering both would mix two finance prices.",
    });
    return null;
  }
  if (!hasQuote && !hasCalculate) {
    missing.push({
      path: "finance",
      question:
        "Do you have a finance quote, or should we estimate it from the price, down payment, and rate?",
    });
    return {
      path: { id: "finance", name: "Finance", complete: false, origins: {}, notes: [] },
      steps: [],
    };
  }
  if (hasQuote) return buildFinanceQuote(input, missing);
  return buildFinanceEstimate(input, missing, errors, onBlankFee);
}

function buildFinanceQuote(
  input: AcquisitionInput,
  missing: { path: string; question: string }[],
): { path: PathResult; steps: string[] } {
  const finance = input.finance!;
  if (!finance.quotedMonthlyPayment) {
    missing.push({
      path: "finance.quotedMonthlyPayment",
      question: "What monthly payment does the finance quote show?",
    });
  }
  if (!finance.quoteDueAtSigning) {
    missing.push({
      path: "finance.quoteDueAtSigning",
      question: "What amount is due at signing on the finance quote?",
    });
  }
  if (!finance.quotedMonthlyPayment || !finance.quoteDueAtSigning) {
    return {
      path: { id: "finance", name: "Finance", complete: false, origins: {}, notes: [] },
      steps: [],
    };
  }
  const monthly = parseMoneyCents(finance.quotedMonthlyPayment);
  const upfront = parseMoneyCents(finance.quoteDueAtSigning);
  const term = input.termMonths;
  const over = term === undefined ? undefined : upfront + monthly * BigInt(term);
  const monthlyMoney = moneyFromCents(monthly);
  const upfrontMoney = moneyFromCents(upfront);
  const steps = [
    `Monthly payment is the quote you entered: ${monthlyMoney.formatted}.`,
    `Upfront cash is the quote due at signing: ${upfrontMoney.formatted}.`,
  ];
  if (term !== undefined && over !== undefined) {
    steps.push(
      `Cash over ${term} months = upfront + monthly × ${term} = ${moneyFromCents(over).formatted}.`,
    );
  }
  return {
    path: {
      id: "finance",
      name: "Finance",
      complete: term !== undefined,
      upfront: upfrontMoney,
      monthly: monthlyMoney,
      cashOverTerm: over === undefined ? undefined : moneyFromCents(over),
      origins: {
        upfront: "entered",
        monthly: "entered",
        ...(over === undefined ? {} : { cashOverTerm: "calculated" as const }),
      },
      notes: ["Finance amounts come from the quote you entered."],
    },
    steps,
  };
}

function buildFinanceEstimate(
  input: AcquisitionInput,
  missing: { path: string; question: string }[],
  errors: FieldError[],
  onBlankFee: () => void,
): { path: PathResult; steps: string[] } | null {
  const finance = input.finance!;
  if (!finance.purchasePrice) {
    missing.push({
      path: "finance.purchasePrice",
      question: "What is the price you would finance?",
    });
  }
  if (finance.downPayment === undefined) {
    missing.push({
      path: "finance.downPayment",
      question:
        "What is the finance down payment? Enter 0.00 if there is none. A blank down payment is not treated as zero.",
    });
  }
  if (!finance.aprPercent) {
    missing.push({
      path: "finance.aprPercent",
      question: "What annual rate should the estimate use? Enter 0 if the plan has no interest.",
    });
  }
  if (!finance.purchasePrice || finance.downPayment === undefined || !finance.aprPercent) {
    return {
      path: { id: "finance", name: "Finance", complete: false, origins: {}, notes: [] },
      steps: [],
    };
  }
  const price = parseMoneyCents(finance.purchasePrice);
  const down = parseMoneyCents(finance.downPayment);
  const feesAtSigning =
    finance.feesAtSigning === undefined ? 0n : parseMoneyCents(finance.feesAtSigning);
  const feesFinanced =
    finance.feesFinanced === undefined ? 0n : parseMoneyCents(finance.feesFinanced);
  if (finance.feesAtSigning === undefined || finance.feesFinanced === undefined) onBlankFee();
  const financed = price - down + feesFinanced;
  if (financed < 0n) {
    errors.push({
      path: "finance.downPayment",
      message: "The down payment is larger than the price plus fees added to the loan.",
    });
    return null;
  }
  const upfront = down + feesAtSigning;
  const origins: Record<string, Origin> = {
    purchasePrice: "entered",
    downPayment: "entered",
    feesAtSigning: finance.feesAtSigning === undefined ? "assumption" : "entered",
    feesFinanced: finance.feesFinanced === undefined ? "assumption" : "entered",
    upfront: "calculated",
  };
  const notes = ["The monthly payment is an estimate from the price, down payment, and rate you entered."];
  const term = input.termMonths;
  if (term === undefined) {
    return {
      path: {
        id: "finance",
        name: "Finance",
        complete: false,
        upfront: moneyFromCents(upfront),
        origins,
        notes,
      },
      steps: [],
    };
  }
  const payment = levelPaymentCents(financed, parseApr(finance.aprPercent), term);
  const over = upfront + payment * BigInt(term);
  const steps = [
    `Amount financed = price − down payment + fees financed = ${moneyFromCents(financed).formatted}.`,
    `Upfront cash = down payment + fees at signing = ${moneyFromCents(upfront).formatted}.`,
    `Monthly rate = ${finance.aprPercent}% ÷ 12.`,
    `Level payment rounded half up to the cent = ${moneyFromCents(payment).formatted}.`,
    `Cash over ${term} months = upfront + monthly × ${term} = ${moneyFromCents(over).formatted}.`,
  ];
  return {
    path: {
      id: "finance",
      name: "Finance",
      complete: true,
      upfront: moneyFromCents(upfront),
      monthly: moneyFromCents(payment),
      cashOverTerm: moneyFromCents(over),
      origins: { ...origins, monthly: "calculated", cashOverTerm: "calculated" },
      notes,
    },
    steps,
  };
}

function buildCompare(paths: PathResult[], termMonths: number): AcquisitionSuccess["compare"] {
  const columns = paths.map((path) => ({ id: path.id, name: path.name }));
  const cell = (path: PathResult, key: "upfront" | "monthly" | "cashOverTerm") =>
    path[key]?.formatted ?? "";
  const rows = [
    {
      id: "upfront",
      label: "Upfront cash",
      cells: Object.fromEntries(paths.map((path) => [path.id, cell(path, "upfront")])),
    },
    {
      id: "monthly",
      label: "Monthly payment",
      cells: Object.fromEntries(paths.map((path) => [path.id, cell(path, "monthly")])),
    },
    {
      id: "cash-over-term",
      label: `Cash over ${termMonths} months`,
      cells: Object.fromEntries(paths.map((path) => [path.id, cell(path, "cashOverTerm")])),
    },
  ];
  const richestUpfront = [...paths].sort(
    (a, b) => (b.upfront?.cents ?? 0) - (a.upfront?.cents ?? 0),
  )[0];
  const lowestTerm = [...paths].sort(
    (a, b) => (a.cashOverTerm?.cents ?? 0) - (b.cashOverTerm?.cents ?? 0),
  )[0];
  return {
    periodLabel: `${termMonths} months`,
    columns,
    rows,
    narrative: `Over ${termMonths} months, ${richestUpfront?.name ?? "One path"} has the highest upfront cash at ${richestUpfront?.upfront?.formatted ?? ""}. ${lowestTerm?.name ?? "One path"} has the lowest cash over the term at ${lowestTerm?.cashOverTerm?.formatted ?? ""}. This compares cash you pay for the same item and term.`,
  };
}

function failure(errors: FieldError[]): AcquisitionFailure {
  return { ok: false, toolId: TOOL_ID, toolVersion: TOOL_VERSION, errors };
}

function isIsoDate(value: string | undefined): boolean {
  if (!value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (lengths[month] ?? 0);
}
