import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/index.mjs";
import {
  Response,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import { CreateResponseParams } from "./types";

function normMessages(
  messages: Array<ResponseInputItem>
): Array<ChatCompletionMessageParam> {
  return messages.flatMap((msg) => {
    switch (msg.type) {
      case "message":
        const role = msg.role as "user" | "assistant";
        const content =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .map((part) =>
                  part.type === "input_text" || part.type === "output_text"
                    ? part.text
                    : ""
                )
                .join("");
        return [{ role, content }];
      default:
        return [];
    }
  });
}

export async function requestChatCompletionsAPI(
  messages: Array<ResponseInputItem>,
  options?: {
    apiKey?: string;
    baseURL?: string;
    signal?: AbortSignal;
    onStreamEvent: (responseId: string, event: ResponseStreamEvent) => void;
  } & CreateResponseParams
) {
  const client = new OpenAI({
    apiKey: options?.apiKey,
    baseURL:
      options?.baseURL || new URL("/api/v1", window.location.href).toString(),
    dangerouslyAllowBrowser: true,
  });

  const model = options?.model ?? "gpt-5-nano";
  const normedMessages = normMessages(messages);
  if (options?.instructions) {
    normedMessages.unshift({ role: "system", content: options.instructions });
  }

  const tools = !options?.tools
    ? undefined
    : options.tools.map((tool): ChatCompletionTool => {
        if (tool.type !== "function")
          throw new Error("Chat Completions API only supports function tools");
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description ?? undefined,
            parameters: tool.parameters ?? undefined,
          },
        };
      });

  const response = await client.chat.completions.create(
    {
      model,
      messages: normMessages(messages),
      stream: true,
      tools,
      temperature: options?.temperature,
    },
    { signal: options?.signal }
  );

  const onStreamEvent = options?.onStreamEvent ?? (() => {});
  let result: Response | undefined = undefined;
  let outputMessage: ResponseOutputMessage | undefined = undefined;
  let sequenceNumber = 0;
  let outputIndex = 0;
  for await (const chunk of response) {
    if (!result) {
      result = {
        id: crypto.randomUUID(),
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model,
        instructions: options?.instructions || null,
        output: [],
        output_text: "",
        error: null,
        incomplete_details: null,
        metadata: null,
        status: "in_progress",
        temperature: options?.temperature || null,
        top_p: null,
        tools: options?.tools ?? [],
        parallel_tool_calls: false,
        tool_choice: "auto",
      };

      onStreamEvent(result.id, {
        type: "response.created",
        response: structuredClone(result),
        sequence_number: sequenceNumber++,
      });

      outputMessage = {
        type: "message",
        id: `msg_${crypto.randomUUID()}`,
        role: "assistant",
        content: [],
        status: "in_progress",
      };
      onStreamEvent(result.id, {
        type: "response.output_item.added",
        output_index: outputIndex,
        item: structuredClone(outputMessage),
        sequence_number: sequenceNumber++,
      });
      result.output.push(outputMessage);

      const contentPart: ResponseOutputText = {
        type: "output_text",
        text: "",
        annotations: [],
      };
      onStreamEvent(result.id, {
        type: "response.content_part.added",
        item_id: result.output[outputIndex]?.id || "",
        output_index: outputIndex,
        content_index: 0,
        part: structuredClone(contentPart),
        sequence_number: sequenceNumber++,
      });
      outputMessage.content.push(contentPart);
    }

    const delta = chunk.choices[0].delta;
    if ("images" in delta && Array.isArray(delta.images)) {
      onStreamEvent(result.id, {
        type: "response.content_part.done",
        item_id: result.output[outputIndex]?.id || "",
        output_index: outputIndex,
        content_index: 0,
        part: {
          type: "output_text",
          text: result.output_text,
          annotations: [],
        },
        sequence_number: sequenceNumber++,
      });

      outputMessage!.status = "completed";
      onStreamEvent(result.id, {
        type: "response.output_item.done",
        output_index: outputIndex++,
        item: outputMessage!,
        sequence_number: sequenceNumber++,
      });

      const imagesBase64 = await Promise.all(
        delta.images.map(async (img) => {
          return img.image_url.url.split(",")[1];
        })
      );

      for (const imageBase64 of imagesBase64) {
        const item = {
          type: "image_generation_call",
          id: `msg_${crypto.randomUUID()}`,
          result: imageBase64,
          status: "completed",
        } as ResponseOutputItem.ImageGenerationCall;
        result.output.push(item);

        onStreamEvent(result.id, {
          type: "response.output_item.added",
          output_index: outputIndex,
          item,
          sequence_number: sequenceNumber++,
        });

        onStreamEvent(result.id, {
          type: "response.output_item.done",
          output_index: outputIndex++,
          item,
          sequence_number: sequenceNumber++,
        });
      }

      outputMessage = {
        type: "message",
        id: `msg_${crypto.randomUUID()}`,
        role: "assistant",
        content: [],
        status: "in_progress",
      };
      result.output.push(outputMessage);

      onStreamEvent(result.id, {
        type: "response.output_item.added",
        output_index: outputIndex,
        item: structuredClone(outputMessage),
        sequence_number: sequenceNumber++,
      });

      const contentPart: ResponseOutputText = {
        type: "output_text",
        text: "",
        annotations: [],
      };
      outputMessage.content.push(contentPart);

      onStreamEvent(result.id, {
        type: "response.content_part.added",
        item_id: result.output[outputIndex]?.id || "",
        output_index: outputIndex,
        content_index: 0,
        part: structuredClone(contentPart),
        sequence_number: sequenceNumber++,
      });
    }

    onStreamEvent(result.id, {
      type: "response.output_text.delta",
      output_index: outputIndex,
      content_index: 0,
      item_id: result.output[outputIndex]?.id || "",
      delta: chunk.choices[0].delta.content || "",
      logprobs: [],
      sequence_number: sequenceNumber++,
    });
    (outputMessage!.content[0]! as ResponseOutputText).text +=
      chunk.choices[0].delta.content || "";
  }

  if (!result) throw new Error("No response received");

  onStreamEvent(result.id, {
    type: "response.content_part.done",
    item_id: result.output[outputIndex]?.id || "",
    output_index: outputIndex,
    content_index: 0,
    part: { type: "output_text", text: result.output_text, annotations: [] },
    sequence_number: sequenceNumber++,
  });

  outputMessage!.status = "completed";
  onStreamEvent(result.id, {
    type: "response.output_item.done",
    output_index: outputIndex++,
    item: outputMessage!,
    sequence_number: sequenceNumber++,
  });

  result.status = "completed";
  onStreamEvent(result.id, {
    type: "response.completed",
    response: result,
    sequence_number: sequenceNumber++,
  });

  return result;
}
