import { replaceFactsSchema } from "@/contracts/tools";
import { ensureGuestId, readGuestId } from "@/server/guest";
import { replaceTakeHomeFacts } from "@/server/household-service";
import { getRepository } from "@/server/repository";

export async function GET() {
  const householdId = await readGuestId();
  if (!householdId) return Response.json({ facts: [] });
  const facts = await getRepository().listFacts(householdId);
  return Response.json({ facts });
}

export async function PATCH(request: Request) {
  const householdId = await ensureGuestId();
  const body = await request.json().catch(() => null);
  const parsed = replaceFactsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a take-home amount and how often it is paid." }, { status: 400 });
  }
  const result = await replaceTakeHomeFacts(getRepository(), householdId, parsed.data, () =>
    new Date().toISOString(),
  );
  if (!result.ok) return Response.json(result, { status: result.status });
  return Response.json({ facts: result.facts });
}
