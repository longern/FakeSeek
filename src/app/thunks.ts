import OpenAI from "openai";
import {
  Response,
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseInputText,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";

import { requestChatCompletionsAPI } from "./api-modes/chat-completions-adapter";
import { requestResponsesAPI } from "./api-modes/responses";
import { CreateResponseParams } from "./api-modes/types";
import {
  add as addMessage,
  addResponse,
  ChatMessage,
  reduceEvent,
} from "./messages";
import {
  FunctionCallOutputCompletedEvent,
  FunctionCallOutputIncompleteEvent,
} from "./reducer";
import { AppDispatch, createAppAsyncThunk } from "./store";

export function getRequestAPI(apiMode: "responses" | "chat-completions") {
  const adapters = {
    responses: requestResponsesAPI,
    "chat-completions": requestChatCompletionsAPI as typeof requestResponsesAPI,
  };
  return adapters[apiMode];
}

export function messageDispatchWrapper(dispatch: AppDispatch) {
  const messageDispatch = (
    responseId: string,
    event:
      | ResponseStreamEvent
      | FunctionCallOutputCompletedEvent
      | FunctionCallOutputIncompleteEvent
  ) => {
    switch (event.type) {
      case "response.created":
        dispatch(addResponse({ ...event.response, timestamp: Date.now() }));
        break;

      default:
        dispatch(reduceEvent({ id: responseId, event }));
        break;
    }
  };

  return messageDispatch;
}

export interface SearchResults {
  items: Array<{
    title: string;
    htmlTitle: string;
    link: string;
    formattedUrl: string;
    htmlFormattedUrl: string;
    snippet: string;
  }>;
}

function formatSearchResults(items: SearchResults) {
  // Markdown format
  return items.items
    .map(
      (item) =>
        `- [${item.title}](${item.link})\n\n  ${item.snippet.replace(
          /<[^>]+>/g,
          ""
        )}`
    )
    .join("\n");
}

async function callFunction({
  name,
  args,
  signal,
}: {
  name: string;
  args: string;
  signal: AbortSignal;
}) {
  switch (name) {
    case "run_python":
      const pythonCode = JSON.parse(args).code;
      const res = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        body: JSON.stringify({
          language: "python3",
          version: "3.10",
          files: [{ name: "main.py", content: pythonCode }],
        }),
        headers: { "Content-Type": "application/json" },
        signal,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      return res.text();

    case "google_search":
      const query = JSON.parse(args).query;
      const searchRes = await fetch(
        `/api/search?${new URLSearchParams({ q: query })}`,
        { signal }
      );
      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        throw new Error(errorText);
      }
      const searchBody: SearchResults = await searchRes.json();
      return formatSearchResults(searchBody);

    default:
      throw new Error(`Unknown function name: ${name}`);
  }
}

async function handleFunctionCall({
  message,
  signal,
}: {
  message: ResponseFunctionToolCall;
  signal: AbortSignal;
}) {
  try {
    const output = await callFunction({
      name: message.name,
      args: message.arguments,
      signal,
    });
    const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
      type: "function_call_output",
      call_id: message.call_id,
      output: output,
      status: "completed",
    };
    return toolCallOutputMessage;
  } catch (error) {
    const toolCallErrorMessage: ResponseInputItem.FunctionCallOutput = {
      type: "function_call_output",
      call_id: message.call_id,
      output: (error as Error).message,
      status: "incomplete",
    };
    return toolCallErrorMessage;
  }
}

export const requestFunctionCall = createAppAsyncThunk(
  "app/requestFunctionCall",
  async (message: ResponseFunctionToolCall, thunkAPI) => {
    const { dispatch, signal } = thunkAPI;
    const outputMessage = await handleFunctionCall({
      message,
      signal,
    });
    dispatch(addMessage(outputMessage));
  }
);

export function normMessage(message: ChatMessage): ResponseInputItem[] {
  if (
    message.object === "message" ||
    message.object === "function_call_output"
  ) {
    const { id, timestamp, object, ...rest } = message;
    return [rest as ResponseInputItem];
  }
  return message.output.map((item) => {
    if (item.type !== "reasoning") {
      if (item.type !== "message") return item;
      const { content, ...rest } = item;
      const newContent = content.map((part) => {
        if (part.type === "output_text")
          // vLLM returns null for logprobs which causes issues
          return { ...part, logprobs: part.logprobs ?? undefined };
        else return part;
      });
      return { content: newContent, ...rest };
    }
    const { status, ...rest } = item;
    return rest;
  });
}

export const requestAssistant = createAppAsyncThunk(
  "app/requestAssistant",
  async (
    {
      messages,
      options,
    }: {
      messages: ChatMessage[];
      options?: CreateResponseParams;
    },
    thunkAPI
  ) => {
    const { dispatch, getState, signal } = thunkAPI;
    const presets = getState().presets;
    const preset = presets.presets?.[presets.current!];
    if (!preset) throw new Error("No preset selected");
    const messageDispatch = messageDispatchWrapper(dispatch);
    try {
      const currentMessages = messages;

      const MAX_TOOL_CALLS = 5;
      for (let i = 0; i < MAX_TOOL_CALLS; i++) {
        const requestAPI = getRequestAPI(preset.apiMode ?? "responses");

        const response = await requestAPI(
          currentMessages.flatMap(normMessage),
          {
            apiKey: preset.apiKey,
            baseURL: preset.baseURL,
            signal,
            onStreamEvent: messageDispatch,
            ...options,
            model: options?.model ?? preset.defaultModel,
            temperature: options?.temperature ?? preset.temperature,
          }
        );

        currentMessages.push({ ...response, timestamp: Date.now() });

        let hasNewFunctionCall = false;
        for (const item of response.output) {
          switch (item.type) {
            case "function_call":
              const functionCallMessage = await handleFunctionCall({
                message: item,
                signal,
              });
              const newMessage = dispatch(addMessage(functionCallMessage));
              currentMessages.push(newMessage.payload);
              hasNewFunctionCall = true;
              break;
          }
        }

        if (!hasNewFunctionCall) break;
      }
    } catch (error) {
      dispatch(
        addResponse({
          object: "response",
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          error: {
            code: "server_error",
            message: (error as Error).message,
          },
          output: [],
        } as unknown as Response & { timestamp: number })
      );
    }
  }
);

export const requestSearch = createAppAsyncThunk(
  "app/requestSearch",
  async (messages: ChatMessage[], thunkAPI) => {
    const { dispatch, signal } = thunkAPI;
    const lastMessage = messages[
      messages.length - 1
    ] as ResponseInputItem.Message;
    const part = lastMessage.content[0] as ResponseInputText;
    const query = part.text;

    const callId = crypto.randomUUID();
    const toolCallMessage: ResponseFunctionToolCall = {
      id: crypto.randomUUID(),
      type: "function_call",
      call_id: callId,
      name: "search",
      arguments: JSON.stringify({ query }),
      status: "completed",
    };
    dispatch(
      addResponse({
        object: "response",
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        created_at: Math.floor(Date.now() / 1000),
        error: null,
        output: [toolCallMessage],
      } as Response & { timestamp: number })
    );

    try {
      const response = await fetch(
        `/api/search?${new URLSearchParams({ q: query })}`,
        { signal }
      );
      const body = await response.json();
      const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(body.items),
        status: "completed",
      };
      dispatch(addMessage(toolCallOutputMessage));
    } catch (error) {
      const toolCallErrorMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: (error as Error).message,
        status: "incomplete",
      };
      dispatch(addMessage(toolCallErrorMessage));
    }
  }
);

export const requestSearchImage = createAppAsyncThunk(
  "app/requestSearchImage",
  async (messages: ChatMessage[], thunkAPI) => {
    const { dispatch } = thunkAPI;

    const lastMessage = messages[
      messages.length - 1
    ] as ResponseInputItem.Message;
    const part = lastMessage.content[0] as ResponseInputText;
    const query = part.text;

    const callId = crypto.randomUUID();
    const toolCallMessage: ResponseFunctionToolCall = {
      id: crypto.randomUUID(),
      type: "function_call",
      call_id: callId,
      name: "search_image",
      arguments: JSON.stringify({ query }),
      status: "completed",
    };
    dispatch(
      addResponse({
        object: "response",
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        created_at: Math.floor(Date.now() / 1000),
        error: null,
        output: [toolCallMessage],
      } as Response & { timestamp: number })
    );

    try {
      const response = await fetch(
        `/api/search?${new URLSearchParams({ q: query, searchType: "image" })}`
      );
      const body = await response.json();
      const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(body.items),
        status: "completed",
      };
      dispatch(addMessage(toolCallOutputMessage));
    } catch (error) {
      const toolCallErrorMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: (error as Error).message,
        status: "incomplete",
      };
      dispatch(addMessage(toolCallErrorMessage));
    }
  }
);

export const requestGenerateImage = createAppAsyncThunk(
  "app/requestGenerateImage",
  async (messages: ChatMessage[], thunkAPI) => {
    const { dispatch, getState, signal } = thunkAPI;
    const presets = getState().presets;
    const preset = presets.presets?.[presets.current!];

    try {
      const client = new OpenAI({
        apiKey: preset.apiKey,
        baseURL:
          preset?.baseURL ||
          new URL("/api/v1", window.location.href).toString(),
        dangerouslyAllowBrowser: true,
      });
      const response = await client.responses.create(
        {
          model: "gpt-5-nano",
          input: messages.flatMap(normMessage),
          tools: [
            {
              type: "image_generation",
              moderation: "low",
              quality: preset.imageQuality,
            },
          ],
          tool_choice: "required",
        },
        { signal }
      );

      dispatch(addResponse({ ...response, timestamp: Date.now() }));
    } catch (error) {
      dispatch(
        addResponse({
          object: "response",
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          error: {
            code: "server_error",
            message: (error as Error).message,
          },
          output: [],
        } as unknown as Response & { timestamp: number })
      );
    }
  }
);

export const requestCreateResearch = createAppAsyncThunk(
  "app/requestCreateResearch",
  async (task: string, thunkAPI) => {
    const { dispatch, signal } = thunkAPI;
    const response = await fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ instructions: task }),
      headers: { "Content-Type": "application/json" },
      signal,
    });
    const { id } = await response.json();

    dispatch(
      addMessage({
        type: "web_search_call",
        id,
        status: "in_progress",
      } as ResponseFunctionWebSearch)
    );
  }
);
