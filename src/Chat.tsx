import { Box, Container, Stack } from "@mui/material";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import OpenAI from "openai";

interface ChatMessage {
  role: string;
  content: string;
}

function Chat({
  defaultMessage,
}: {
  defaultMessage: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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

  return (
    <Container maxWidth="md" sx={{ padding: 2 }}>
      <Stack gap={1}>
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
  );
}

export default Chat;
