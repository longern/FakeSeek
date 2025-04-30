import { createSlice } from "@reduxjs/toolkit";
import {
  ResponseComputerToolCall,
  ResponseFileSearchToolCall,
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
} from "openai/resources/responses/responses.mjs";

// Exclude EasyInputMessage
export type ChatMessage =
  | ResponseInputItem.Message
  | ResponseOutputMessage
  | ResponseFileSearchToolCall
  | ResponseComputerToolCall
  | ResponseInputItem.ComputerCallOutput
  | ResponseFunctionWebSearch
  | ResponseFunctionToolCall
  | ResponseInputItem.FunctionCallOutput
  | ResponseReasoningItem
  | ResponseInputItem.ItemReference;

export interface Conversation {
  id: string;
  title: string;
  create_time: number;
  messages: ChatMessage[];
}

export const conversationsSlice = createSlice({
  name: "conversations",
  initialState: {
    conversations: {} as Record<string, Conversation>,
  },
  reducers: {
    set: (state, { payload }: { payload: Record<string, Conversation> }) => {
      state.conversations = payload;
    },
    add: (state, { payload }: { payload: Conversation }) => {
      state.conversations = { [payload.id]: payload, ...state.conversations };
    },
    remove: (state, { payload }: { payload: string }) => {
      delete state.conversations[payload];
    },
    update: (
      state,
      { payload }: { payload: { id: string; patch: Partial<Conversation> } }
    ) => {
      if (!state.conversations[payload.id]) return;
      state.conversations[payload.id] = {
        ...state.conversations[payload.id],
        ...payload.patch,
      };
    },
  },
});

export const { add, remove, set, update } = conversationsSlice.actions;

export default conversationsSlice.reducer;
