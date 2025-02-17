import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Container,
  Dialog,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
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

import Markdown from "./Markdown";

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
    createResearch: (task: string) => void;
  }>;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null
  );
  const [showSelection, setShowSelection] = useState(false);
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
        createResearch: (task: string) => {
          setMessages((messages) => [
            ...messages,
            { role: "user", content: task },
          ]);
          requestCreateResearch(task);
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
    }).catch((error) => {
      window.alert(error.message);
    });
    onControllerChange?.(undefined);
  }, []);

  const requestCreateResearch = useCallback(async (task: string) => {
    const response = await fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({
        instructions: task,
        model: "deepseek/deepseek-r1:free",
      }),
    });
    const { id } = await response.json();
    setMessages((messages) => [
      ...messages,
      { role: "assistant", content: `research: ${id}` },
    ]);
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
                      "& > pre": {
                        overflowX: "auto",
                      },
                    }),
              }}
              onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
                const { nativeEvent } = e;
                if (nativeEvent.pointerType === "mouse") return;
                nativeEvent.preventDefault();
                window.getSelection()?.removeAllRanges();
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
              ) : message.content.startsWith("research: ") ? (
                <Button
                  onClick={async () => {
                    const researchId = message.content.slice(10);
                    const res = await fetch(`/api/tasks/${researchId}`);
                    const data = await res.json();
                    if (data.status === "complete") {
                      setMessages(
                        messages.map((m) =>
                          m !== message
                            ? m
                            : {
                                role: "assistant",
                                content: data.output ?? data.error,
                              }
                        )
                      );
                    }
                  }}
                >
                  Load Result
                </Button>
              ) : (
                <>
                  {message.reasoning_content && (
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ paddingLeft: 1 }}
                    >
                      {message.reasoning_content}
                    </Typography>
                  )}
                  <Markdown>{message.content}</Markdown>
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
        <MenuItem
          onClick={() => {
            setShowSelection(true);
            setContextMenu(null);
          }}
        >
          Select Text
        </MenuItem>
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
      <Dialog
        fullScreen
        open={showSelection}
        onClose={() => {
          setShowSelection(false);
          setSelectedMessage(null);
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            position: "sticky",
            top: 0,
            backgroundColor: "background.paper",
            borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
            zIndex: 1,
          }}
        >
          <IconButton
            aria-label="Close"
            size="large"
            onClick={() => {
              setShowSelection(false);
              setSelectedMessage(null);
            }}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, textAlign: "center" }}>
            Select Text
          </Typography>
          <Box sx={{ width: "48px" }} />
        </Toolbar>
        <InputBase
          multiline
          fullWidth
          value={selectedMessage?.content}
          slotProps={{ input: { readOnly: true } }}
          sx={{ height: "100%", padding: 2, alignItems: "flex-start" }}
        />
      </Dialog>
    </>
  );
}

export default Chat;
