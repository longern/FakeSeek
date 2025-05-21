import {
  combineReducers,
  configureStore,
  createAction,
  createAsyncThunk,
} from "@reduxjs/toolkit";

import conversationsReducer from "./conversations";
import messagesReducer from "./messages";
import providerReducer from "./provider";
import { dbMiddleware } from "./db-middleware";

const rootReducer = combineReducers({
  conversations: conversationsReducer,
  messages: messagesReducer,
  provider: providerReducer,
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

export const initializeAction = createAction("app/initialize");

store.dispatch(initializeAction());

export default store;
