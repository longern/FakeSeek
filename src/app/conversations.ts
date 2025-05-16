import { createAction, createSlice } from "@reduxjs/toolkit";

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
}

export const add = createAction(
  "conversations/add",
  (action: { title: string }) => {
    const id: string = crypto.randomUUID();
    const created_at = Date.now();
    return {
      payload: {
        id,
        title: action.title,
        created_at,
      },
    };
  }
);

export const conversationsSlice = createSlice({
  name: "conversations",
  initialState: {
    conversations: {} as Record<string, Conversation>,
    current: null as string | null,
  },
  reducers: {
    set: (state, { payload }: { payload: Record<string, Conversation> }) => {
      state.conversations = payload;
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
    change: (state, { payload }: { payload: string | null | undefined }) => {
      if (state.current === payload) return;
      state.current = payload ?? null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(add, (state, { payload }) => {
      state.conversations = {
        [payload.id]: payload,
        ...state.conversations,
      };
      state.current = payload.id;
    });
  },
});

export const { remove, set, update, change } = conversationsSlice.actions;

export default conversationsSlice.reducer;
