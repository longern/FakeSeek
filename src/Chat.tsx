import { Box, Container, Menu, MenuItem, Stack } from "@mui/material";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import OpenAI from "openai";

interface ChatMessage {
  role: string;
  content: string;
}

function Chat({
  defaultMessage,
  inputArea,
}: {
  defaultMessage: string;
  inputArea: React.ReactNode;
  onBack: () => void;
}) {
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = useRef(true);

  useEffect(() => {
    const abortController = new AbortController();
    setMessages([{ role: "user", content: defaultMessage }]);
    const client = new OpenAI({
      apiKey: "",
      baseURL: new URL("/api/v1", window.location.origin).toString(),
      dangerouslyAllowBrowser: true,
    });
    client.chat.completions
      .create(
        {
          model: "deepseek/deepseek-r1:free",
          messages: [{ role: "user", content: defaultMessage }],
          stream: true,
        },
        { signal: abortController.signal }
      )
      .then(async (response) => {
        let partialMessage = { role: "assistant", content: "" };
        setMessages((messages) => [...messages, partialMessage]);
        for await (const chunk of response) {
          const chunkChoice = chunk.choices[0];
          const { delta } = chunkChoice;
          const newMessage = {
            role: "assistant",
            content: partialMessage.content + delta.content,
          };
          const partialMessageCopy = partialMessage;
          setMessages((messages) =>
            messages.map((m) => (m === partialMessageCopy ? newMessage : m))
          );
          partialMessage = newMessage;
        }
      });
    return () => abortController.abort();
  }, [defaultMessage]);

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
        <Stack gap={1} sx={{ userSelect: "none" }}>
          {messages.map((message) => (
            <Box
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
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(
                  contextMenu === null
                    ? { mouseX: e.clientX, mouseY: e.clientY }
                    : null
                );
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
        <MenuItem>Copy</MenuItem>
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
