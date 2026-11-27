export type ParseUsdResult =
  | { ok: true; cents: number }
  | { ok: false; reason: "empty" | "invalid" };

export function parseUsd(input: string | undefined): ParseUsdResult {
  if (input == null || input.trim() === "") return { ok: false, reason: "empty" };
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, reason: "invalid" };
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: "invalid" };
  return { ok: true, cents };
}

export function centsToInput(cents: number): string {
  const dollars = Math.trunc(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  if (remainder === 0) return `${sign}${dollars}`;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const dollarsText = dollars.toLocaleString("en-US");
  if (remainder === 0) return `${sign}$${dollarsText}`;
  return `${sign}$${dollarsText}.${remainder.toString().padStart(2, "0")}`;
}

export function divideRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error("divideRoundHalfUp expects integers and a positive denominator");
  }
  const negative = numerator < 0;
  const absolute = Math.abs(numerator);
  const quotient = Math.floor(absolute / denominator);
  const remainder = absolute % denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return negative ? -rounded : rounded;
}
