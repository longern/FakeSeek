import {
  createAsyncThunk,
  isAction,
  Middleware,
  PayloadAction,
} from "@reduxjs/toolkit";

import { add as addConversation, conversationsSlice } from "./conversations";
import { db } from "./db";
import {
  add as addMessage,
  addContentPart,
  addReasoningSummaryPart,
  ChatMessage,
  contentPartDelta,
  messagesSlice,
  reasoningSummaryTextDelta,
  set as setMessages,
  functionCallArgumentsDelta,
} from "./messages";
import { AppState, initializeAction } from "./store";

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
  db.messages.update(message.id, message as any);
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

function generateTitle(message: ChatMessage): string {
  const DEFAULT_TITLE = "New Chat";
  if (message.type !== "message" || message.role === "assistant")
    return DEFAULT_TITLE;
  const textContent = message.content.find(
    (part) => part.type === "input_text"
  )?.text;
  return textContent ? textContent.slice(0, 15) : DEFAULT_TITLE;
}

export const addMessageThunk = createAsyncThunk<
  ChatMessage,
  Omit<ChatMessage, "id" | "created_at">,
  { state: AppState }
>("messages/add", async (message, { dispatch, getState }) => {
  if (!getState().conversations.current) {
    dispatch(
      addConversation({
        title: generateTitle(message as ChatMessage),
      })
    ).payload;
  }
  const result = dispatch(addMessage(message));
  return result.payload;
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
            .sortBy("created_at")
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

      case "messages/add": {
        const result = next(action);
        let conversation_id = state.conversations.current;
        if (!conversation_id) {
          console.error("No current conversation set for message addition.");
          break;
        }
        db.messages.add({
          ...action.payload,
          id: action.payload.id || crypto.randomUUID(),
          created_at: Date.now(),
          conversation_id,
        });
        return result;
      }

      case "messages/update": {
        const { id, patch } = (
          action as PayloadAction<{
            id: string;
            patch: Partial<ChatMessage>;
          }>
        ).payload;
        db.messages.update(id, patch as any);
        break;
      }

      case addContentPart.type:
      case contentPartDelta.type:
      case addReasoningSummaryPart.type:
      case reasoningSummaryTextDelta.type:
      case functionCallArgumentsDelta.type: {
        const result = next(action);
        const itemId = action.payload.item_id;
        const message = store.getState().messages.messages[itemId];
        if (!message) {
          console.error("Message not found in state:", itemId);
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
