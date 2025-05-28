import { Hono } from "hono";

import type { DigestWorkflowParams } from "./workflow";
import { search } from "./search";
import mcpApp from "./mcp";
import openaiApp from "./openai";

export { ChatToolsMcp } from "./mcp";
export { DigestWorkflow } from "./workflow";

const apiApp = new Hono<{
  Bindings: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
    DIGEST_WORKFLOW: Workflow<DigestWorkflowParams>;
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  };
}>();

apiApp.get("/search", (c) => {
  const query = c.req.query("q");
  if (!query)
    return Response.json({ error: "Missing query parameter" }, { status: 400 });

  const searchType = c.req.query("searchType") as "image" | undefined;

  return search(query, c.env, { searchType }).then<Response>(async (res) => {
    if (!res.ok) return res;
    const body = await res.json<any>();
    if (Array.isArray(body?.items)) {
      body.items.forEach((item: any) => {
        if (typeof item?.image?.thumbnailLink !== "string") return;
        const thumbnailUrl = new URL(item.image.thumbnailLink);
        const newLink = `/api/images?${thumbnailUrl.searchParams.toString()}`;
        item.image.thumbnailLink = newLink;
      });
    }
    return Response.json(body);
  });
});

apiApp.get("/images", async (c) => {
  const url = new URL(c.req.url);
  return fetch(`https://encrypted-tbn0.gstatic.com/images${url.search}`);
});

apiApp.get("/tasks/:id", async (c) => {
  const workflowId = c.req.param("id");
  const workflow = await c.env.DIGEST_WORKFLOW.get(workflowId);
  if (!workflow)
    return Response.json({ error: "Workflow not found" }, { status: 404 });
  const status = await workflow.status();
  return Response.json(status);
});

apiApp.put("/tasks", async (c) => {
  const task = await c.req.json();
  if (!task)
    return Response.json(
      { error: "Missing task in request body" },
      { status: 400 }
    );

  const workflow = await c.env.DIGEST_WORKFLOW.create({ params: task });

  return Response.json({ id: workflow.id });
});

apiApp.route("/v1", openaiApp);

const root = new Hono();

root.route("/api", apiApp);
root.route("/mcp", mcpApp);

export default root;
