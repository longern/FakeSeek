import { createSlice } from "@reduxjs/toolkit";

export type Settings = {
  language?: string;
};

export const SETTINGS_KEY = "fakeSeek:settings";

const storedSettings = JSON.parse(
  window.localStorage.getItem(SETTINGS_KEY) || "{}"
) as Settings;

export const settingsSlice = createSlice({
  name: "settings",
  initialState: storedSettings,
  reducers: {
    patch(state, { payload }: { payload: { settings: Partial<Settings> } }) {
      Object.assign(state, payload.settings);
    },
  },
});

export const { patch } = settingsSlice.actions;

export default settingsSlice.reducer;
