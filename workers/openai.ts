import { Hono } from "hono";
import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/index.mjs";
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs";
import type { Stream } from "openai/streaming.mjs";

const app = new Hono<{
  Bindings: {
    OPENROUTER_API_KEY: string;
  };
}>();

app.post("/chat/completions", async (c) => {
  const baseURL = "https://openrouter.ai/api/v1";
  const body = await c.req.json();
  body.model = "deepseek/deepseek-r1-0528:free";
  return fetch(baseURL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
});

async function transformCompletion(
  completion: Stream<ChatCompletionChunk>,
  writable: WritableStream<any>
) {
  let writer = writable.getWriter();
  let encoder = new TextEncoder();

  async function writeEvent(
    eventType: ResponseStreamEvent["type"],
    data: Record<string, any>
  ) {
    const dataBody = JSON.stringify({ type: eventType, ...data });
    const message = `event: ${eventType}\ndata: ${dataBody}\n\n`;
    await writer.write(encoder.encode(message));
  }

  const id = crypto.randomUUID();
  const response = {
    object: "response",
    id: `resp_${id}`,
    created_at: Math.floor(Date.now() / 1000),
    status: "in_progress",
    output: [] as any[],
    usage: null as Record<string, any> | null,
  };

  await writeEvent("response.created", { response });

  for await (const event of completion) {
    if (event.usage) response.usage = event.usage;
    if (event.choices.length === 0) continue;

    const delta = event.choices[0].delta;
    const reasoningContent =
      "reasoning_content" in delta &&
      typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : undefined;
    const reasoning =
      "reasoning" in delta && typeof delta.reasoning === "string"
        ? delta.reasoning
        : reasoningContent;
    if (reasoning !== undefined) {
      if (
        response.output.length === 0 ||
        response.output[response.output.length - 1].type !== "reasoning"
      ) {
        const outputIndex = response.output.length;
        const messageId = `rs_${crypto.randomUUID()}`;
        const reasoningMessage = {
          type: "reasoning",
          id: messageId,
          status: "in_progress",
          summary: [],
        };
        response.output.push(reasoningMessage);
        await writeEvent("response.output_item.added", {
          output_index: outputIndex,
          item: reasoningMessage,
        });

        const part = { type: "summary_text", text: "" };
        response.output[outputIndex].summary.push(part);
        await writeEvent("response.reasoning_summary_part.added", {
          item_id: messageId,
          output_index: outputIndex,
          summary_index: 0,
          part,
        });
      }

      const outputIndex = response.output.length - 1;
      response.output[outputIndex].summary[0].text += reasoning;
      await writeEvent("response.reasoning_summary_text.delta", {
        item_id: response.output[outputIndex].id,
        output_index: outputIndex,
        summary_index: 0,
        delta: reasoning,
      });
    } else {
      if (
        response.output.length === 0 ||
        response.output[response.output.length - 1].type !== "message"
      ) {
        const prevIndex = response.output.length - 1;

        if (response.output.length > 0) {
          response.output[prevIndex].status = "completed";
          await writeEvent("response.output_item.done", {
            output_index: prevIndex,
            item: response.output[prevIndex],
          });
        }

        const newMessage = {
          type: "message",
          id: `msg_${crypto.randomUUID()}`,
          status: "in_progress",
          role: "assistant",
          content: [] as any[],
        };
        response.output.push(newMessage);
        const outputIndex = response.output.length - 1;
        await writeEvent("response.output_item.added", {
          output_index: outputIndex,
          item: newMessage,
        });

        const newPart = { type: "output_text", text: "", annotations: [] };
        response.output[outputIndex].content.push(newPart);
        await writeEvent("response.content_part.added", {
          item_id: newMessage.id,
          output_index: outputIndex,
          content_index: 0,
          part: newPart,
        });
      }

      const outputIndex = response.output.length - 1;
      response.output[outputIndex].content[0].text += delta.content;
      await writeEvent("response.output_text.delta", {
        item_id: response.output[outputIndex].id,
        output_index: outputIndex,
        content_index: 0,
        delta: delta.content,
      });
    }
  }

  const outputIndex = response.output.length - 1;
  response.output[outputIndex].status = "completed";
  await writeEvent("response.output_item.done", {
    output_index: outputIndex,
    item: response.output[outputIndex],
  });

  response.status = "completed";
  await writeEvent("response.completed", { response });

  await writer.close();
}

app.post("/responses", async (c) => {
  const baseURL = "https://openrouter.ai/api/v1";
  const body = await c.req.json();

  const client = new OpenAI({
    apiKey: c.env.OPENROUTER_API_KEY,
    baseURL,
  });

  const input: any = body.input;
  const model: string = "deepseek/deepseek-r1-0528:free";
  const messages = Array.isArray(input)
    ? input
    : [{ role: "user", content: [{ type: "text", text: input }] }];

  if (body.instuctions) {
    messages.unshift({
      role: "system",
      content: body.instuctions,
    });
  }

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].type !== "message") {
      messages.splice(i, 1);
      i--;
      continue;
    }

    if (Array.isArray(messages[i].content)) {
      const content = messages[i].content;
      for (let j = 0; j < content.length; j++) {
        if (
          content[j].type === "input_text" ||
          content[j].type === "output_text"
        ) {
          content[j] = { type: "text", text: content[j].text };
        }
      }
    }

    if (model.indexOf("qwq") !== -1) {
      messages[i].content = messages[i].content
        .flatMap((part: any) => (part.type === "text" ? [part.text] : []))
        .join("\n");
    }
  }

  const completion = await client.chat.completions.create({
    model,
    messages,
    max_tokens: body.max_output_tokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  let { readable, writable } = new TransformStream();

  c.executionCtx.waitUntil(transformCompletion(completion, writable));

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    },
  });
});

app.onError((err) => {
  return Response.json({ error: { message: err.message } }, { status: 500 });
});

export default app;
