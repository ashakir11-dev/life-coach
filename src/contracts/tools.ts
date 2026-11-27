import { z } from "zod";

export const cadenceSchema = z.enum(["weekly", "biweekly", "semimonthly", "monthly", "unsure"]);

export const jobInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(80).optional(),
  netPay: z.string().optional(),
  cadence: cadenceSchema.optional(),
});

export const paycheckInputSchema = z.object({
  jobs: z.array(jobInputSchema).min(1).max(6),
});

export const housingOptionInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80),
  monthlyPayment: z.string().optional(),
  upfrontCash: z.string().optional(),
});

export const housingInputSchema = z.object({
  jobs: z.array(jobInputSchema).min(1).max(6),
  basis: z.enum(["ordinary-month", "monthly-average"]),
  commitmentsMonthly: z.string().optional(),
  options: z.tuple([housingOptionInputSchema, housingOptionInputSchema]),
});

export const factDraftSchema = z.object({
  contextId: z.string().min(1),
  label: z.string().max(80).optional(),
  netPay: z.string(),
  cadence: z.enum(["weekly", "biweekly", "semimonthly", "monthly"]),
});

export const replaceFactsSchema = z.object({
  expectedRevisions: z.array(
    z.object({
      contextId: z.string().min(1),
      revision: z.number().int().positive(),
    }),
  ),
  facts: z.array(factDraftSchema).max(6),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(80),
  toolId: z.string().min(1),
  input: z.unknown(),
  rememberFacts: z.boolean().default(false),
});

export type PaycheckInput = z.infer<typeof paycheckInputSchema>;
export type HousingInput = z.infer<typeof housingInputSchema>;
export type ReplaceFactsInput = z.infer<typeof replaceFactsSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
