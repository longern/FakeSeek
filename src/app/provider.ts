import { createSlice } from "@reduxjs/toolkit";

export const providerSlice = createSlice({
  name: "provider",
  initialState: {
    apiKey: window.localStorage.getItem("OPENAI_API_KEY") || "",
    baseURL: window.localStorage.getItem("OPENAI_BASE_URL") || "",
  },
  reducers: {
    setApiKey: (state, { payload }: { payload: string }) => {
      state.apiKey = payload;
    },
    setBaseURL: (state, { payload }: { payload: string }) => {
      state.baseURL = payload;
    },
  },
});

export const { setApiKey, setBaseURL } = providerSlice.actions;

export default providerSlice.reducer;
