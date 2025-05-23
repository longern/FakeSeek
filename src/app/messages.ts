import { createAction, createSlice } from "@reduxjs/toolkit";
import {
  ResponseContentPartAddedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseInputItem,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses.mjs";

type ExcludeEasy<T> = T extends { content: infer C }
  ? string extends C
    ? never
    : T
  : T;
export type ChatMessage = ExcludeEasy<ResponseInputItem> & {
  id: string;
  created_at: number;
};

export const add = createAction(
  "messages/add",
  (action: Omit<ChatMessage, "id" | "created_at"> & { id?: string | null }) => {
    const id: string = crypto.randomUUID();
    const created_at = Date.now();
    return {
      payload: {
        id,
        created_at,
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

    addContentPart: (
      state,
      {
        payload,
      }: {
        payload: ResponseContentPartAddedEvent;
      }
    ) => {
      const message = state.messages[payload.item_id];
      if (message?.type !== "message" || message.role !== "assistant") return;
      message.content.push(payload.part);
    },

    contentPartDelta: (
      state,
      {
        payload,
      }: {
        payload: ResponseTextDeltaEvent;
      }
    ) => {
      const message = state.messages[payload.item_id];
      if (message?.type !== "message" || message.role !== "assistant") return;
      const part = message.content[payload.content_index];
      if (part?.type !== "output_text") return;
      part.text += payload.delta;
    },

    addReasoningSummaryPart: (
      state,
      {
        payload,
      }: {
        payload: ResponseReasoningSummaryPartAddedEvent;
      }
    ) => {
      const message = state.messages[payload.item_id];
      if (message?.type !== "reasoning") return;
      message.summary.push(payload.part);
    },

    reasoningSummaryTextDelta: (
      state,
      {
        payload,
      }: {
        payload: ResponseReasoningSummaryTextDeltaEvent;
      }
    ) => {
      const id = payload.item_id;
      if (!state.messages[id]) return;
      const message = state.messages[id];
      if (message.type !== "reasoning") return;
      const part = message.summary[payload.summary_index];
      if (!part) return;
      part.text += payload.delta;
    },

    functionCallArgumentsDelta: (
      state,
      {
        payload,
      }: {
        payload: ResponseFunctionCallArgumentsDeltaEvent;
      }
    ) => {
      const message = state.messages[payload.item_id];
      if (message?.type !== "function_call") return;
      message.arguments += payload.delta;
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
  addContentPart,
  contentPartDelta,
  addReasoningSummaryPart,
  reasoningSummaryTextDelta,
  functionCallArgumentsDelta,
} = messagesSlice.actions;

export default messagesSlice.reducer;
