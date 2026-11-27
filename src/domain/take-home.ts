import { CADENCES, SCHEDULE_EXPLANATION, isCadence, ordinaryMonthLabelFor, type Cadence, type PayCadence } from "./cadence";
import { divideRoundHalfUp, parseUsd } from "./money";

export type JobInput = {
  id: string;
  label?: string;
  netPay?: string;
  cadence?: PayCadence;
};

export type MissingInput = {
  path: string;
  question: string;
};

export type ScheduleSide = {
  paychecksPerYear: 26 | 24;
  ordinaryMonthCents: number;
  averageMonthlyCents: number;
};

export type ScheduleComparison = {
  jobId: string;
  jobLabel: string;
  paydayCents: number;
  yourCadence: Cadence | null;
  biweekly: ScheduleSide;
  semimonthly: ScheduleSide;
};

export type JobSummary = {
  id: string;
  label: string;
  cadence: PayCadence | null;
  netPayCents: number | null;
  paychecksPerYear: number | null;
  ordinaryMonthPaycheckCount: number | null;
  ordinaryMonthCents: number | null;
  averageMonthlyCents: number | null;
  annualCents: number | null;
};

export type TakeHomeSummary = {
  status: "complete" | "partial";
  missing: MissingInput[];
  jobs: JobSummary[];
  combined: {
    ordinaryMonthCents: number | null;
    averageMonthlyCents: number | null;
    annualCents: number | null;
    ordinaryMonthLabel: string;
  };
  scheduleComparison: ScheduleComparison[];
  explanation: string[];
  calculation: string[];
};

function jobLabel(job: JobInput, index: number): string {
  const label = job.label?.trim();
  return label ? label : `Paycheck ${index + 1}`;
}

function scheduleFor(paydayCents: number, cadence: "biweekly" | "semimonthly"): ScheduleSide {
  const info = CADENCES[cadence];
  return {
    paychecksPerYear: cadence === "biweekly" ? 26 : 24,
    ordinaryMonthCents: paydayCents * info.ordinaryPaychecks,
    averageMonthlyCents: divideRoundHalfUp(paydayCents * info.paychecksPerYear, 12),
  };
}

export function summarizeTakeHome(jobs: JobInput[]): TakeHomeSummary {
  const missing: MissingInput[] = [];
  const summaries: JobSummary[] = [];
  const scheduleComparison: ScheduleComparison[] = [];
  const calculation: string[] = [];

  if (jobs.length === 0) {
    missing.push({ path: "jobs", question: "Add at least one paycheck." });
  }

  jobs.forEach((job, index) => {
    const label = jobLabel(job, index);
    const parsed = parseUsd(job.netPay);
    const cadence = isCadence(job.cadence) ? job.cadence : null;
    let netPayCents: number | null = null;

    if (!parsed.ok && parsed.reason === "empty") {
      missing.push({
        path: `jobs.${index}.netPay`,
        question: "Enter the amount you take home each payday",
      });
    } else if (!parsed.ok) {
      missing.push({
        path: `jobs.${index}.netPay`,
        question: "Enter a take-home amount in dollars, such as 2400.",
      });
    } else {
      netPayCents = parsed.cents;
    }

    if (!cadence) {
      missing.push({
        path: `jobs.${index}.cadence`,
        question: "Choose how often you are paid",
      });
    }

    if (netPayCents != null) {
      scheduleComparison.push({
        jobId: job.id,
        jobLabel: label,
        paydayCents: netPayCents,
        yourCadence: cadence,
        biweekly: scheduleFor(netPayCents, "biweekly"),
        semimonthly: scheduleFor(netPayCents, "semimonthly"),
      });
    }

    if (netPayCents == null || cadence == null) {
      summaries.push({
        id: job.id,
        label,
        cadence: job.cadence ?? null,
        netPayCents,
        paychecksPerYear: null,
        ordinaryMonthPaycheckCount: null,
        ordinaryMonthCents: null,
        averageMonthlyCents: null,
        annualCents: null,
      });
      return;
    }

    const info = CADENCES[cadence];
    const annualCents = netPayCents * info.paychecksPerYear;
    const ordinaryMonthCents = netPayCents * info.ordinaryPaychecks;
    const averageMonthlyCents = divideRoundHalfUp(annualCents, 12);
    summaries.push({
      id: job.id,
      label,
      cadence,
      netPayCents,
      paychecksPerYear: info.paychecksPerYear,
      ordinaryMonthPaycheckCount: info.ordinaryPaychecks,
      ordinaryMonthCents,
      averageMonthlyCents,
      annualCents,
    });
    calculation.push(
      `${label}: ${info.label.toLowerCase()}, ${info.paychecksPerYear} paychecks a year.`,
    );
  });

  const complete = summaries.every(
    (job) => job.ordinaryMonthCents != null && job.averageMonthlyCents != null && job.annualCents != null,
  );
  const knownCadences = summaries.flatMap((job) => {
    const cadence = job.cadence;
    return cadence && isCadence(cadence) ? [cadence] : [];
  });

  return {
    status: missing.length === 0 && complete ? "complete" : "partial",
    missing,
    jobs: summaries,
    combined: {
      ordinaryMonthCents: complete
        ? summaries.reduce((sum, job) => sum + (job.ordinaryMonthCents ?? 0), 0)
        : null,
      averageMonthlyCents: complete
        ? summaries.reduce((sum, job) => sum + (job.averageMonthlyCents ?? 0), 0)
        : null,
      annualCents: complete ? summaries.reduce((sum, job) => sum + (job.annualCents ?? 0), 0) : null,
      ordinaryMonthLabel: ordinaryMonthLabelFor(knownCadences),
    },
    scheduleComparison,
    explanation: [...SCHEDULE_EXPLANATION],
    calculation,
  };
}
