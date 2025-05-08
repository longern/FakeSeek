import { css } from "@emotion/css";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Container,
  IconButton,
  Stack,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { produce, WritableDraft } from "immer";
import OpenAI from "openai";
import { ImagesResponse } from "openai/resources.mjs";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseInputMessageContentList,
  ResponseOutputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrollToBottom from "react-scroll-to-bottom";

import {
  add as addConversation,
  ChatMessage,
  update as updateConversation,
} from "./app/conversations";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import InputArea from "./InputArea";
import MessageList from "./MessageList";
import AppDrawer from "./AppDrawer";

async function streamRequestAssistant(
  messages: ChatMessage[],
  options?: {
    apiKey?: string;
    baseURL?: string;
    signal?: AbortSignal;
    onStreamEvent?: (event: ResponseStreamEvent) => void;
  }
) {
  const client = new OpenAI({
    apiKey: options?.apiKey,
    baseURL:
      options?.baseURL || new URL("/api/v1", window.location.href).toString(),
    dangerouslyAllowBrowser: true,
  });
  const response = await client.responses.create(
    {
      model: "gpt-4.1-nano",
      input: messages,
      stream: true,
    },
    { signal: options?.signal }
  );
  for await (const chunk of response) {
    options?.onStreamEvent?.(chunk);
  }

  return response;
}

function findMessage(messages: ChatMessage[], id: string) {
  type HasId<T> = T extends { id?: string } ? T : never;
  return messages.find(
    (m): m is HasId<ChatMessage> => (m as { id?: string })?.id === id
  );
}

export interface FunctionCallOutputCompletedEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.completed";
}

export interface FunctionCallOutputIncompleteEvent {
  item: ResponseInputItem.FunctionCallOutput;
  output_index: number;
  type: "response.functioin_call_output.incomplete";
}

function messageDispatch(
  messages: WritableDraft<ChatMessage[]>,
  event:
    | ResponseStreamEvent
    | FunctionCallOutputCompletedEvent
    | FunctionCallOutputIncompleteEvent
) {
  switch (event.type) {
    case "response.output_item.added":
      messages.push(event.item);
      break;

    case "response.output_item.done": {
      const message = findMessage(messages, event.item.id!);
      if (!message) return;
      if (message.type === "item_reference") break;
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

    case "response.functioin_call_output.completed": {
      const message = findMessage(messages, event.item.id!);
      if (!message) return;
      if (message.type !== "function_call_output") break;
      message.status = "completed";
      message.output = event.item.output;
      break;
    }

    case "response.functioin_call_output.incomplete": {
      const message = findMessage(messages, event.item.id!);
      if (!message) return;
      if (message.type !== "function_call_output") break;
      message.status = "incomplete";
      message.output = event.item.output;
      break;
    }
  }
}

function Chat({ onSearch }: { onSearch: (query: string) => void }) {
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stopController, setStopController] = useState<
    AbortController | undefined
  >(undefined);
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const provider = useAppSelector((state) => state.provider);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const methods = {
    sendMessage: (message: ResponseInputMessageContentList) => {
      const newMessage = {
        type: "message",
        role: "user",
        content: message,
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
    generateImage: (prompt: ResponseInputMessageContentList) => {
      const newMessage: ResponseInputItem.Message = {
        type: "message",
        role: "user",
        content: prompt,
      };
      setMessages((messages) => [...messages, newMessage]);
      requestGenerateImage(newMessage.content);
    },
  };

  const requestAssistant = useCallback(
    (messages: ChatMessage[]) => {
      const abortController = new AbortController();
      setStopController(abortController);
      streamRequestAssistant(messages, {
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        signal: abortController.signal,
        onStreamEvent(event) {
          setMessages((messages) =>
            produce(messages, (draft) => {
              messageDispatch(draft, event);
            })
          );
        },
      })
        .catch((error) => {
          setMessages((messages) => [
            ...messages,
            {
              type: "message",
              role: "assistant",
              content: [{ type: "refusal", refusal: (error as Error).message }],
              status: "incomplete",
            } as ResponseOutputItem,
          ]);
        })
        .finally(() => {
          setStopController(undefined);
        });
    },
    [provider.apiKey, provider.baseURL]
  );

  const requestCreateResearch = useCallback(async (task: string) => {
    const response = await fetch("/api/tasks", {
      method: "PUT",
      body: JSON.stringify({ instructions: task }),
    });
    const { id } = await response.json();
    setMessages((messages) => [
      ...messages,
      { type: "web_search_call", id, status: "in_progress" },
    ]);
  }, []);

  const requestGenerateImage = useCallback(
    async (content: ResponseInputMessageContentList) => {
      const abortController = new AbortController();
      setStopController(abortController);

      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        dangerouslyAllowBrowser: true,
      });

      const callId = crypto.randomUUID();
      const prompt = content
        .filter((part) => part.type === "input_text")
        .map((part) => part.text)
        .join("\n");
      const toolCallMessage: ResponseFunctionToolCall = {
        id: crypto.randomUUID(),
        type: "function_call",
        call_id: callId,
        name: "generate_image",
        arguments: JSON.stringify({
          prompt,
          model: "gpt-image-1",
          quality: provider.imageQuality,
          moderation: "low",
        }),
        status: "completed",
      };
      const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: "",
        status: "in_progress",
      };
      setMessages((messages) => [
        ...messages,
        toolCallMessage,
        toolCallOutputMessage,
      ]);

      try {
        let response: ImagesResponse;

        if (content.length === 1 && content[0].type === "input_text") {
          response = await client.images.generate(
            {
              prompt: prompt,
              model: "gpt-image-1",
              quality: provider.imageQuality,
              moderation: "low",
            },
            { signal: abortController.signal }
          );
        } else {
          const imageResponses = await Promise.all(
            content
              .filter((part) => part.type === "input_image")
              .map(async (part, index) => {
                const res = await fetch(part.image_url!);
                const blob = await res.blob();
                const file = new File([blob], `image_${index + 1}`, {
                  type: blob.type,
                });
                return file;
              })
          );
          response = await client.images.edit(
            {
              image: imageResponses,
              prompt: prompt,
              model: "gpt-image-1",
              quality: provider.imageQuality,
            },
            { signal: abortController.signal }
          );
        }

        setMessages((messages) =>
          produce(messages, (draft) => {
            messageDispatch(draft, {
              type: "response.functioin_call_output.completed",
              output_index: 0,
              item: {
                ...toolCallOutputMessage,
                status: "completed",
                output: JSON.stringify(response.data),
              },
            });
          })
        );
      } catch (error) {
        setMessages((messages) =>
          produce(messages, (draft) => {
            messageDispatch(draft, {
              type: "response.functioin_call_output.incomplete",
              output_index: 0,
              item: {
                ...toolCallOutputMessage,
                status: "incomplete",
                output: (error as Error).message,
              },
            });
          })
        );
      } finally {
        setStopController(undefined);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedConversation) {
      dispatch(
        updateConversation({ id: selectedConversation, patch: { messages } })
      );
    } else {
      if (messages.length === 0) return;
      const newId = crypto.randomUUID();
      const content = (messages[0] as ResponseInputItem.Message).content[0];
      const title =
        content.type === "input_text" ? content.text.slice(0, 15) : "New Chat";
      dispatch(
        addConversation({
          id: newId,
          title: title,
          create_time: Date.now(),
          messages,
        })
      );
      setSelectedConversation(newId);
    }
  }, [messages, selectedConversation, dispatch]);

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
      onGenerateImage={(prompt) => {
        methods.generateImage(prompt);
      }}
    />
  );

  return (
    <Stack direction="row" sx={{ height: "100%" }}>
      <AppDrawer
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        selectedConversation={selectedConversation}
        onConversationChange={(conversation) => {
          if (conversation === null) {
            setSelectedConversation(null);
            setMessages([]);
          } else {
            setSelectedConversation(conversation.id);
            setMessages(conversation.messages);
          }
          stopController?.abort();
          setStopController(undefined);
          setShowSidebar(false);
        }}
      />
      <Stack sx={{ width: "100%", backgroundColor: "background.paper" }}>
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
        {!messages.length && !isMobile ? (
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
