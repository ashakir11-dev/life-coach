import { evaluateToolInput } from "@/server/evaluate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("toolId" in body) || typeof body.toolId !== "string") {
    return Response.json({ error: "Choose a question and try again." }, { status: 400 });
  }
  const evaluated = evaluateToolInput(body.toolId, "input" in body ? body.input : undefined);
  if (!evaluated.ok) {
    return Response.json(
      evaluated.status === 404
        ? { error: evaluated.error }
        : { error: "Check the answers and try again.", issues: evaluated.issues },
      { status: evaluated.status },
    );
  }
  return Response.json({
    toolId: evaluated.toolId,
    toolVersion: evaluated.toolVersion,
    result: evaluated.result,
  });
}
