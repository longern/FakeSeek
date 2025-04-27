import { configureStore } from "@reduxjs/toolkit";
import conversationsReducer from "./conversations";

const store = configureStore({
  reducer: {
    conversations: conversationsReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;

export default store;
