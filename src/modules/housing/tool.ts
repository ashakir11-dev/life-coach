import { housingInputSchema, type HousingInput } from "@/contracts/tools";
import { evaluateHousing } from "@/domain/housing";
import type { ToolDefinition } from "@/registry/registry";

export const housingTool: ToolDefinition = {
  id: "housing",
  version: "1.0.0",
  domain: "housing",
  topic: "Housing",
  question: "How would these housing payments fit our budget?",
  summary: "Compares monthly cash left and upfront cash for two named housing options.",
  aliases: ["rent", "mortgage", "apartment", "housing payment"],
  href: "/tools/housing",
  targets: ["educate", "sandbox", "compare"],
  factBindings: {
    consumes: ["income.take_home"],
    contributes: [],
  },
  coverage: "United States cash-flow comparison. This is not a rent-versus-buy model.",
  sources: [
    {
      title: "Cash-flow comparison",
      note: "Monthly cash left and upfront cash use only the amounts entered here.",
    },
  ],
  inputSchema: housingInputSchema,
  evaluate: (input: unknown) => evaluateHousing(input as HousingInput),
};
