import { createPlanSchema } from "@/contracts/tools";
import { ensureGuestId, readGuestId } from "@/server/guest";
import { createPlan } from "@/server/household-service";
import { getRepository } from "@/server/repository";

export async function GET() {
  const householdId = await readGuestId();
  if (!householdId) return Response.json({ plans: [] });
  const plans = await getRepository().listPlans(householdId);
  return Response.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      toolId: plan.toolId,
      toolVersion: plan.toolVersion,
      createdAt: plan.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const householdId = await ensureGuestId();
  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Name the comparison before saving it." }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  const result = await createPlan(
    getRepository(),
    householdId,
    parsed.data,
    () => new Date().toISOString(),
    idempotencyKey,
  );
  if (!result.ok) return Response.json(result, { status: result.status });
  return Response.json({ plan: result.plan });
}
