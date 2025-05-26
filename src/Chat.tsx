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
import {
  ResponseInputItem,
  ResponseInputMessageContentList,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrollToBottom from "react-scroll-to-bottom";

import { change as changeConversation } from "./app/conversations";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { ChatMessage, remove as removeMessage } from "./app/messages";
import AppDrawer from "./AppDrawer";
import InputArea, { Abortable } from "./InputArea";
import MessageList from "./MessageList";
import { addMessageThunk } from "./app/db-middleware";
import {
  CreateResponseParams,
  requestAssistant,
  requestCreateResearch,
  requestGenerateImage,
  requestSearch,
  requestSearchImage,
} from "./app/thunks";

function useAbortablePromise() {
  const [abortable, setAbortable] = useState<Abortable | undefined>(undefined);

  const setAbortablePromise = useCallback(
    (promise: (Abortable & Promise<unknown>) | undefined) => {
      setAbortable(promise);
      if (!promise) return;
      promise.finally(() => {
        setAbortable(undefined);
      });
    },
    []
  );

  return [abortable, setAbortablePromise] as const;
}

function toUserMessage(
  message: string | ResponseInputMessageContentList
): ResponseInputItem.Message {
  const content: ResponseInputMessageContentList =
    typeof message === "string"
      ? [{ type: "input_text", text: message }]
      : message;
  return { type: "message", role: "user", content };
}

function Chat() {
  const selectedConversation = useAppSelector(
    (state) => state.conversations.current
  );
  const [showSidebar, setShowSidebar] = useState(false);
  const [abortable, setAbortable] = useAbortablePromise();
  const messages = useAppSelector((state) => state.messages.messages);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const handleRetry = (
    message: ChatMessage,
    options?: CreateResponseParams
  ) => {
    const array = Object.values(messages);
    const index = array.indexOf(message);

    let sliceIndex;
    for (sliceIndex = index; sliceIndex >= 1; sliceIndex--) {
      const message = array[sliceIndex - 1];
      if (message.type === "message" && message.role === "user") break;
    }
    if (sliceIndex < 1) return;

    const priorMessages = array.slice(0, sliceIndex);
    for (let i = sliceIndex; i < array.length; i++) {
      dispatch(removeMessage(array[i].id!));
    }
    setAbortable(
      dispatch(requestAssistant({ messages: priorMessages, options }))
    );
  };

  const inputArea = (
    <InputArea
      abortable={abortable}
      onSearch={async (query) => {
        const newMessage = toUserMessage(query);
        await dispatch(addMessageThunk(newMessage));
        const newMessages = [
          ...Object.values(messages),
          newMessage as ChatMessage,
        ];
        setAbortable(dispatch(requestSearch(newMessages)));
      }}
      onSearchImage={async (query) => {
        const newMessage = toUserMessage(query);
        await dispatch(addMessageThunk(newMessage));
        const newMessages = [
          ...Object.values(messages),
          newMessage as ChatMessage,
        ];
        setAbortable(dispatch(requestSearchImage(newMessages)));
      }}
      onChat={(message, options) => {
        const newMessage = toUserMessage(message);
        dispatch(addMessageThunk(newMessage));
        const newMessages = [
          ...Object.values(messages),
          newMessage as ChatMessage,
        ];
        setAbortable(
          dispatch(requestAssistant({ messages: newMessages, options }))
        );
      }}
      onResearch={async (task) => {
        const newMessage = toUserMessage(task);
        await dispatch(addMessageThunk(newMessage));
        setAbortable(dispatch(requestCreateResearch(task)));
      }}
      onGenerateImage={async (prompt) => {
        const newMessage = toUserMessage(prompt);
        await dispatch(addMessageThunk(newMessage));
        const newMessages = [
          ...Object.values(messages),
          newMessage as ChatMessage,
        ];
        setAbortable(dispatch(requestGenerateImage(newMessages)));
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
          abortable?.abort();
          setAbortable(undefined);
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
                abortable?.abort();
                setAbortable(undefined);
              }}
            >
              <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
            </IconButton>
          </Toolbar>
        ) : null}
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
                  onRetry={handleRetry}
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
      </Stack>
    </Stack>
  );
}

export default Chat;
