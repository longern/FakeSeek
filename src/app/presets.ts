import { createSlice } from "@reduxjs/toolkit";

export type Preset = {
  presetName: string;
  apiMode?: "chat-completion";
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  temperature?: number;
  toolsProvider?: "openai-builtin";
  imageQuality?: "low" | "medium" | "high";
};

const storedPresets = JSON.parse(
  window.localStorage.getItem("presets") || "{}"
) as { presets: Record<string, Preset>; current: string | null };

storedPresets.presets = storedPresets.presets || {};
storedPresets.current = storedPresets.current ?? null;

export const presetsSlice = createSlice({
  name: "presets",
  initialState: storedPresets,
  reducers: {
    patch(
      state,
      { payload }: { payload: { presetId: string; preset: Partial<Preset> } }
    ) {
      state.presets[payload.presetId] = {
        ...(state.presets[payload.presetId] ?? {}),
        ...payload.preset,
      };
    },
    remove(state, { payload }: { payload: { presetId: string } }) {
      delete state.presets[payload.presetId];
    },
    setCurrent(state, { payload }: { payload: string | null }) {
      state.current = payload;
    },
  },
});

export const { patch, remove, setCurrent } = presetsSlice.actions;

export default presetsSlice.reducer;
