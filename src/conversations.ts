import { useState, useEffect, useCallback } from "react";

export function useConversations<T extends { id: string }>(fileKey: string) {
  const [conversations, setConversations] = useState<Record<string, T>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const persistConversations = useCallback(
    async (data: Record<string, T>) => {
      try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(fileKey, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data));
        await writable.close();
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Saving failed"));
      }
    },
    [fileKey]
  );

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(fileKey, { create: true });
        const file = await fileHandle.getFile();

        if (file.size > 0) {
          const content = await file.text();
          const parsed = JSON.parse(content);
          if (isMounted) setConversations(parsed);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Loading failed"));
          setConversations({});
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [fileKey]);

  const addConversation = useCallback(
    (item: T) => {
      setConversations((prev) => {
        const newMap = { ...prev, [item.id]: item };
        persistConversations(newMap);
        return newMap;
      });
    },
    [persistConversations]
  );

  const removeConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const newList = Object.fromEntries(
          Object.entries(prev).filter(([key]) => key !== id)
        );
        persistConversations(newList);
        return newList;
      });
    },
    [persistConversations]
  );

  const updateConversation = useCallback(
    (id: string, newItem: T | ((prev: T) => T)) => {
      setConversations((prev) => {
        const newMap = Object.fromEntries(
          Object.entries(prev).map(([key, value]) =>
            key === id
              ? [key, typeof newItem === "function" ? newItem(value) : newItem]
              : [key, value]
          )
        );
        persistConversations(newMap);
        return newMap;
      });
    },
    [persistConversations]
  );

  return {
    conversations,
    addConversation,
    removeConversation,
    updateConversation,
    isLoading,
    error,
  };
}
