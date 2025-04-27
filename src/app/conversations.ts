import { createSlice } from "@reduxjs/toolkit";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";

type ExcludeEasy<T> = T extends { content: infer A }
  ? A extends string
    ? never
    : T
  : T;
export type ChatMessage = ExcludeEasy<ResponseInputItem>;

export interface Conversation {
  id: string;
  title: string;
  create_time: number;
  messages: ChatMessage[];
}

export const counterSlice = createSlice({
  name: "conversations",
  initialState: {
    conversations: {} as Record<string, Conversation>,
  },
  reducers: {
    set: (state, { payload }: { payload: Record<string, Conversation> }) => {
      state.conversations = payload;
    },
    add: (state, { payload }: { payload: Conversation }) => {
      state.conversations[payload.id] = payload;
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

export const { add, remove, set, update } = counterSlice.actions;

export default counterSlice.reducer;
