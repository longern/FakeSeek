import AddCommentIcon from "@mui/icons-material/AddComment";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import OpenAI from "openai";
import { useCallback, useEffect, useRef, useState } from "react";

import InputArea from "./InputArea";
import MessageList from "./MessageList";
import { useConversations } from "./conversations";

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
        model: "deepseek-r1",
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
    reasoningBuffer += (delta as any).reasoning_content ?? "";
    options?.onPartialMessage?.({
      role: "assistant",
      content: buffer,
      reasoning_content: reasoningBuffer,
    });
  }

  return response;
}

function Chat({ onSearch }: { onSearch: (query: string) => void }) {
  const { conversations, addConversation, updateConversation } =
    useConversations<{
      id: string;
      title: string;
      messages: ChatMessage[];
    }>("conversations.json");
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stopController, setStopController] = useState<
    AbortController | undefined
  >(undefined);
  const [showSidebar, setShowSidebar] = useState(false);
  const isScrolledToBottom = useRef(true);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const methods = {
    sendMessage: (message: string) => {
      const newMessage = { role: "user", content: message };
      setMessages((messages) => [...messages, newMessage]);
      requestAssistant([...messages, newMessage]);
    },
    createResearch: (task: string) => {
      setMessages((messages) => [...messages, { role: "user", content: task }]);
      requestCreateResearch(task);
    },
  };

  const requestAssistant = useCallback((messages: ChatMessage[]) => {
    const abortController = new AbortController();
    setStopController(abortController);
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
    setStopController(undefined);
  }, []);

  const requestCreateResearch = useCallback(async (task: string) => {
    const response = await fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({
        instructions: task,
        model: "deepseek-r1",
      }),
    });
    const { id } = await response.json();
    setMessages((messages) => [
      ...messages,
      { role: "assistant", content: `research: ${id}` },
    ]);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      updateConversation(selectedConversation, (prev) => ({
        ...prev,
        messages,
      }));
    } else {
      if (messages.length === 0) return;
      const newId = crypto.randomUUID();
      addConversation({
        id: newId,
        title: messages[0].content.slice(0, 10),
        messages,
      });
      setSelectedConversation(newId);
    }
  }, [messages, selectedConversation, updateConversation]);

  useEffect(() => {
    if (isScrolledToBottom.current) {
      document.documentElement.scrollTop =
        document.documentElement.scrollHeight;
    }
  });

  const inputArea = (
    <InputArea
      stopController={stopController}
      onSearch={onSearch}
      onChat={(message) => {
        methods.sendMessage(message);
      }}
      onResearch={(task) => {
        methods.createResearch(task);
      }}
    />
  );

  return (
    <Stack direction="row" sx={{ height: "100%" }}>
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={showSidebar}
        anchor="left"
        sx={{
          [`& .MuiDrawer-paper`]: {
            width: "300px",
            position: isMobile ? "fixed" : "relative",
          },
        }}
        onClose={() => setShowSidebar(false)}
      >
        <Box>
          <Button
            size="large"
            sx={{
              margin: 2,
              backgroundColor: "#dbeafe",
              "&:hover": { backgroundColor: "#c6dcf8" },
            }}
            onClick={() => {
              setSelectedConversation(null);
              setMessages([]);
              stopController?.abort();
              setStopController(undefined);
              setShowSidebar(false);
            }}
            startIcon={<AddCommentIcon />}
          >
            New Chat
          </Button>
        </Box>
        <List>
          {Object.values(conversations).map((conversation) => (
            <ListItem disablePadding key={conversation.id}>
              <ListItemButton
                selected={conversation.id === selectedConversation}
                onClick={() => {
                  setSelectedConversation(conversation.id);
                  setMessages(conversation.messages);
                  stopController?.abort();
                  setStopController(undefined);
                  setShowSidebar(false);
                }}
              >
                {conversation.title}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Stack sx={{ width: "100%", overflowY: "auto" }}>
        {isMobile ? (
          <Toolbar disableGutters>
            <IconButton
              aria-label="Show sidebar"
              size="large"
              onClick={() => setShowSidebar(true)}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              aria-label="New chat"
              size="large"
              onClick={() => {
                setSelectedConversation(null);
                setMessages([]);
                stopController?.abort();
                setStopController(undefined);
              }}
            >
              <AddCommentIcon />
            </IconButton>
          </Toolbar>
        ) : null}
        {!messages.length ? (
          <Container
            maxWidth="md"
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            {inputArea}
          </Container>
        ) : (
          <>
            <Container maxWidth="md" sx={{ flexGrow: 1, padding: 2 }}>
              <Stack gap={1}>
                <MessageList
                  messages={messages}
                  onMessageChange={setMessages}
                />
              </Stack>
            </Container>
            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                width: "100%",
                backgroundColor: "background.paper",
                zIndex: 1,
              }}
            >
              <Container maxWidth="md" disableGutters>
                {inputArea}
              </Container>
            </Box>
          </>
        )}
      </Stack>
    </Stack>
  );
}

export default Chat;
