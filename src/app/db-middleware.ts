import {
  createAsyncThunk,
  isAction,
  Middleware,
  PayloadAction,
} from "@reduxjs/toolkit";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";

import { initializeAction } from "./actions";
import { add as addConversation, conversationsSlice } from "./conversations";
import { db } from "./db";
import {
  add as addMessage,
  addReasoningSummaryPart,
  addResponse,
  ChatMessage,
  codeInterpreterCallCodeDelta,
  contentPartAdded,
  contentPartDelta,
  contentPartDone,
  functionCallArgumentsDelta,
  mcpCallArgumentsDelta,
  messagesSlice,
  outputItemAdded,
  outputItemDone,
  reasoningSummaryTextDelta,
  reasoningTextDelta,
  set as setMessages,
} from "./messages";
import type { AppState } from "./store";

const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const debouncedSave = debounce((message: ChatMessage) => {
  if (!message.id) return;
  db.messages.update(message.id, message);
}, 50);

type ValueOf<T> = T[keyof T];
type ConversationActions =
  | ReturnType<ValueOf<typeof conversationsSlice.actions>>
  | ReturnType<typeof addConversation>;
type MessageActions =
  | ReturnType<ValueOf<typeof messagesSlice.actions>>
  | ReturnType<typeof addMessage>;

const isAppAction = (
  action: unknown
): action is ConversationActions | MessageActions | typeof initializeAction => {
  return isAction(action);
};

function generateTitle(message: ResponseInputItem.Message): string {
  const DEFAULT_TITLE = "New Chat";
  const textContent = message.content.find(
    (part) => part.type === "input_text"
  )?.text;
  return textContent ? textContent.slice(0, 15) : DEFAULT_TITLE;
}

export const addMessageThunk = createAsyncThunk<
  PayloadAction<ChatMessage>,
  ResponseInputItem.Message,
  { state: AppState }
>("messages/add", async (message, { dispatch, getState }) => {
  if (!getState().conversations.current) {
    dispatch(
      addConversation({
        title: generateTitle(message),
      })
    );
  }
  return dispatch(addMessage(message));
});

export const dbMiddleware: Middleware<{}, AppState> =
  (store) => (next) => (action) => {
    const state = store.getState();
    if (!isAppAction(action)) return next(action);

    switch (action.type) {
      case initializeAction.type:
        db.conversations
          .orderBy("created_at")
          .toArray()
          .then((conversations) => {
            conversations.reverse();
            store.dispatch({
              type: "conversations/set",
              payload: Object.fromEntries(
                conversations.map((conversation) => [
                  conversation.id,
                  conversation,
                ])
              ),
            });
          });
        break;

      case "conversations/add": {
        db.conversations.add(action.payload);
        break;
      }

      case "conversations/remove": {
        const id = action.payload;
        db.conversations.delete(id);
        db.messages.where("conversation_id").equals(id).delete();
        break;
      }

      case "conversations/update": {
        const { id, patch } = action.payload;
        db.conversations.update(id, patch);
        break;
      }

      case "conversations/change": {
        const id = action.payload;
        if (!id) store.dispatch(setMessages({}));
        else {
          db.messages
            .where("conversation_id")
            .equals(id)
            .sortBy("timestamp")
            .then((messagesArray) => {
              const messages = Object.fromEntries(
                messagesArray.map((message) => {
                  const { conversation_id, ...rest } = message;
                  return [message.id, rest];
                })
              );
              store.dispatch(setMessages(messages));
            });
        }
        break;
      }

      case "messages/add":
      case addResponse.type: {
        const result = next(action);
        const conversation_id = state.conversations.current;
        if (!conversation_id) {
          console.error("No current conversation set for message addition.");
          break;
        }
        db.messages.add({ ...action.payload, conversation_id });
        return result;
      }

      case "messages/update":
        setTimeout(() => {
          const { id, patch } = action.payload;
          db.messages.update(id, patch);
        }, 50);
        break;

      case outputItemAdded.type:
      case outputItemDone.type:
      case contentPartAdded.type:
      case contentPartDelta.type:
      case contentPartDone.type:
      case reasoningTextDelta.type:
      case addReasoningSummaryPart.type:
      case reasoningSummaryTextDelta.type:
      case functionCallArgumentsDelta.type:
      case mcpCallArgumentsDelta.type:
      case codeInterpreterCallCodeDelta.type: {
        const result = next(action);
        const responseId = action.payload.responseId;
        const message = store.getState().messages.messages[responseId];
        if (!message) {
          console.error("Message not found in state:", responseId);
          return result;
        }
        debouncedSave(message);
        return result;
      }

      case "messages/remove": {
        const id = action.payload;
        db.messages.delete(id);
        break;
      }
    }

    return next(action);
  };
