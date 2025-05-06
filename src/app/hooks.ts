import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { set as setConversations } from "./conversations";
import "./opfs-polyfill";
import store, { AppDispatch, AppState } from "./store";

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

store.subscribe(async () => {
  const { apiKey, baseURL, ...rest } = store.getState().provider;

  if (apiKey) window.localStorage.setItem("OPENAI_API_KEY", apiKey);
  else window.localStorage.removeItem("OPENAI_API_KEY");

  if (baseURL) window.localStorage.setItem("OPENAI_BASE_URL", baseURL);
  else window.localStorage.removeItem("OPENAI_BASE_URL");

  window.localStorage.setItem("settings", JSON.stringify(rest));

  const debounedSave = debounce(async (conversations: any) => {
    try {
      const root = await navigator.storage.getDirectory();
      const content = JSON.stringify(conversations);
      if (content === "{}") {
        await root.removeEntry("conversations.json");
        return;
      }
      const fileHandle = await root.getFileHandle("conversations.json", {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content).finally(() => {
        writable.close();
      });
    } catch (err) {
      console.error(err instanceof Error ? err : new Error("Saving failed"));
    }
  }, 50);

  debounedSave(store.getState().conversations.conversations);
});
