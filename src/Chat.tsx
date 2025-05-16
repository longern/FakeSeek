import { css } from "@emotion/css";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import OpenAI from "openai";
import { ImagesResponse } from "openai/resources.mjs";
import {
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseInputMessageContentList,
  ResponseOutputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrollToBottom from "react-scroll-to-bottom";

import { change as changeConversation } from "./app/conversations";
import {
  useAppDispatch,
  useAppSelector,
  useMessageDispatch,
} from "./app/hooks";
import {
  add as addMessage,
  ChatMessage,
  remove as removeMessage,
} from "./app/messages";
import AppDrawer from "./AppDrawer";
import InputArea from "./InputArea";
import MessageList from "./MessageList";
import { addMessageThunk } from "./app/db-middleware";

async function streamRequestAssistant(
  messages: ChatMessage[],
  options?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
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
  const model =
    options?.model ?? messages.some((m) => m.type === "reasoning")
      ? "o4-mini"
      : "gpt-4.1-nano";
  const normMessages = messages.map((message) => {
    if (
      message.type === "message" &&
      (message.role === "user" ||
        message.role === "developer" ||
        message.role === "system")
    ) {
      const { id, ...rest } = message;
      return rest as ResponseInputItem.Message;
    }
    return message;
  });
  const response = await client.responses.create(
    {
      model: model,
      input: normMessages,
      stream: true,
      reasoning: model.startsWith("o") ? { summary: "detailed" } : undefined,
    },
    { signal: options?.signal }
  );
  for await (const chunk of response) {
    options?.onStreamEvent?.(chunk);
  }

  return response;
}

function Chat({ onSearch }: { onSearch: (query: string) => void }) {
  const selectedConversation = useAppSelector(
    (state) => state.conversations.current
  );
  const messages = useAppSelector((state) => state.messages.messages);
  const [stopController, setStopController] = useState<
    AbortController | undefined
  >(undefined);
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const provider = useAppSelector((state) => state.provider);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const messageDispatch = useMessageDispatch();

  const methods = {
    sendMessage: (message: ResponseInputMessageContentList) => {
      const newMessage = {
        type: "message",
        role: "user",
        content: message,
      } as ResponseInputItem.Message;
      dispatch(addMessageThunk(newMessage));
      requestAssistant([...Object.values(messages), newMessage as ChatMessage]);
    },
    createResearch: (task: string) => {
      const newMessage = {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: task }],
      } as ResponseInputItem.Message;
      dispatch(addMessageThunk(newMessage));
      requestCreateResearch(task);
    },
    generateImage: async (prompt: ResponseInputMessageContentList) => {
      const newMessage: ResponseInputItem.Message = {
        type: "message",
        role: "user",
        content: prompt,
      };
      await dispatch(addMessageThunk(newMessage));
      requestGenerateImage(newMessage.content);
    },
  };

  const requestAssistant = useCallback(
    (messages: ChatMessage[], options?: { model?: string }) => {
      const abortController = new AbortController();
      setStopController(abortController);
      streamRequestAssistant(messages, {
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        model: options?.model,
        signal: abortController.signal,
        onStreamEvent(event) {
          messageDispatch(event);
        },
      })
        .catch((error) => {
          dispatch(
            addMessage({
              type: "message",
              role: "assistant",
              content: [{ type: "refusal", refusal: (error as Error).message }],
              status: "incomplete",
            } as ResponseOutputItem)
          );
        })
        .finally(() => {
          setStopController(undefined);
        });
    },
    [provider.apiKey, provider.baseURL, dispatch, messageDispatch]
  );

  const requestCreateResearch = useCallback(
    async (task: string) => {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        body: JSON.stringify({ instructions: task }),
      });
      const { id } = await response.json();

      dispatch(
        addMessage({
          type: "web_search_call",
          id,
          status: "in_progress",
        } as ResponseFunctionWebSearch)
      );
    },
    [dispatch]
  );

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
      dispatch(addMessage(toolCallMessage));

      const toolCallOutputMessage: ResponseInputItem.FunctionCallOutput = {
        id: crypto.randomUUID(),
        type: "function_call_output",
        call_id: callId,
        output: "",
        status: "in_progress",
      };
      dispatch(addMessage(toolCallOutputMessage));

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

        messageDispatch({
          type: "response.functioin_call_output.completed",
          output_index: 0,
          item: {
            ...toolCallOutputMessage,
            status: "completed",
            output: JSON.stringify(response.data),
          },
        });
      } catch (error) {
        messageDispatch({
          type: "response.functioin_call_output.incomplete",
          output_index: 0,
          item: {
            ...toolCallOutputMessage,
            status: "incomplete",
            output: (error as Error).message,
          },
        });
      } finally {
        setStopController(undefined);
      }
    },
    []
  );

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
          dispatch(changeConversation(conversation?.id));
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
                dispatch(changeConversation(null));
                stopController?.abort();
                setStopController(undefined);
              }}
            >
              <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
            </IconButton>
          </Toolbar>
        ) : null}
        {!Object.values(messages).length && !isMobile ? (
          <Container
            maxWidth="md"
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              gap: 2,
            }}
          >
            <Typography
              variant="h5"
              sx={{ textAlign: "center", userSelect: "none" }}
            >
              {t("What can I help with?")}
            </Typography>
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
                {!Object.values(messages).length ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: "35vh",
                    }}
                  >
                    <Typography
                      variant="h5"
                      sx={{ textAlign: "center", userSelect: "none" }}
                    >
                      {t("What can I help with?")}
                    </Typography>
                  </Box>
                ) : (
                  <MessageList
                    messages={Object.values(messages)}
                    onRetry={(message, options?: { model?: string }) => {
                      const array = Object.values(messages);
                      const index = array.indexOf(message);
                      const hasReasoning =
                        array[index - 1]?.type === "reasoning";
                      const sliceIndex = hasReasoning ? index - 1 : index;
                      const priorMessages = array.slice(0, sliceIndex);
                      for (let i = sliceIndex; i < array.length; i++) {
                        dispatch(removeMessage(array[i].id!));
                      }
                      requestAssistant(priorMessages, options);
                    }}
                  />
                )}
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
