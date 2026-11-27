export const CADENCE_IDS = ["weekly", "biweekly", "semimonthly", "monthly"] as const;

export type Cadence = (typeof CADENCE_IDS)[number];
export type PayCadence = Cadence | "unsure";

export type CadenceInfo = {
  id: Cadence;
  label: string;
  paychecksPerYear: number;
  ordinaryPaychecks: number;
  ordinaryMonthLabel: string;
};

export const CADENCES: Record<Cadence, CadenceInfo> = {
  weekly: {
    id: "weekly",
    label: "Every week",
    paychecksPerYear: 52,
    ordinaryPaychecks: 4,
    ordinaryMonthLabel: "Four-paycheck month",
  },
  biweekly: {
    id: "biweekly",
    label: "Every two weeks",
    paychecksPerYear: 26,
    ordinaryPaychecks: 2,
    ordinaryMonthLabel: "Two-paycheck month",
  },
  semimonthly: {
    id: "semimonthly",
    label: "Twice a month",
    paychecksPerYear: 24,
    ordinaryPaychecks: 2,
    ordinaryMonthLabel: "Two-paycheck month",
  },
  monthly: {
    id: "monthly",
    label: "Once a month",
    paychecksPerYear: 12,
    ordinaryPaychecks: 1,
    ordinaryMonthLabel: "Pay month",
  },
};

export function cadencePhrase(cadence: Cadence): string {
  switch (cadence) {
    case "weekly":
      return "every week";
    case "biweekly":
      return "every two weeks";
    case "semimonthly":
      return "twice a month";
    case "monthly":
      return "once a month";
  }
}

export function isCadence(value: string | undefined): value is Cadence {
  return value != null && Object.prototype.hasOwnProperty.call(CADENCES, value);
}

export function ordinaryMonthLabelFor(cadences: Cadence[]): string {
  const labels = new Set(cadences.map((id) => CADENCES[id].ordinaryMonthLabel));
  if (labels.size === 1) {
    const [label] = labels;
    if (label) return label;
  }
  return "Typical pay month";
}

export const SCHEDULE_EXPLANATION = [
  "Every two weeks means 26 paychecks in a year. Most months include two of those paychecks, and two months include a third.",
  "Twice a month means 24 paychecks in a year, so every month has two paychecks and the monthly average matches that month.",
  "The monthly average divides the annual take-home by 12.",
];
