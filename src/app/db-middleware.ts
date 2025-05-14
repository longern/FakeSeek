import { isAction, Middleware, PayloadAction } from "@reduxjs/toolkit";

import {
  add as addConversation,
  change as changeConversation,
  Conversation,
  conversationsSlice,
} from "./conversations";
import { db } from "./db";
import {
  addContentPart,
  addReasoningSummaryPart,
  ChatMessage,
  contentPartDelta,
  messagesSlice,
  reasoningSummaryTextDelta,
  set as setMessages,
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
type MessageActions = ReturnType<ValueOf<typeof messagesSlice.actions>>;

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

export const dbMiddleware: Middleware<{}, AppState> =
  (store) => (next) => async (action) => {
    const state = store.getState();
    if (!isAppAction(action)) return next(action);

    switch (action.type) {
      case initializeAction.type:
        const conversations = await db.conversations
          .orderBy("created_at")
          .toArray();
        conversations.reverse();
        store.dispatch({
          type: "conversations/set",
          payload: Object.fromEntries(
            conversations.map((conversation) => [conversation.id, conversation])
          ),
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
          const messagesArray = await db.messages
            .where("conversation_id")
            .equals(id)
            .sortBy("created_at");
          const messages = Object.fromEntries(
            messagesArray.map((message) => {
              const { conversation_id, created_at, ...rest } = message;
              return [message.id, rest];
            })
          );
          store.dispatch(setMessages(messages));
        }
        break;
      }

      case "messages/add": {
        let conversation_id = state.conversations.current;
        if (!conversation_id) {
          const title = generateTitle(action.payload as ChatMessage);
          const newConversation = await (store.dispatch(
            addConversation({ title })
          ) as unknown as Promise<PayloadAction<Conversation>>);
          conversation_id = newConversation.payload.id;
          await store.dispatch(changeConversation(conversation_id));
        }
        const message = {
          ...action.payload,
          id: action.payload.id || crypto.randomUUID(),
          created_at: Date.now(),
          conversation_id,
        } as ChatMessage & {
          id: string;
          created_at: number;
          conversation_id: string;
        };
        db.messages.add(message);
        return next(action);
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
      case reasoningSummaryTextDelta.type: {
        const result = next(action);
        const itemId = action.payload.item_id;
        const message = state.messages.messages[itemId];
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
