import { Tool } from "openai/resources/responses/responses.mjs";

export const TOOL_PYTHON: Tool = {
  type: "function",
  name: "run_python",
  description:
    "Run Python code in script mode on Piston. Since stdout and stderr are returned, use print() for output.",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute",
      },
    },
    required: ["code"],
    additionalProperties: false,
  },
  strict: true,
};

export const TOOL_GOOGLE_SEARCH: Tool = {
  type: "function",
  name: "google_search",
  description: "Search the web using Google.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to execute.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

export const TOOL_DEFAULT_MCP: Tool = {
  type: "mcp",
  server_url:
    import.meta.env.VITE_MCP_SERVER ||
    new URL("/mcp", window.location.href).toString(),
  server_label: "chat-tools-mcp",
  require_approval: "never",
};
