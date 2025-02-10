import {
  Box,
  Container,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import OpenAI from "openai";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

import { preprocessLaTeX } from "./latex";

interface ChatMessage {
  role: string;
  content: string;
  reasoning_content?: string;
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
    { model: "", messages: [], stream: true },
    {
      signal: options?.signal,
      body: {
        model: "deepseek/deepseek-r1:free",
        messages: messages as any,
        stream: true,
        include_reasoning: true,
      },
    }
  );
  let buffer = "";
  let reasoningBuffer = "";
  for await (const chunk of response) {
    const chunkChoice = chunk.choices[0];
    const { delta } = chunkChoice;
    buffer += delta.content ?? "";
    reasoningBuffer += (delta as any).reasoning ?? "";
    options?.onPartialMessage?.({
      role: "assistant",
      content: buffer,
      reasoning_content: reasoningBuffer,
    });
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
        const { scrollTop, scrollHeight, clientHeight } =
          document.documentElement;
        isScrolledToBottom.current =
          scrollTop + clientHeight >= scrollHeight - 1;
        setMessages((messages) => {
          const partialMessageCopy = partialMessage;
          partialMessage = message;
          return messages.map((m) => (m === partialMessageCopy ? message : m));
        });
      },
    });
    onControllerChange?.(undefined);
  }, []);

  useEffect(() => {
    if (isScrolledToBottom.current) {
      document.documentElement.scrollTop =
        document.documentElement.scrollHeight;
    }
  });

  return (
    <>
      <Container
        maxWidth="md"
        sx={{ paddingX: 2, paddingTop: 2, paddingBottom: "120px" }}
      >
        <Stack gap={1}>
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                maxWidth: "100%",
                overflowWrap: "break-word",
                ...(message.role === "user"
                  ? {
                      minWidth: "48px",
                      padding: "8px 12px",
                      backgroundColor: "#eff6ff",
                      borderRadius: "20px",
                      marginLeft: "64px",
                      alignSelf: "flex-end",
                      whiteSpace: "pre-wrap",
                    }
                  : {
                      "& img": {
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "60vh",
                      },
                      "& > p": {
                        overflowX: "auto",
                      },
                    }),
              }}
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
                <>
                  {message.reasoning_content && (
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ paddingLeft: 1 }}
                    >
                      <Markdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {preprocessLaTeX(message.reasoning_content ?? "")}
                      </Markdown>
                    </Typography>
                  )}
                  <Markdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {preprocessLaTeX(message.content)}
                  </Markdown>
                </>
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
