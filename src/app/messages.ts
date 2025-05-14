import { createSlice } from "@reduxjs/toolkit";
import {
  ResponseComputerToolCall,
  ResponseContentPartAddedEvent,
  ResponseFileSearchToolCall,
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses.mjs";

// Exclude EasyInputMessage
export type ChatMessage =
  | (ResponseInputItem.Message & { id: string })
  | ResponseOutputMessage
  | ResponseFileSearchToolCall
  | ResponseComputerToolCall
  | ResponseInputItem.ComputerCallOutput
  | ResponseFunctionWebSearch
  | ResponseFunctionToolCall
  | ResponseInputItem.FunctionCallOutput
  | ResponseReasoningItem
  | ResponseInputItem.ItemReference;

export const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    messages: {} as Record<string, ChatMessage>,
  },
  reducers: {
    set: (state, { payload }: { payload: Record<string, ChatMessage> }) => {
      state.messages = payload;
    },
    add: (
      state,
      { payload }: { payload: Omit<ChatMessage, "id"> & { id?: string | null } }
    ) => {
      state.messages[payload.id!] = payload as ChatMessage;
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
  },
});

export const {
  add,
  remove,
  set,
  update,
  addContentPart,
  contentPartDelta,
  addReasoningSummaryPart,
  reasoningSummaryTextDelta,
} = messagesSlice.actions;

export default messagesSlice.reducer;
