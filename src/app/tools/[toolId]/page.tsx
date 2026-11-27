import { toolForms } from "@/registry/forms";
import { getTool } from "@/registry";
import { readGuestId } from "@/server/guest";
import { getRepository } from "@/server/repository";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ toolId: string }>;
}): Promise<Metadata> {
  const { toolId } = await params;
  const tool = getTool(toolId);
  return { title: tool?.question ?? "Question" };
}

export default function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  return (
    <Suspense fallback={<p>Loading this question…</p>}>
      <ToolScreen params={params} />
    </Suspense>
  );
}

async function ToolScreen({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) notFound();
  const Form = toolForms[toolId];
  const householdId = await readGuestId();
  const facts = householdId ? await getRepository().listFacts(householdId) : [];

  return (
    <>
      <p className="eyebrow">{tool.topic}</p>
      <h1>{tool.question}</h1>
      <p className="lede">{tool.summary}</p>
      {Form ? (
        <Form initialFacts={facts} />
      ) : (
        <p>This question is registered. Its screen is added separately from paycheck and housing.</p>
      )}
    </>
  );
}
