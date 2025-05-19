import { Hono } from "hono";

import type { DigestWorkflowParams } from "./workflow";
import { search } from "./search";
import openaiApp from "./openai";

export { DigestWorkflow } from "./workflow";

const app = new Hono<{
  Bindings: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
    DIGEST_WORKFLOW: Workflow<DigestWorkflowParams>;
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  };
}>().basePath("/api");

app.get("/search", (c) => {
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

app.get("/images", async (c) => {
  const url = new URL(c.req.url);
  return fetch(`https://encrypted-tbn0.gstatic.com/images${url.search}`);
});

app.get("/tasks/:id", async (c) => {
  const workflowId = c.req.param("id");
  const workflow = await c.env.DIGEST_WORKFLOW.get(workflowId);
  if (!workflow)
    return Response.json({ error: "Workflow not found" }, { status: 404 });
  const status = await workflow.status();
  return Response.json(status);
});

app.put("/tasks", async (c) => {
  const task = await c.req.json();
  if (!task)
    return Response.json(
      { error: "Missing task in request body" },
      { status: 400 }
    );

  const workflow = await c.env.DIGEST_WORKFLOW.create({ params: task });

  return Response.json({ id: workflow.id });
});

app.route("/v1", openaiApp);

export default app;
