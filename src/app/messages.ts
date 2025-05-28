import { createAction, createSlice } from "@reduxjs/toolkit";
import {
  Response,
  ResponseCodeInterpreterCallCodeDeltaEvent,
  ResponseContentPartAddedEvent,
  ResponseContentPartDoneEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseInputItem,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses.mjs";

export type ChatMessage = (
  | (ResponseInputItem.Message & {
      id: string;
      object: "message";
    })
  | (ResponseInputItem.FunctionCallOutput & {
      id: string;
      object: "function_call_output";
    })
  | Response
) & { timestamp: number };

export const add = createAction(
  "messages/add",
  (
    action: ResponseInputItem.Message | ResponseInputItem.FunctionCallOutput
  ) => {
    const id: string = crypto.randomUUID();
    const timestamp = Date.now();
    return {
      payload: {
        id,
        timestamp,
        object: action.type ?? "message",
        ...action,
      } as ChatMessage,
    };
  }
);

export const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    messages: {} as Record<string, ChatMessage>,
  },
  reducers: {
    set: (state, { payload }: { payload: Record<string, ChatMessage> }) => {
      state.messages = payload;
    },
    remove: (state, { payload }: { payload: string }) => {
      delete state.messages[payload];
    },
    update: (
      state,
      { payload }: { payload: { id: string; patch: Partial<ChatMessage> } }
    ) => {
      if (!state.messages[payload.id]) return;
      state.messages[payload.id] = {
        ...state.messages[payload.id],
        ...payload.patch,
      } as ChatMessage;
    },

    addResponse: (
      state,
      { payload }: { payload: Response & { timestamp: number } }
    ) => {
      if (payload.object !== "response") return;
      state.messages[payload.id] = payload;
    },

    outputItemAdded: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseOutputItemAddedEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      response.output.push(payload.event.item);
    },

    outputItemDone: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseOutputItemDoneEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const outputIndex = payload.event.output_index;
      const item = structuredClone(payload.event.item);

      if (item.type === "reasoning") item.status ??= "completed";

      response.output[outputIndex] = item;
    },

    contentPartAdded: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseContentPartAddedEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message?.type !== "message" || message.role !== "assistant") return;
      message.content.push(payload.event.part);
    },

    contentPartDelta: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseTextDeltaEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message?.type !== "message" || message.role !== "assistant") return;
      const part = message.content[payload.event.content_index];
      if (part?.type !== "output_text") return;
      part.text += payload.event.delta;
    },

    contentPartDone: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseContentPartDoneEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message.type !== "message") return;
      message.content[payload.event.content_index] = payload.event.part;
    },

    addReasoningSummaryPart: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseReasoningSummaryPartAddedEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message?.type !== "reasoning") return;
      message.summary.push(payload.event.part);
    },

    reasoningSummaryTextDelta: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseReasoningSummaryTextDeltaEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message.type !== "reasoning") return;
      const part = message.summary[payload.event.summary_index];
      if (!part) return;
      part.text += payload.event.delta;
    },

    functionCallArgumentsDelta: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseFunctionCallArgumentsDeltaEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message?.type !== "function_call") return;
      message.arguments += payload.event.delta;
    },

    codeInterpreterCallCodeDelta: (
      state,
      {
        payload,
      }: {
        payload: {
          responseId: string;
          event: ResponseCodeInterpreterCallCodeDeltaEvent;
        };
      }
    ) => {
      const response = state.messages[payload.responseId];
      if (response.object !== "response") return;
      const message = response.output[payload.event.output_index];
      if (message?.type !== "code_interpreter_call") return;
      message.code += payload.event.delta;
    },
  },

  extraReducers: (builder) => {
    builder.addCase(add, (state, { payload }) => {
      state.messages[payload.id!] = payload;
    });
  },
});

export const {
  remove,
  set,
  update,
  addResponse,
  outputItemAdded,
  outputItemDone,
  contentPartAdded,
  contentPartDelta,
  contentPartDone,
  addReasoningSummaryPart,
  reasoningSummaryTextDelta,
  functionCallArgumentsDelta,
  codeInterpreterCallCodeDelta,
} = messagesSlice.actions;

export default messagesSlice.reducer;
