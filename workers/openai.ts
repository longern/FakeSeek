import { Hono } from "hono";
import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/index.mjs";
import { Stream } from "openai/streaming.mjs";

const app = new Hono<{
  Bindings: {
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_MODEL?: string;
  };
}>();

app.post("/chat/completions", async (c) => {
  const baseURL = c.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const body = await c.req.json();
  if (!body.model) body.model = c.env.OPENAI_MODEL ?? "deepseek-r1";
  return fetch(baseURL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
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

  const id = crypto.randomUUID();
  writer.write(
    encoder.encode(
      `event: response.created\ndata: ${JSON.stringify({
        type: "response.created",
        item_id: `resp_${id}`,
      })}\n\n`
    )
  );

  let outputIndex = -1;
  let lastMessageId: string | undefined = undefined;
  for await (const event of completion) {
    const delta = event.choices[0].delta;
    if (
      "reasoning_content" in delta &&
      typeof delta.reasoning_content === "string"
    ) {
      if (lastMessageId !== `rsn_${id}`) {
        outputIndex += 1;
        lastMessageId = `rsn_${id}`;

        writer.write(
          encoder.encode(
            `event: response.output_item.added\ndata: ${JSON.stringify({
              type: "response.output_item.added",
              output_index: outputIndex,
              item: {
                type: "reasoning",
                id: `rsn_${id}`,
                status: "in_progress",
                role: "assistant",
                summary: [],
              },
            })}\n\n`
          )
        );

        writer.write(
          encoder.encode(
            `event: response.content_part.added\ndata: ${JSON.stringify({
              type: "response.content_part.added",
              item_id: `rsn_${id}`,
              output_index: outputIndex,
              content_index: 0,
              part: {
                type: "summary_text",
                text: "",
              },
            })}\n\n`
          )
        );
      }

      writer.write(
        encoder.encode(
          `event: response.output_text.delta\ndata: ${JSON.stringify({
            type: "response.output_text.delta",
            item_id: `rsn_${id}`,
            output_index: outputIndex,
            content_index: 0,
            delta: delta.reasoning_content,
          })}\n\n`
        )
      );
    } else {
      if (lastMessageId !== `msg_${id}`) {
        if (lastMessageId) {
          writer.write(
            encoder.encode(
              `event: response.output_item.done\ndata: ${JSON.stringify({
                type: "response.output_item.done",
                output_index: outputIndex,
                item: { id: lastMessageId, status: "completed" },
              })}\n\n`
            )
          );
        }

        outputIndex += 1;
        lastMessageId = `msg_${id}`;

        writer.write(
          encoder.encode(
            `event: response.output_item.added\ndata: ${JSON.stringify({
              type: "response.output_item.added",
              output_index: outputIndex,
              item: {
                type: "message",
                id: `msg_${id}`,
                status: "in_progress",
                role: "assistant",
                content: [],
              },
            })}\n\n`
          )
        );

        writer.write(
          encoder.encode(
            `event: response.content_part.added\ndata: ${JSON.stringify({
              type: "response.content_part.added",
              item_id: `msg_${id}`,
              output_index: outputIndex,
              content_index: 0,
              part: {
                type: "output_text",
                text: "",
                annotations: [],
              },
            })}\n\n`
          )
        );
      }

      writer.write(
        encoder.encode(
          `event: response.output_text.delta\ndata: ${JSON.stringify({
            type: "response.output_text.delta",
            item_id: `msg_${id}`,
            output_index: 0,
            content_index: 0,
            delta: delta.content,
          })}\n\n`
        )
      );
    }
  }
}

app.post("/responses", async (c) => {
  const baseURL = c.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const body = await c.req.json();

  const client = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
    baseURL,
  });

  const input: any = body.input;
  const model: string = body.model || (c.env.OPENAI_MODEL ?? "deepseek-r1");
  const completion = await client.chat.completions.create({
    model,
    messages: input
      .filter((message: any) => message.type === "message")
      .map((message: any) =>
        Array.isArray(message.content)
          ? {
              role: message.role,
              content:
                model.indexOf("qwq") !== -1 // qwq series models don't support content array
                  ? (message.content as any[])
                      .flatMap((part: any) =>
                        part.type === "input_text" ||
                        part.type === "output_text"
                          ? [part.text]
                          : []
                      )
                      .join("\n")
                  : message.content.map((part: any) =>
                      part.type === "input_text" || part.type === "output_text"
                        ? {
                            type: "text",
                            text: part.text,
                          }
                        : part
                    ),
            }
          : message
      ),
    stream: true,
  });

  let { readable, writable } = new TransformStream();

  transformCompletion(completion, writable);

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
