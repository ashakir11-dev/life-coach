import { toolRegistry } from "@/registry";

export function evaluateToolInput(toolId: string, input: unknown) {
  return toolRegistry.evaluate(toolId, input);
}
