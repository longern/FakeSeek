import { Box, Container, Menu, MenuItem, Stack } from "@mui/material";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import OpenAI from "openai";

interface ChatMessage {
  role: string;
  content: string;
}

async function streamRequestAssistant(
  messages: ChatMessage[],
  options?: {
    signal?: AbortSignal;
    onPartialMessage?: (message: ChatMessage) => void;
  }
) {
  const client = new OpenAI({
    apiKey: "",
    baseURL: new URL("/api/v1", window.location.origin).toString(),
    dangerouslyAllowBrowser: true,
  });
  const response = await client.chat.completions.create(
    {
      model: "deepseek/deepseek-r1:free",
      messages: messages as any,
      stream: true,
    },
    { signal: options?.signal }
  );
  let buffer = "";
  for await (const chunk of response) {
    const chunkChoice = chunk.choices[0];
    const { delta } = chunkChoice;
    buffer += delta.content;
    options?.onPartialMessage?.({ role: "assistant", content: buffer });
  }

  return response;
}

function Chat({
  inputArea,
  onControllerChange,
  ref,
}: {
  inputArea: React.ReactNode;
  onBack: () => void;
  onControllerChange?: (signal: AbortController | undefined) => void;
  ref?: React.ForwardedRef<{
    sendMessage: (message: string) => void;
  }>;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = useRef(true);

  useImperativeHandle(
    ref,
    () => {
      return {
        sendMessage: (message: string) => {
          const newMessage = { role: "user", content: message };
          setMessages((messages) => [...messages, newMessage]);
          requestAssistant([...messages, newMessage]);
        },
      };
    },
    [messages]
  );

  const requestAssistant = useCallback((messages: ChatMessage[]) => {
    const abortController = new AbortController();
    onControllerChange?.(abortController);
    let partialMessage = { role: "assistant", content: "" };
    setMessages((messages) => [...messages, partialMessage]);
    streamRequestAssistant(messages, {
      signal: abortController.signal,
      onPartialMessage: (message) => {
        setMessages((messages) => {
          const partialMessageCopy = partialMessage;
          partialMessage = message;
          return messages.map((m) => (m === partialMessageCopy ? message : m));
        });
      },
    });
    onControllerChange?.(undefined);
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    isScrolledToBottom.current =
      containerRef.current.scrollHeight - containerRef.current.scrollTop ===
      containerRef.current.clientHeight;
  }, [messages]);

  useEffect(() => {
    if (isScrolledToBottom.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <Container
        ref={containerRef}
        maxWidth="md"
        sx={{ paddingX: 2, paddingTop: 2, paddingBottom: "120px" }}
      >
        <Stack gap={1}>
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={
                message.role === "user"
                  ? {
                      minWidth: "48px",
                      padding: "8px 12px",
                      backgroundColor: "#eff6ff",
                      borderRadius: "20px",
                      marginLeft: "64px",
                      alignSelf: "flex-end",
                      whiteSpace: "pre-wrap",
                    }
                  : null
              }
              onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
                const { nativeEvent } = e;
                if (nativeEvent.pointerType === "mouse") return;
                nativeEvent.preventDefault();
                nativeEvent.stopImmediatePropagation();
                setContextMenu(
                  contextMenu === null
                    ? { mouseX: e.clientX, mouseY: e.clientY }
                    : null
                );
                setSelectedMessage(message);
              }}
            >
              {message.role === "user" ? (
                message.content
              ) : (
                <Markdown>{message.content}</Markdown>
              )}
            </Box>
          ))}
        </Stack>
      </Container>
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        MenuListProps={{ sx: { minWidth: "160px" } }}
      >
        <MenuItem
          onClick={() => {
            if (!selectedMessage) return;
            navigator.clipboard.writeText(selectedMessage.content);
            setContextMenu(null);
            setSelectedMessage(null);
          }}
        >
          Copy
        </MenuItem>
        <MenuItem>Select Text</MenuItem>
        <MenuItem>Retry</MenuItem>
      </Menu>
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          backgroundColor: "background.paper",
        }}
      >
        <Container maxWidth="md" disableGutters>
          {inputArea}
        </Container>
      </Box>
    </>
  );
}

export default Chat;
