import { isCadence } from "./cadence";
import { formatUsd, parseUsd } from "./money";
import { summarizeTakeHome, type JobInput, type MissingInput } from "./take-home";

export type HousingOptionInput = {
  id: string;
  name: string;
  monthlyPayment?: string;
  upfrontCash?: string;
};

export type HousingInput = {
  jobs: JobInput[];
  basis: "ordinary-month" | "monthly-average";
  commitmentsMonthly?: string;
  options: readonly [HousingOptionInput, HousingOptionInput];
};

export type HousingOptionResult = {
  id: string;
  name: string;
  monthlyPaymentCents: number | null;
  upfrontCashCents: number | null;
  leftAfterEnteredCostsCents: number | null;
};

export type HousingResult = {
  status: "complete" | "partial";
  missing: MissingInput[];
  answer: string | null;
  basis: HousingInput["basis"];
  basisLabel: string;
  incomeCents: number | null;
  commitmentsCents: number | null;
  options: [HousingOptionResult, HousingOptionResult];
  difference: {
    monthlyPaymentDeltaCents: number;
    upfrontDeltaCents: number;
    narrative: string;
  } | null;
  calculation: string[];
  assumptions: string[];
  limitations: string[];
  sources: { title: string; note: string }[];
  pay: {
    ordinaryMonthCents: number | null;
    averageMonthlyCents: number | null;
    ordinaryMonthLabel: string;
  };
};

const LIMITATIONS = [
  "Food, utilities and any other costs you left out still need to come from that amount.",
  "This is a cash-flow comparison of the amounts you entered. It is not a rent-versus-buy or wealth comparison.",
];

function moneyField(
  raw: string | undefined,
  path: string,
  emptyQuestion: string,
  invalidQuestion: string,
  missing: MissingInput[],
): number | null {
  const parsed = parseUsd(raw);
  if (!parsed.ok && parsed.reason === "empty") {
    missing.push({ path, question: emptyQuestion });
    return null;
  }
  if (!parsed.ok) {
    missing.push({ path, question: invalidQuestion });
    return null;
  }
  return parsed.cents;
}

function optionPhrase(name: string, leftCents: number, includeHave: boolean): string {
  if (leftCents < 0) {
    const amount = formatUsd(Math.abs(leftCents));
    return includeHave ? `be ${amount} over with ${name}` : `${amount} over with ${name}`;
  }
  const amount = formatUsd(leftCents);
  return includeHave ? `have ${amount} left with ${name}` : `${amount} left with ${name}`;
}

function buildAnswer(
  opening: string,
  first: HousingOptionResult,
  second: HousingOptionResult,
): string | null {
  if (first.leftAfterEnteredCostsCents == null || second.leftAfterEnteredCostsCents == null) return null;
  const firstPositive = first.leftAfterEnteredCostsCents >= 0;
  const secondPositive = second.leftAfterEnteredCostsCents >= 0;
  const firstPhrase = optionPhrase(first.name, first.leftAfterEnteredCostsCents, true);
  const secondPhrase = optionPhrase(
    second.name,
    second.leftAfterEnteredCostsCents,
    firstPositive !== secondPositive,
  );
  return `${opening}, you'd ${firstPhrase} or ${secondPhrase} after the costs you entered.`;
}

function buildNarrative(first: HousingOptionResult, second: HousingOptionResult): HousingResult["difference"] {
  if (
    first.monthlyPaymentCents == null ||
    second.monthlyPaymentCents == null ||
    first.upfrontCashCents == null ||
    second.upfrontCashCents == null
  ) {
    return null;
  }
  const monthly = second.monthlyPaymentCents - first.monthlyPaymentCents;
  const upfront = second.upfrontCashCents - first.upfrontCashCents;
  if (monthly === 0 && upfront === 0) {
    return {
      monthlyPaymentDeltaCents: 0,
      upfrontDeltaCents: 0,
      narrative: `${first.name} and ${second.name} cost the same each month and need the same cash up front.`,
    };
  }
  const monthlyText =
    monthly === 0
      ? "costs the same each month"
      : `costs ${formatUsd(Math.abs(monthly))} ${monthly > 0 ? "more" : "less"} per month`;
  const upfrontText =
    upfront === 0
      ? "requires the same cash up front"
      : `requires ${formatUsd(Math.abs(upfront))} ${upfront > 0 ? "more" : "less"} up front`;
  return {
    monthlyPaymentDeltaCents: monthly,
    upfrontDeltaCents: upfront,
    narrative: `${second.name} ${monthlyText} and ${upfrontText}.`,
  };
}

export function evaluateHousing(input: HousingInput): HousingResult {
  const summary = summarizeTakeHome([...input.jobs]);
  const missing = [...summary.missing];
  const incomeCents =
    input.basis === "monthly-average"
      ? summary.combined.averageMonthlyCents
      : summary.combined.ordinaryMonthCents;
  const basisLabel = input.basis === "monthly-average" ? "Monthly average" : summary.combined.ordinaryMonthLabel;

  const commitmentsCents = moneyField(
    input.commitmentsMonthly,
    "commitmentsMonthly",
    "Enter other monthly commitments, or enter 0 if there are none.",
    "Enter other monthly commitments in dollars, or enter 0 if there are none.",
    missing,
  );

  const options = input.options.map((option, index) => {
    const name = option.name.trim();
    if (!name) {
      missing.push({ path: `options.${index}.name`, question: "Name this option" });
    }
    const displayName = name || `Option ${index + 1}`;
    const monthlyPaymentCents = moneyField(
      option.monthlyPayment,
      `options.${index}.monthlyPayment`,
      `Enter the monthly housing payment for ${displayName}.`,
      `Enter the monthly housing payment for ${displayName} in dollars.`,
      missing,
    );
    const upfrontCashCents = moneyField(
      option.upfrontCash,
      `options.${index}.upfrontCash`,
      `Enter the cash needed up front for ${displayName}.`,
      `Enter the cash needed up front for ${displayName} in dollars.`,
      missing,
    );
    const leftAfterEnteredCostsCents =
      incomeCents == null || commitmentsCents == null || monthlyPaymentCents == null
        ? null
        : incomeCents - commitmentsCents - monthlyPaymentCents;
    return {
      id: option.id,
      name: displayName,
      monthlyPaymentCents,
      upfrontCashCents,
      leftAfterEnteredCostsCents,
    };
  }) as [HousingOptionResult, HousingOptionResult];

  const opening = input.basis === "monthly-average" ? "In an average month" : `In a ${basisLabel.toLowerCase()}`;
  const assumptions = summary.jobs.flatMap((job) => {
    if (job.netPayCents == null || !isCadence(job.cadence ?? undefined)) return [];
    const when =
      job.cadence === "biweekly"
        ? "every two weeks"
        : job.cadence === "semimonthly"
          ? "twice a month"
          : job.cadence === "weekly"
            ? "every week"
            : "once a month";
    return [`${formatUsd(job.netPayCents)} ${when}.`];
  });
  if (summary.jobs.length > 0 && summary.jobs.every((job) => job.cadence === "semimonthly")) {
    assumptions.push(
      "Twice a month is 24 paychecks a year, so a two-paycheck month and the monthly average are the same.",
    );
  }

  const calculation = [...summary.calculation];
  if (incomeCents != null && commitmentsCents != null) {
    for (const option of options) {
      if (option.monthlyPaymentCents == null || option.leftAfterEnteredCostsCents == null) continue;
      calculation.push(
        `${option.name}: ${formatUsd(incomeCents)} take-home − ${formatUsd(commitmentsCents)} other commitments − ${formatUsd(option.monthlyPaymentCents)} housing = ${formatUsd(option.leftAfterEnteredCostsCents)} left.`,
      );
    }
  }

  return {
    status: missing.length === 0 ? "complete" : "partial",
    missing,
    answer: buildAnswer(opening, options[0], options[1]),
    basis: input.basis,
    basisLabel,
    incomeCents,
    commitmentsCents,
    options,
    difference: buildNarrative(options[0], options[1]),
    calculation,
    assumptions,
    limitations: [...LIMITATIONS],
    sources: [
      {
        title: "Cash-flow comparison",
        note: "Monthly cash left and upfront cash use only the amounts entered here. Long-term ownership cost is a separate question.",
      },
    ],
    pay: {
      ordinaryMonthCents: summary.combined.ordinaryMonthCents,
      averageMonthlyCents: summary.combined.averageMonthlyCents,
      ordinaryMonthLabel: summary.combined.ordinaryMonthLabel,
    },
  };
}
