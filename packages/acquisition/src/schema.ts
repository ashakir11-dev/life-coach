import { z } from "zod";

const money = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/,
    "Enter a dollar amount with up to two decimals, such as 350.00.",
  );

const apr = z
  .string()
  .regex(
    /^(?:0|[1-9]\d?)(?:\.\d{1,4})?$/,
    "Enter the annual rate as a percent, such as 6 or 6.5.",
  );

export const acquisitionInputSchema = z
  .object({
    itemLabel: z.string().trim().min(1).max(80).optional(),
    termMonths: z.number().int().min(1).max(120).optional(),
    currency: z.literal("USD").optional(),
    lease: z
      .object({
        monthlyPayment: money.optional(),
        dueAtSigning: money.optional(),
        refundablePortion: money.optional(),
      })
      .strict()
      .optional(),
    finance: z
      .object({
        quotedMonthlyPayment: money.optional(),
        quoteDueAtSigning: money.optional(),
        purchasePrice: money.optional(),
        downPayment: money.optional(),
        feesAtSigning: money.optional(),
        feesFinanced: money.optional(),
        aprPercent: apr.optional(),
        source: z.enum(["quote", "calculate"]).optional(),
      })
      .strict()
      .optional(),
    cash: z
      .object({
        amountDue: money.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type AcquisitionInput = z.infer<typeof acquisitionInputSchema>;

export const SENSITIVE_KEY =
  /ssn|socialsecurity|taxid|passport|document|upload|dateofbirth|birthdate|fullname|firstname|lastname|maiden/i;

export type FieldError = { path: string; message: string };

export function rejectSensitiveKeys(value: unknown): FieldError | null {
  const found = scan(value);
  if (!found) return null;
  return {
    path: "input",
    message:
      "Remove identification numbers and documents. This tool does not collect them.",
  };
}

function scan(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => scan(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => SENSITIVE_KEY.test(key) || scan(child));
}
