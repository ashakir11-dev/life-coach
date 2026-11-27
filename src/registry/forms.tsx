import { HousingForm } from "@/modules/housing/form";
import { PaycheckForm } from "@/modules/paycheck/form";
import type { TakeHomeFact } from "@/server/types";
import type { ComponentType } from "react";

export type ToolFormProps = {
  initialFacts: TakeHomeFact[];
};

/**
 * Screens for registered tools. Add a form here when a new tool needs a page.
 * Do not edit the paycheck or housing modules to register another tool.
 */
export const toolForms: Record<string, ComponentType<ToolFormProps>> = {
  paycheck: PaycheckForm,
  housing: HousingForm,
};
