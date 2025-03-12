import { Hono } from "hono";

const app = new Hono<{
  Bindings: {
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  };
}>();

app.post("/chat/completions", async (c) => {
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

export default app;
