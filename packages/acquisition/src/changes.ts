import { evaluateAcquisition, type AcquisitionSuccess, type PathId } from "./evaluate";
import type { AcquisitionInput } from "./schema";

const INPUT_LABELS: { path: string; label: string }[] = [
  { path: "itemLabel", label: "Item" },
  { path: "termMonths", label: "Term" },
  { path: "lease.monthlyPayment", label: "Lease monthly payment" },
  { path: "lease.dueAtSigning", label: "Lease amount due at signing" },
  { path: "lease.refundablePortion", label: "Lease refundable portion" },
  { path: "finance.quotedMonthlyPayment", label: "Finance quoted monthly payment" },
  { path: "finance.quoteDueAtSigning", label: "Finance amount due at signing" },
  { path: "finance.purchasePrice", label: "Finance price" },
  { path: "finance.downPayment", label: "Finance down payment" },
  { path: "finance.feesAtSigning", label: "Finance fees at signing" },
  { path: "finance.feesFinanced", label: "Finance fees financed" },
  { path: "finance.aprPercent", label: "Finance rate" },
  { path: "cash.amountDue", label: "Cash amount due" },
];

export type AcquisitionChangeReport = {
  summary: string;
  changedInputs: string[];
  affected: string[];
  unchanged: string[];
};

export function describeAcquisitionChanges(
  before: AcquisitionInput,
  after: AcquisitionInput,
  context: { asOf: string },
): AcquisitionChangeReport {
  const changedInputs = INPUT_LABELS.filter(
    (field) => readPath(before, field.path) !== readPath(after, field.path),
  ).map((field) => field.label);
  const left = evaluateAcquisition(before, context);
  const right = evaluateAcquisition(after, context);
  if (!left.ok || !right.ok) {
    return {
      summary: "Enter valid amounts before comparing a change.",
      changedInputs,
      affected: [],
      unchanged: [],
    };
  }
  const affected: string[] = [];
  const unchanged: string[] = [];
  for (const id of ["lease", "finance", "cash"] as PathId[]) {
    const previous = left.paths.find((path) => path.id === id);
    const next = right.paths.find((path) => path.id === id);
    const name = next?.name ?? previous?.name ?? id;
    if (!previous?.complete && next?.complete) {
      affected.push(`${name} upfront`, `${name} monthly`, `${name} cash over the term`);
      continue;
    }
    if (previous?.complete && !next?.complete) {
      affected.push(`${name} is no longer complete`);
      continue;
    }
    if (!previous?.complete || !next?.complete) continue;
    const moved = (["upfront", "monthly", "cashOverTerm"] as const).filter(
      (key) => previous[key]?.cents !== next[key]?.cents,
    );
    if (moved.length === 0) {
      unchanged.push(name);
      continue;
    }
    for (const key of moved) {
      const label = key === "cashOverTerm" ? "cash over the term" : key;
      affected.push(`${name} ${label}`);
    }
  }
  const summary = [
    changedInputs.length === 0 ? "No input changed." : `${changedInputs.join(", ")} changed.`,
    affected.length === 0 ? "No result amount moved." : `${affected.join(", ")} moved.`,
    unchanged.length === 0 ? "" : `${unchanged.join(" and ")} stayed the same.`,
  ]
    .filter(Boolean)
    .join(" ");
  return { summary, changedInputs, affected, unchanged };
}

function readPath(input: AcquisitionInput, path: string): string {
  const [head, tail] = path.split(".");
  if (!tail) return String((input as Record<string, unknown>)[head ?? ""] ?? "");
  const group = (input as Record<string, unknown>)[head ?? ""];
  if (!group || typeof group !== "object") return "";
  return String((group as Record<string, unknown>)[tail] ?? "");
}

export function sampleResult(input: AcquisitionInput, asOf: string): AcquisitionSuccess | null {
  const result = evaluateAcquisition(input, { asOf });
  return result.ok ? result : null;
}
