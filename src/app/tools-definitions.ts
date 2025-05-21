import { Tool } from "openai/resources/responses/responses.mjs";

export const TOOL_PYTHON: Tool = {
  type: "function",
  name: "run_python",
  description: "Run Python code in Piston, stdout and stderr are returned.",
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
