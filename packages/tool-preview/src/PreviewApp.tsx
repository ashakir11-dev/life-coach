import { toolContributions } from "@dayfolio/tool-contributions";
import { toolViews } from "@dayfolio/tool-contributions/ui";
import { useState } from "react";

const asOf = "2026-11-27";

export function PreviewApp() {
  const [toolId, setToolId] = useState(toolContributions[0]?.id ?? "");
  const View = toolViews[toolId];
  const current = toolContributions.find((tool) => tool.id === toolId);

  return (
    <div>
      <header className="df-preview-bar">
        <p>Dayfolio</p>
        <nav aria-label="Registered tools">
          {toolContributions.map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-current={tool.id === toolId ? "page" : undefined}
              onClick={() => setToolId(tool.id)}
            >
              {tool.question}
            </button>
          ))}
        </nav>
      </header>
      {current && View ? <View asOf={asOf} /> : <p>This registry has no tool to mount.</p>}
    </div>
  );
}
