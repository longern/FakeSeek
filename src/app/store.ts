import {
  combineReducers,
  configureStore,
  createAsyncThunk,
} from "@reduxjs/toolkit";

import { initializeAction } from "./actions";
import conversationsReducer from "./conversations";
import { dbMiddleware } from "./db-middleware";
import messagesReducer from "./messages";
import presetsReducer from "./presets";
import settingsReducer from "./settings";

const rootReducer = combineReducers({
  conversations: conversationsReducer,
  messages: messagesReducer,
  presets: presetsReducer,
  settings: settingsReducer,
});

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(dbMiddleware),
});

export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof rootReducer>;

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: AppState;
  dispatch: AppDispatch;
}>();

store.dispatch(initializeAction());

export default store;
