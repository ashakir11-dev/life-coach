import { getTool } from "@/registry";
import { toPublicTool } from "@/registry/registry";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tool = getTool(id);
  if (!tool) return Response.json({ error: "Unknown tool" }, { status: 404 });
  return Response.json({ tool: toPublicTool(tool) });
}
