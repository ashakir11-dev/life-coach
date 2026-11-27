import { listTools } from "@/registry";
import type { PublicTool } from "@/registry/registry";
import Link from "next/link";

export default function ExplorePage() {
  const tools = listTools();
  const topics: { topic: string; tools: PublicTool[] }[] = [];
  for (const tool of tools) {
    const group = topics.find((item) => item.topic === tool.topic);
    if (group) group.tools.push(tool);
    else topics.push({ topic: tool.topic, tools: [tool] });
  }

  return (
    <>
      <h1>What are you trying to figure out?</h1>
      <p className="lede">
        Pick a question. You can get an answer without an account. Nothing is remembered unless you ask.
      </p>
      {topics.map((group) => (
        <section key={group.topic} className="section">
          <h2>{group.topic}</h2>
          <ul className="question-list">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <Link href={tool.href}>{tool.question}</Link>
                <p className="hint">{tool.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
