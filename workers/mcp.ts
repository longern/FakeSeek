import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Hono } from "hono";
import { z } from "zod";
import { formatSearchResults, search } from "./search";

const app = new Hono();

export class ChatToolsMcp extends McpAgent<{
  GOOGLE_API_KEY: string;
  GOOGLE_CSE_CX: string;
}> {
  server = new McpServer({ name: "Demo", version: "1.0.0" });
  async init() {
    this.server.tool(
      "search_google",
      { query: z.string() },
      async ({ query }) => {
        const response = await search(query, this.env);
        const data = await response.json();
        if (!response.ok)
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: (data as any).error || "Search failed",
                }),
              },
            ],
          };

        return {
          content: [{ type: "text", text: formatSearchResults(data) }],
        };
      }
    );

    this.server.tool("browse_web", { url: z.string() }, async ({ url }) => {
      const response = await fetch("https://r.jina.ai/" + url);
      if (!response.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to fetch ${url}: ${response.statusText}`,
            },
          ],
        };
      }
      const text = await response.text();
      return {
        content: [{ type: "text", text }],
      };
    });
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
