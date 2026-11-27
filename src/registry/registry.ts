import type { z } from "zod";

export type ToolTargets = ["educate", "sandbox", "compare"];

export type ToolSource = {
  title: string;
  note: string;
  url?: string;
};

export type ToolDefinition = {
  id: string;
  version: string;
  domain: string;
  topic: string;
  question: string;
  summary: string;
  aliases: string[];
  href: string;
  targets: ToolTargets;
  factBindings: {
    consumes: string[];
    contributes: string[];
  };
  coverage: string;
  sources: ToolSource[];
  inputSchema: z.ZodType;
  evaluate: (input: unknown) => unknown;
};

export function toPublicTool(tool: ToolDefinition): PublicTool {
  return {
    id: tool.id,
    version: tool.version,
    domain: tool.domain,
    topic: tool.topic,
    question: tool.question,
    summary: tool.summary,
    aliases: tool.aliases,
    href: tool.href,
    targets: tool.targets,
    factBindings: tool.factBindings,
    coverage: tool.coverage,
    sources: tool.sources,
  };
}

export type PublicTool = Omit<ToolDefinition, "inputSchema" | "evaluate">;

export type EvaluationResult =
  | {
      ok: true;
      toolId: string;
      toolVersion: string;
      result: unknown;
    }
  | {
      ok: false;
      status: 404;
      error: string;
    }
  | {
      ok: false;
      status: 400;
      issues: { path: PropertyKey[]; message: string }[];
    };

export function createRegistry() {
  const tools: ToolDefinition[] = [];

  return {
    register(tool: ToolDefinition) {
      if (tools.some((item) => item.id === tool.id)) {
        throw new Error(`Tool already registered: ${tool.id}`);
      }
      tools.push(tool);
    },
    list(): PublicTool[] {
      return tools.map((tool) => toPublicTool(tool));
    },
    get(id: string) {
      return tools.find((tool) => tool.id === id);
    },
    evaluate(id: string, input: unknown): EvaluationResult {
      const tool = tools.find((item) => item.id === id);
      if (!tool) return { ok: false, status: 404, error: "Unknown tool" };
      const parsed = tool.inputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        };
      }
      return {
        ok: true,
        toolId: tool.id,
        toolVersion: tool.version,
        result: tool.evaluate(parsed.data),
      };
    },
  };
}
