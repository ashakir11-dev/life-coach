import { isCadence } from "./cadence";
import { formatUsd } from "./money";
import { summarizeTakeHome, type JobInput, type TakeHomeSummary } from "./take-home";

export type PaycheckResult = TakeHomeSummary & {
  answer: string | null;
  assumptions: string[];
  limitations: string[];
  sources: { title: string; note: string }[];
};

function monthLead(label: string): string {
  if (label === "Pay month") return "In a pay month";
  return `In a ${label.toLowerCase()}`;
}

export function evaluatePaycheck(input: { jobs: JobInput[] }): PaycheckResult {
  const summary = summarizeTakeHome(input.jobs);
  const ordinary = summary.combined.ordinaryMonthCents;
  const average = summary.combined.averageMonthlyCents;
  let answer: string | null = null;

  if (ordinary != null && average != null) {
    const lead = `${monthLead(summary.combined.ordinaryMonthLabel)}, you take home ${formatUsd(ordinary)}.`;
    const cadences = summary.jobs.map((job) => job.cadence);
    if (cadences.every((cadence) => cadence === "monthly")) {
      answer = `${lead} Because you are paid once a month, the monthly average is also ${formatUsd(average)}.`;
    } else if (cadences.every((cadence) => cadence === "semimonthly")) {
      answer = `${lead} Because twice a month is 24 paychecks a year, the monthly average is also ${formatUsd(average)}.`;
    } else {
      answer = `${lead} Across the year, that averages ${formatUsd(average)} a month.`;
    }
  }

  const assumptions = summary.jobs.flatMap((job) => {
    if (job.netPayCents == null || !isCadence(job.cadence ?? undefined) || job.paychecksPerYear == null) {
      return [];
    }
    return [
      `${job.label}: ${formatUsd(job.netPayCents)} ${job.cadence === "biweekly" ? "every two weeks" : job.cadence === "semimonthly" ? "twice a month" : job.cadence === "weekly" ? "every week" : "once a month"}.`,
    ];
  });

  return {
    ...summary,
    answer,
    assumptions,
    limitations: [
      "Dayfolio uses the take-home amount you entered and does not estimate taxes or withholdings.",
    ],
    sources: [
      {
        title: "Paycheck count",
        note: "Every two weeks is 26 paychecks in a year. Twice a month is 24. Enter the take-home amount from your pay stub.",
      },
    ],
  };
}
