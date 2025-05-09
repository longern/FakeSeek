import { Hono } from "hono";
import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/index.mjs";
import { Stream } from "openai/streaming.mjs";

const app = new Hono<{
  Bindings: {
    OPENROUTER_API_KEY: string;
  };
}>();

app.post("/chat/completions", async (c) => {
  const baseURL = "https://openrouter.ai/api/v1";
  const body = await c.req.json();
  body.model = "deepseek/deepseek-chat-v3-0324:free";
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
      if (lastMessageId !== `rs_${id}`) {
        outputIndex += 1;
        lastMessageId = `rs_${id}`;

        writer.write(
          encoder.encode(
            `event: response.output_item.added\ndata: ${JSON.stringify({
              type: "response.output_item.added",
              output_index: outputIndex,
              item: {
                type: "reasoning",
                id: `rs_${id}`,
                status: "in_progress",
                summary: [],
              },
            })}\n\n`
          )
        );

        writer.write(
          encoder.encode(
            `event: response.reasoning_summary_part.added\ndata: ${JSON.stringify(
              {
                type: "response.reasoning_summary_part.added",
                item_id: `rs_${id}`,
                output_index: outputIndex,
                summary_index: 0,
                part: { type: "summary_text", text: "" },
              }
            )}\n\n`
          )
        );
      }

      writer.write(
        encoder.encode(
          `event: response.reasoning_summary_text.delta\ndata: ${JSON.stringify(
            {
              type: "response.reasoning_summary_text.delta",
              item_id: `rs_${id}`,
              output_index: outputIndex,
              summary_index: 0,
              delta: delta.reasoning_content,
            }
          )}\n\n`
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
  const baseURL = "https://openrouter.ai/api/v1";
  const body = await c.req.json();

  const client = new OpenAI({
    apiKey: c.env.OPENROUTER_API_KEY,
    baseURL,
  });

  const input: any = body.input;
  const model: string = "deepseek/deepseek-chat-v3-0324:free";
  const messages = Array.isArray(input)
    ? input
    : [
        {
          role: "user",
          content: [{ type: "text", text: input }],
        },
      ];

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
          content[j] = {
            type: "text",
            text: content[j].text,
          };
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
