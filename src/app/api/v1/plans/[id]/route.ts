import { readGuestId } from "@/server/guest";
import { getRepository } from "@/server/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const householdId = await readGuestId();
  if (!householdId) return Response.json({ error: "Plan not found" }, { status: 404 });
  const { id } = await context.params;
  const plan = await getRepository().getPlan(householdId, id);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  return Response.json({ plan });
}
