import { Hono } from "hono";

const app = new Hono<{
  Bindings: {
    GOOGLE_API_KEY: string;
    GOOGLE_CSE_CX: string;
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

export default app;
