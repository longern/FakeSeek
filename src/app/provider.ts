import { createSlice } from "@reduxjs/toolkit";

const settings = JSON.parse(
  window.localStorage.getItem("settings") || "{}"
) as {
  imageQuality: "low" | "medium" | "high";
};

export const providerSlice = createSlice({
  name: "provider",
  initialState: {
    apiKey: window.localStorage.getItem("OPENAI_API_KEY") || "",
    baseURL: window.localStorage.getItem("OPENAI_BASE_URL") || "",
    imageQuality: settings.imageQuality || "medium",
  },
  reducers: {
    setApiKey: (state, { payload }: { payload: string }) => {
      state.apiKey = payload;
    },
    setBaseURL: (state, { payload }: { payload: string }) => {
      state.baseURL = payload;
    },
    setImageQuality: (
      state,
      { payload }: { payload: typeof state.imageQuality }
    ) => {
      state.imageQuality = payload;
    },
  },
});

export const { setApiKey, setBaseURL, setImageQuality } = providerSlice.actions;

export default providerSlice.reducer;
