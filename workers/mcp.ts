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
  server = new McpServer({ name: "Chat Tools", version: "0.1.0" });
  async init() {
    this.server.tool(
      "search_google",
      { query: z.string() },
      async ({ query }) => {
        const response = await search(query, this.env);
        const data = await response.json<Record<string, any>>();
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

        if (!Array.isArray(data.items)) {
          if (data?.spelling) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ spelling: data.spelling }),
                },
              ],
            };
          }

          console.error("Search results:", data);
          return {
            isError: true,
            content: [{ type: "text", text: "No search results found." }],
          };
        }

        return {
          content: [{ type: "text", text: formatSearchResults(data as any) }],
        };
      }
    );

    this.server.tool("browse_webpage", { url: z.string() }, async ({ url }) => {
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
