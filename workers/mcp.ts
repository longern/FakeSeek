import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono();

export class ChatToolsMcp extends McpAgent {
  server = new McpServer({ name: "Demo", version: "1.0.0" });
  async init() {
    this.server.tool(
      "search_google",
      { query: z.string() },
      async ({ query }) => {
        return {
          content: [{ type: "text", text: query }],
        };
      }
    );
  }
}

app.all("*", (c) => {
  return ChatToolsMcp.serveSSE("/mcp").fetch(
    c.req.raw,
    c.env,
    c.executionCtx as any
  );
});

export default app;
