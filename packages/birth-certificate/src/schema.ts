import { z } from "zod";

export const TASK_KEYS = [
  "confirm-birth-jurisdiction",
  "open-official-destination",
  "follow-office-instructions",
] as const;

export type TaskKey = (typeof TASK_KEYS)[number];

const taskSchema = z
  .object({
    key: z.enum(TASK_KEYS),
    owner: z.string().max(80).optional(),
    status: z.enum(["waiting", "completed"]),
    targetDate: z.string().optional(),
  })
  .strict();

export const birthCertificateInputSchema = z
  .object({
    birthJurisdictionId: z.string().min(1).max(40).optional(),
    residenceJurisdictionId: z.string().min(1).max(40).optional(),
    tasks: z.array(taskSchema).max(3).optional(),
  })
  .strict();

export type BirthCertificateInput = z.infer<typeof birthCertificateInputSchema>;

export const SENSITIVE_KEY =
  /ssn|socialsecurity|taxid|passport|document|upload|dateofbirth|birthdate|fullname|firstname|lastname|maiden/i;

export type FieldError = { path: string; message: string };

export function rejectSensitiveKeys(value: unknown): FieldError | null {
  if (!scan(value)) return null;
  return {
    path: "input",
    message:
      "Remove identification numbers and documents. This guide only uses the birth jurisdiction and the checklist.",
  };
}

function scan(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => scan(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => SENSITIVE_KEY.test(key) || scan(child));
}

export function isIsoDate(value: string): boolean {
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

export function looksLikeIdentificationNumber(value: string): boolean {
  return /\d{3}-?\d{2}-?\d{4}/.test(value);
}
