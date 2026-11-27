import { listTools } from "@/registry";

export function GET() {
  return Response.json({ tools: listTools() });
}
