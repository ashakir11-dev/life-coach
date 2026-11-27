import { housingTool } from "@/modules/housing/tool";
import { paycheckTool } from "@/modules/paycheck/tool";
import { createRegistry } from "./registry";

export const toolRegistry = createRegistry();

toolRegistry.register(paycheckTool);
toolRegistry.register(housingTool);

export function listTools() {
  return toolRegistry.list();
}

export function getTool(id: string) {
  return toolRegistry.get(id);
}

export { createRegistry } from "./registry";
