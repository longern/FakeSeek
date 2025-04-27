import { configureStore } from "@reduxjs/toolkit";
import conversationsReducer from "./conversations";
import providerReducer from "./provider";

const store = configureStore({
  reducer: {
    conversations: conversationsReducer,
    provider: providerReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;

export default store;
