import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

import store, { AppDispatch, AppState } from "./store";
import { set as setConversations } from "./conversations";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();

export function useInitialize() {
  const dispatch = useAppDispatch();

  async function initialize() {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle("conversations.json", {
      create: true,
    });
    const file = await fileHandle.getFile();

    if (file.size > 0) {
      const content = await file.text();
      const parsed = JSON.parse(content);
      dispatch(setConversations(parsed));
    }
  }

  useEffect(() => {
    initialize();
  }, [dispatch]);
}

store.subscribe(async () => {
  try {
    const root = await navigator.storage.getDirectory();
    const content = JSON.stringify(
      store.getState().conversations.conversations
    );
    if (content === "{}") {
      await root.removeEntry("conversations.json");
      return;
    }
    const fileHandle = await root.getFileHandle("conversations.json", {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (err) {
    console.error(err instanceof Error ? err : new Error("Saving failed"));
  }
});
