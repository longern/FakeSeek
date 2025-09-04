import OpenAI from "openai";
import {
  Response,
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";

import { CreateResponseParams } from "./types";

export async function requestResponsesAPI(
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
  const response = await client.responses.create(
    {
      model: model,
      input: messages,
      stream: true,
      reasoning:
        model.startsWith("o") || model.startsWith("gpt-5")
          ? { summary: "detailed" }
          : undefined,
      instructions: options?.instructions,
      tools: options?.tools,
      temperature: options?.temperature,
    },
    { signal: options?.signal }
  );

  let result: Response | undefined = undefined;
  for await (const chunk of response) {
    if (chunk.type === "response.created") result = chunk.response;
    options?.onStreamEvent?.(result!.id, chunk);
    if (chunk.type === "response.completed") result = chunk.response;
  }

  if (!result) throw new Error("No response received");

  return result;
}
