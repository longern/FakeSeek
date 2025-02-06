import { Hono } from "hono";

import type { DigestWorkflowParams } from "./workflow";

export { DigestWorkflow } from "./workflow";

const app = new Hono<{
  Bindings: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
    DIGEST_WORKFLOW: Workflow<DigestWorkflowParams>;
  };
}>();

app.get("/api/search", (c) => {
  const query = c.req.query("q");
  if (!query)
    return Response.json({ error: "Missing query parameter" }, { status: 400 });

  const params = new URLSearchParams({
    q: query,
    cx: c.env.GOOGLE_CSE_CX,
    key: c.env.GOOGLE_API_KEY,
  });
  return fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
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
