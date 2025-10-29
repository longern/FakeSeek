import { createAction, createSlice } from "@reduxjs/toolkit";
import {
  Response,
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import responseReducer, {
  FunctionCallOutputCompletedEvent,
  FunctionCallOutputIncompleteEvent,
} from "./reducer";

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

    reduceEvent: (
      state,
      {
        payload,
      }: {
        payload: {
          id: string;
          event:
            | ResponseStreamEvent
            | FunctionCallOutputCompletedEvent
            | FunctionCallOutputIncompleteEvent;
        };
      }
    ) => {
      const response = state.messages[payload.id];
      if (response.object !== "response") return;
      const newResponse = responseReducer(response, payload.event);
      state.messages[payload.id] = Object.assign(newResponse, {
        timestamp: response.timestamp,
      });
    },

    patch: (
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
  },

  extraReducers: (builder) => {
    builder.addCase(add, (state, { payload }) => {
      state.messages[payload.id!] = payload;
    });
  },
});

export const { remove, set, reduceEvent, patch, addResponse } =
  messagesSlice.actions;

export default messagesSlice.reducer;
