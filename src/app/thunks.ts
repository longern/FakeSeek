import OpenAI from "openai";
import {
  Response,
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseInputText,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";

import {
  contentPartAdded,
  add as addMessage,
  addReasoningSummaryPart,
  addResponse,
  ChatMessage,
  codeInterpreterCallCodeDelta,
  contentPartDelta,
  contentPartDone,
  functionCallArgumentsDelta,
  outputItemAdded,
  reasoningSummaryTextDelta,
  update as updateMessage,
  outputItemDone,
} from "./messages";
import { AppDispatch, createAppAsyncThunk } from "./store";

interface FunctionCallOutputCompletedEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.completed";
}

interface FunctionCallOutputIncompleteEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.incomplete";
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

      case "response.completed":
        dispatch(
          updateMessage({
            id: event.response.id,
            patch: {
              status: event.response.status,
              usage: event.response.usage,
            },
          })
        );
        break;

      case "response.output_item.added":
        dispatch(outputItemAdded({ responseId, event }));
        break;

      case "response.output_item.done": {
        dispatch(outputItemDone({ responseId, event }));
        break;
      }

      case "response.content_part.added":
        dispatch(contentPartAdded({ responseId, event }));
        break;

      case "response.content_part.done":
        dispatch(contentPartDone({ responseId, event }));
        break;

      case "response.output_text.delta":
        dispatch(contentPartDelta({ responseId, event }));
        break;

      case "response.reasoning_summary_part.added":
        dispatch(addReasoningSummaryPart({ responseId, event }));
        break;

      case "response.reasoning_summary_text.delta":
        dispatch(reasoningSummaryTextDelta({ responseId, event }));
        break;

      case "response.function_call_arguments.delta":
        dispatch(functionCallArgumentsDelta({ responseId, event }));
        break;

      case "response.functioin_call_output.completed":
        dispatch(
          updateMessage({
            id: event.item.id!,
            patch: { status: "completed", output: event.item.output },
          })
        );
        break;

      case "response.functioin_call_output.incomplete":
        dispatch(
          updateMessage({
            id: event.item.id!,
            patch: { status: "incomplete", output: event.item.output },
          })
        );
        break;

      case "response.code_interpreter_call_code.delta":
        dispatch(codeInterpreterCallCodeDelta({ responseId, event }));
        break;
    }
  };

  return messageDispatch;
}

export type CreateResponseParams = { model?: string; tools?: Tool[] };

async function streamRequestAssistant(
  messages: ResponseInputItem[],
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
  const model =
    options?.model ??
    (messages.some((m) => m.type === "reasoning") ? "o4-mini" : "gpt-4.1-nano");
  const response = await client.responses.create(
    {
      model: model,
      input: messages,
      stream: true,
      reasoning: model.startsWith("o") ? { summary: "detailed" } : undefined,
      tools: options?.tools,
    },
    { signal: options?.signal }
  );

  let result: Response;
  for await (const chunk of response) {
    if (chunk.type === "response.created") result = chunk.response;
    options?.onStreamEvent?.(result!.id, chunk);
    if (chunk.type === "response.completed") result = chunk.response;
  }

  return result!;
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

function normMessage(message: ChatMessage): ResponseInputItem[] {
  if (
    message.object === "message" ||
    message.object === "function_call_output"
  ) {
    const { id, timestamp, object, ...rest } = message;
    return [rest as ResponseInputItem];
  }
  return message.output;
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
    const provider = getState().provider;
    const messageDispatch = messageDispatchWrapper(dispatch);
    try {
      const currentMessages = messages;

      const MAX_TOOL_CALLS = 5;
      for (let i = 0; i < MAX_TOOL_CALLS; i++) {
        const response = await streamRequestAssistant(
          currentMessages.flatMap(normMessage),
          {
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
            signal,
            onStreamEvent: messageDispatch,
            ...options,
          }
        );

        currentMessages.push({ ...response, timestamp: Date.now() });
        const lastMessage = response.output[response.output.length - 1];
        if (lastMessage.type !== "function_call") break;
        const functionCallMessage = await handleFunctionCall({
          message: lastMessage,
          signal,
        });
        const newMessage = dispatch(addMessage(functionCallMessage));
        currentMessages.push(newMessage.payload);
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
    const provider = getState().provider;

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL:
        provider?.baseURL ||
        new URL("/api/v1", window.location.href).toString(),
      dangerouslyAllowBrowser: true,
    });
    const response = await client.responses.create(
      {
        model: "gpt-4.1-nano",
        input: messages.flatMap(normMessage),
        tools: [
          {
            type: "image_generation",
            moderation: "low",
            quality: provider.imageQuality,
          },
        ],
        tool_choice: "required",
      },
      { signal }
    );

    dispatch(addResponse({ ...response, timestamp: Date.now() }));
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
