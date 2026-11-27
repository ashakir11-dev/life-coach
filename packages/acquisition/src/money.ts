export type Money = {
  cents: number;
  currency: "USD";
  formatted: string;
};

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/;

export function isMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

export function parseMoneyCents(value: string): bigint {
  const [dollars, fraction = ""] = value.split(".");
  const cents = `${fraction}00`.slice(0, 2);
  return BigInt(dollars ?? "0") * 100n + BigInt(cents);
}

export function moneyFromCents(cents: bigint): Money {
  return {
    cents: Number(cents),
    currency: "USD",
    formatted: formatUsd(cents),
  };
}

export function formatUsd(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const dollars = absolute / 100n;
  const remainder = (absolute % 100n).toString().padStart(2, "0");
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${remainder}`;
}

export function parseApr(value: string): { numerator: bigint; denominator: bigint } {
  const [whole, fraction = ""] = value.split(".");
  const digits = fraction.replace(/0+$/, "");
  if (digits.length === 0) {
    return { numerator: BigInt(whole ?? "0"), denominator: 1n };
  }
  return {
    numerator: BigInt(`${whole ?? "0"}${digits}`),
    denominator: 10n ** BigInt(digits.length),
  };
}

function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) return quotient + 1n;
  return quotient;
}

export function levelPaymentCents(
  principalCents: bigint,
  apr: { numerator: bigint; denominator: bigint },
  months: number,
): bigint {
  if (apr.numerator === 0n) {
    return divRoundHalfUp(principalCents, BigInt(months));
  }
  const rateDenominator = apr.denominator * 1200n;
  const base = rateDenominator + apr.numerator;
  let compounded = 1n;
  let divisor = 1n;
  for (let month = 0; month < months; month += 1) {
    compounded *= base;
    divisor *= rateDenominator;
  }
  return divRoundHalfUp(
    principalCents * apr.numerator * compounded,
    rateDenominator * (compounded - divisor),
  );
}
