import { paycheckInputSchema, type PaycheckInput } from "@/contracts/tools";
import { evaluatePaycheck } from "@/domain/paycheck";
import type { ToolDefinition } from "@/registry/registry";

export const paycheckTool: ToolDefinition = {
  id: "paycheck",
  version: "1.0.0",
  domain: "work-income",
  topic: "Work and income",
  question: "What does my paycheck add up to?",
  summary: "Shows what your take-home pay adds up to in a typical pay month and in an average month.",
  aliases: ["payday", "take-home", "net pay", "biweekly", "twice a month"],
  href: "/tools/paycheck",
  targets: ["educate", "sandbox", "compare"],
  factBindings: {
    consumes: [],
    contributes: ["income.take_home"],
  },
  coverage: "United States. You enter actual take-home pay. This does not estimate taxes.",
  sources: [
    {
      title: "Paycheck count",
      note: "Every two weeks is 26 paychecks in a year. Twice a month is 24. Enter the take-home amount from your pay stub.",
    },
  ],
  inputSchema: paycheckInputSchema,
  evaluate: (input: unknown) => evaluatePaycheck(input as PaycheckInput),
};
