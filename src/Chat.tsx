import { css } from "@emotion/css";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { produce, WritableDraft } from "immer";
import OpenAI from "openai";
import {
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrollToBottom from "react-scroll-to-bottom";

import ConversationList, { Conversation } from "./ConversationList";
import InputArea from "./InputArea";
import MessageList, { ChatMessage } from "./MessageList";
import { useConversations } from "./conversations";

async function streamRequestAssistant(
  messages: ChatMessage[],
  options?: {
    signal?: AbortSignal;
    onStreamEvent?: (event: ResponseStreamEvent) => void;
  }
) {
  const client = new OpenAI({
    apiKey: "",
    baseURL: new URL("/api/v1", window.location.origin).toString(),
    dangerouslyAllowBrowser: true,
  });
  const response = await client.responses.create({
    model: "deepseek-r1",
    input: messages,
    stream: true,
  });
  for await (const chunk of response) {
    options?.onStreamEvent?.(chunk);
  }

  return response;
}

function findMessage(messages: ChatMessage[], id: string) {
  type HasId<T> = T extends { id: string } ? T : never;
  return messages.find(
    (m): m is HasId<ChatMessage> => (m as { id?: string })?.id === id
  );
}

function messageDispatch(
  messages: WritableDraft<ChatMessage[]>,
  event: ResponseStreamEvent
) {
  switch (event.type) {
    case "response.output_item.added":
      messages.push(event.item);
      break;

    case "response.output_item.done": {
      const message = findMessage(messages, event.item.id);
      if (!message) return;
      if (message.type !== "message" && message.type !== "reasoning") break;
      message.status = event.item.status as
        | "completed"
        | "in_progress"
        | "incomplete";
      break;
    }

    case "response.content_part.added": {
      const message = findMessage(messages, event.item_id);
      if (!message) return;
      switch (message.type) {
        case "message":
          message.content.push(event.part);
          break;
        case "reasoning":
          message.summary.push(event.part as any);
          break;
      }
      break;
    }

    case "response.output_text.delta": {
      const message = findMessage(messages, event.item_id);
      if (!message) return;
      switch (message.type) {
        case "message":
          const content = message.content[event.content_index];
          if (content.type !== "output_text") break;
          content.text += event.delta;
          break;
        case "reasoning":
          const part = message.summary[event.content_index];
          part.text += event.delta;
      }
      break;
    }
  }
}

function Chat({ onSearch }: { onSearch: (query: string) => void }) {
  const {
    conversations,
    addConversation,
    updateConversation,
    removeConversation,
  } = useConversations<Conversation>("conversations.json");
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stopController, setStopController] = useState<
    AbortController | undefined
  >(undefined);
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();

  const methods = {
    sendMessage: (message: string) => {
      const newMessage = {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: message }],
      } as ResponseInputItem.Message;
      setMessages((messages) => [...messages, newMessage]);
      requestAssistant([...messages, newMessage]);
    },
    createResearch: (task: string) => {
      setMessages((messages) => [
        ...messages,
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: task }],
        },
      ]);
      requestCreateResearch(task);
    },
  };

  const requestAssistant = useCallback((messages: ChatMessage[]) => {
    const abortController = new AbortController();
    setStopController(abortController);
    streamRequestAssistant(messages, {
      signal: abortController.signal,
      onStreamEvent(event) {
        setMessages((messages) =>
          produce(messages, (draft) => {
            messageDispatch(draft, event);
          })
        );
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
      { type: "web_search_call", id, status: "in_progress" },
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
      const content = (messages[0] as ResponseInputItem.Message).content[0];
      addConversation({
        id: newId,
        title:
          content.type === "input_text"
            ? content.text.slice(0, 15)
            : "New Chat",
        create_time: Date.now(),
        messages,
      });
      setSelectedConversation(newId);
    }
  }, [messages, selectedConversation, updateConversation]);

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
            width: "260px",
            position: isMobile ? "fixed" : "relative",
            backgroundColor: "#f9fbff",
            borderRight: "none",
          },
        }}
        onClose={() => setShowSidebar(false)}
      >
        {!isMobile && (
          <Box>
            <Button
              size="large"
              sx={{
                margin: 2,
                borderRadius: "12px",
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
              startIcon={
                <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
              }
            >
              {t("New Chat")}
            </Button>
          </Box>
        )}
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelect={(conversation) => {
            setSelectedConversation(conversation.id);
            setMessages(conversation.messages);
            stopController?.abort();
            setStopController(undefined);
            setShowSidebar(false);
          }}
          onRename={(conversation) => {
            const title = window.prompt(t("Rename"), conversation.title);
            if (!title) return;
            updateConversation(conversation.id, (prev) => ({ ...prev, title }));
          }}
          onDelete={(conversation) => {
            if (!window.confirm("Delete this chat?")) return;
            removeConversation(conversation.id);
          }}
        />
      </Drawer>
      <Stack sx={{ width: "100%" }}>
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
              aria-label={t("New Chat")}
              size="large"
              onClick={() => {
                setSelectedConversation(null);
                setMessages([]);
                stopController?.abort();
                setStopController(undefined);
              }}
            >
              <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
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
          <ScrollToBottom
            className={css`
              flex-grow: 1;
              min-height: 0;
            `}
          >
            <Stack sx={{ minHeight: "100%" }}>
              <Container
                maxWidth="md"
                sx={{ flexGrow: 1, padding: 2, overflowX: "hidden" }}
              >
                <Stack gap={1}>
                  <MessageList
                    messages={messages}
                    onMessageChange={setMessages}
                    onRetry={(message) => {
                      const index = messages.indexOf(message);
                      const priorMessages = messages.slice(0, index);
                      setMessages(priorMessages);
                      requestAssistant(priorMessages);
                    }}
                  />
                </Stack>
              </Container>
              <Box
                sx={{
                  position: "sticky",
                  bottom: 0,
                  width: "100%",
                  background: (theme) =>
                    `linear-gradient(to bottom, transparent 0, ${
                      theme.palette.background.paper
                    } ${theme.spacing(1)})`,
                  zIndex: 1,
                }}
              >
                <Container maxWidth="md" disableGutters>
                  {inputArea}
                </Container>
              </Box>
            </Stack>
          </ScrollToBottom>
        )}
      </Stack>
    </Stack>
  );
}

export default Chat;
