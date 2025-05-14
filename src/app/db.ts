import Dexie from "dexie";

import { ChatMessage } from "./messages";

export const db = new Dexie("ChatHistory") as Dexie & {
  conversations: Dexie.Table<{
    id: string;
    created_at: number;
    title: string;
  }>;
  messages: Dexie.Table<
    {
      id: string;
      created_at: number;
      conversation_id: string;
    } & ChatMessage
  >;
};

db.version(1).stores({
  conversations: "id, created_at, title",
  messages: "id, created_at, conversation_id",
});
