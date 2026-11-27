import { AcquisitionTool } from "@dayfolio/acquisition/ui";
import { BirthCertificateTool } from "@dayfolio/birth-certificate/ui";
import type { ComponentType } from "react";

export { AcquisitionTool, BirthCertificateTool };

export const toolViews: Record<string, ComponentType<{ asOf: string }>> = {
  "lease-purchase-finance": AcquisitionTool,
  "us-birth-certificate": BirthCertificateTool,
};
