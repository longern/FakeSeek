import { Hono } from "hono";

import type { DigestWorkflowParams } from "./workflow";
import { search } from "./search";

export { DigestWorkflow } from "./workflow";

const app = new Hono<{
  Bindings: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
    DIGEST_WORKFLOW: Workflow<DigestWorkflowParams>;
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  };
}>();

app.get("/api/search", (c) => {
  const query = c.req.query("q");
  if (!query)
    return Response.json({ error: "Missing query parameter" }, { status: 400 });

  return search(query, c.env);
});

app.post("/api/v1/chat/completions", async (c) => {
  const baseURL = c.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return fetch(baseURL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
    },
    body: c.req.raw.body,
  });
});

app.get("/api/tasks/:id", async (c) => {
  const workflowId = c.req.param("id");
  const workflow = await c.env.DIGEST_WORKFLOW.get(workflowId);
  if (!workflow)
    return Response.json({ error: "Workflow not found" }, { status: 404 });
  const status = await workflow.status();
  return Response.json(status);
});

app.put("/api/tasks", async (c) => {
  const task = await c.req.json();
  if (!task)
    return Response.json(
      { error: "Missing task in request body" },
      { status: 400 }
    );

  const workflow = await c.env.DIGEST_WORKFLOW.create({ params: task });

  return Response.json({ id: workflow.id });
});

export default app;
