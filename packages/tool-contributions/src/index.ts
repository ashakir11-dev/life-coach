import {
  acquisitionInputSchema,
  acquisitionManifest,
  evaluateAcquisition,
  type AcquisitionEvaluation,
} from "@dayfolio/acquisition";
import {
  birthCertificateInputSchema,
  birthCertificateManifest,
  evaluateBirthCertificate,
  type BirthEvaluation,
} from "@dayfolio/birth-certificate";
import type { ZodType } from "zod";

export type ToolContribution = {
  id: string;
  version: string;
  domain: string;
  question: string;
  summary: string;
  aliases: readonly string[];
  targets: readonly ["educate", "sandbox", "compare"];
  geographicCoverage: string;
  actions: readonly string[];
  factBindings: readonly {
    key: string;
    scope: string;
    type: string;
    required: boolean;
    apply: "explicit-only";
  }[];
  units: readonly string[];
  inputSchema: ZodType;
  evaluate: (
    input: unknown,
    context: { asOf: string },
  ) => AcquisitionEvaluation | BirthEvaluation;
};

/**
 * Mount contract for the Next.js shell.
 * Register these tools without editing paycheck or housing.
 *
 * import { toolContributions } from "@dayfolio/tool-contributions"
 * for (const tool of toolContributions) registry.register(tool)
 *
 * Screens live on the "./ui" export.
 */
export const toolContributions: ToolContribution[] = [
  {
    ...acquisitionManifest,
    inputSchema: acquisitionInputSchema,
    evaluate: evaluateAcquisition,
  },
  {
    ...birthCertificateManifest,
    inputSchema: birthCertificateInputSchema,
    evaluate: evaluateBirthCertificate,
  },
];
