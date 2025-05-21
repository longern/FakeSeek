import {
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseInputMessageContentList,
  ResponseInputText,
  ResponseOutputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import OpenAI from "openai";
import { ImagesResponse } from "openai/resources.mjs";

import {
  add as addMessage,
  ChatMessage,
  addContentPart,
  addReasoningSummaryPart,
  contentPartDelta,
  reasoningSummaryTextDelta,
  update as updateMessage,
} from "./messages";
import { createAppAsyncThunk, AppDispatch } from "./store";

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
    event:
      | ResponseStreamEvent
      | FunctionCallOutputCompletedEvent
      | FunctionCallOutputIncompleteEvent
  ) => {
    switch (event.type) {
      case "response.output_item.added":
        dispatch(addMessage(event.item));
        break;

      case "response.output_item.done": {
        const eventStatus = event.item.status as
          | "completed"
          | "in_progress"
          | "incomplete"
          | undefined;
        const isReasoningCompleted =
          event.item.type === "reasoning" && eventStatus === undefined;
        const status = isReasoningCompleted ? "completed" : eventStatus;
        dispatch(updateMessage({ id: event.item.id!, patch: { status } }));
        break;
      }

      case "response.content_part.added": {
        dispatch(addContentPart(event));
        break;
      }

      case "response.output_text.delta": {
        dispatch(contentPartDelta(event));
        break;
      }

      case "response.reasoning_summary_part.added": {
        dispatch(addReasoningSummaryPart(event));
        break;
      }

      case "response.reasoning_summary_text.delta": {
        dispatch(reasoningSummaryTextDelta(event));
        break;
      }

      case "response.functioin_call_output.completed": {
        dispatch(
          updateMessage({
            id: event.item.id!,
            patch: { status: "completed", output: event.item.output },
          })
        );
        break;
      }

      case "response.functioin_call_output.incomplete": {
        dispatch(
          updateMessage({
            id: event.item.id!,
            patch: { status: "incomplete", output: event.item.output },
          })
        );
        break;
      }
    }
  };

  return messageDispatch;
}

async function streamRequestAssistant(
  messages: ChatMessage[],
  options?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    signal?: AbortSignal;
    onStreamEvent?: (event: ResponseStreamEvent) => void;
  }
) {
  const client = new OpenAI({
    apiKey: options?.apiKey,
    baseURL:
      options?.baseURL || new URL("/api/v1", window.location.href).toString(),
    dangerouslyAllowBrowser: true,
  });
  const model =
    options?.model ?? messages.some((m) => m.type === "reasoning")
      ? "o4-mini"
      : "gpt-4.1-nano";
  const normMessages = messages.map((message) => {
    if (
      message.type === "message" &&
      (message.role === "user" ||
        message.role === "developer" ||
        message.role === "system")
    ) {
      const { id, created_at, ...rest } = message;
      return rest as ResponseInputItem.Message;
    }
    const { created_at, ...rest } = message;
    return rest as ResponseInputItem;
  });
  const response = await client.responses.create(
    {
      model: model,
      input: normMessages,
      stream: true,
      reasoning: model.startsWith("o") ? { summary: "detailed" } : undefined,
    },
    { signal: options?.signal }
  );
  for await (const chunk of response) {
    options?.onStreamEvent?.(chunk);
  }

  return response;
}

export const requestAssistant = createAppAsyncThunk(
  "app/requestAssistant",
  async (
    {
      messages,
      options,
    }: { messages: ChatMessage[]; options?: { model?: string } },
    thunkAPI
  ) => {
    const { dispatch, getState, signal } = thunkAPI;
    const provider = getState().provider;
    const messageDispatch = messageDispatchWrapper(dispatch);
    try {
      await streamRequestAssistant(messages, {
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        model: options?.model,
        signal,
        onStreamEvent(event_1) {
          messageDispatch(event_1);
        },
      });
    } catch (error) {
      dispatch(
        addMessage({
          type: "message",
          role: "assistant",
          content: [{ type: "refusal", refusal: (error as Error).message }],
          status: "incomplete",
        } as ResponseOutputItem)
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
    dispatch(addMessage(toolCallMessage));

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
    dispatch(addMessage(toolCallMessage));

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
  }
);

export const requestGenerateImage = createAppAsyncThunk(
  "app/requestGenerateImage",
  async (content: ResponseInputMessageContentList, thunkAPI) => {
    const { dispatch, getState, signal } = thunkAPI;
    const provider = getState().provider;

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      dangerouslyAllowBrowser: true,
    });

    const callId = crypto.randomUUID();
    const prompt = content
      .filter((part) => part.type === "input_text")
      .map((part) => part.text)
      .join("\n");
    const toolCallMessage: ResponseFunctionToolCall = {
      id: crypto.randomUUID(),
      type: "function_call",
      call_id: callId,
      name: "generate_image",
      arguments: JSON.stringify({
        prompt,
        model: "gpt-image-1",
        quality: provider.imageQuality,
        moderation: "low",
      }),
      status: "completed",
    };
    dispatch(addMessage(toolCallMessage));

    const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
      id: crypto.randomUUID(),
      type: "function_call_output",
      call_id: callId,
      output: "",
      status: "in_progress",
    };
    dispatch(addMessage(toolCallOutputMessage));

    const messageDispatch = messageDispatchWrapper(dispatch);
    try {
      let response: ImagesResponse;

      if (content.length === 1 && content[0].type === "input_text") {
        response = await client.images.generate(
          {
            prompt: prompt,
            model: "gpt-image-1",
            quality: provider.imageQuality,
            moderation: "low",
          },
          { signal }
        );
      } else {
        const imageResponses = await Promise.all(
          content
            .filter((part) => part.type === "input_image")
            .map(async (part, index) => {
              const res = await fetch(part.image_url!);
              const blob = await res.blob();
              const file = new File([blob], `image_${index + 1}`, {
                type: blob.type,
              });
              return file;
            })
        );
        response = await client.images.edit(
          {
            image: imageResponses,
            prompt: prompt,
            model: "gpt-image-1",
            quality: provider.imageQuality,
          },
          { signal }
        );
      }

      messageDispatch({
        type: "response.functioin_call_output.completed",
        output_index: 0,
        item: {
          ...toolCallOutputMessage,
          status: "completed",
          output: JSON.stringify(response.data),
        },
      });
    } catch (error) {
      messageDispatch({
        type: "response.functioin_call_output.incomplete",
        output_index: 0,
        item: {
          ...toolCallOutputMessage,
          status: "incomplete",
          output: (error as Error).message,
        },
      });
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
