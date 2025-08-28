import { css } from "@emotion/css";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  Container,
  Fade,
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
import ScrollToBottom, {
  useAtBottom,
  useScrollToBottom,
} from "react-scroll-to-bottom";

import { change as changeConversation } from "../app/conversations";
import { addMessageThunk } from "../app/db-middleware";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { ChatMessage, remove as removeMessage } from "../app/messages";
import {
  CreateResponseParams,
  requestAssistant,
  requestCreateResearch,
  requestGenerateImage,
  requestSearch,
  requestSearchImage,
} from "../app/thunks";
import AppDrawer from "./AppDrawer";
import CoachingDialog from "./CoachingDialog";
import InputArea, { Abortable } from "./InputArea";
import MessageList from "./MessageList";

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

function Main({
  abortable,
  setAbortable,
}: {
  abortable?: Abortable;
  setAbortable: (promise: Abortable & Promise<unknown>) => void;
}) {
  const [coachingResponse, setCoachingResponse] = useState<ChatMessage | null>(
    null
  );
  const messages = useAppSelector((state) => state.messages.messages);
  const dispatch = useAppDispatch();
  const [atBottom] = useAtBottom();
  const scrollToBottom = useScrollToBottom();

  const { t } = useTranslation();

  const handleRetry = (
    message: ChatMessage,
    options?: CreateResponseParams
  ) => {
    const array = Object.values(messages);
    const index = array.indexOf(message);

    let sliceIndex;
    for (sliceIndex = index; sliceIndex >= 1; sliceIndex--) {
      const message = array[sliceIndex - 1];
      if (message.object === "message" && message.role === "user") break;
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
        const userMessage = toUserMessage(query);
        const { payload: newMessage } = await dispatch(
          addMessageThunk(userMessage)
        ).unwrap();
        const newMessages = [...Object.values(messages), newMessage];
        setAbortable(dispatch(requestSearch(newMessages)));
      }}
      onSearchImage={async (query) => {
        const userMessage = toUserMessage(query);
        const { payload: newMessage } = await dispatch(
          addMessageThunk(userMessage)
        ).unwrap();
        const newMessages = [...Object.values(messages), newMessage];
        setAbortable(dispatch(requestSearchImage(newMessages)));
      }}
      onChat={async (message, options) => {
        const newMessage = toUserMessage(message);
        const result = await dispatch(addMessageThunk(newMessage)).unwrap();
        const newMessages = [...Object.values(messages), result.payload];
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
        const userMessage = toUserMessage(prompt);
        const { payload: newMessage } = await dispatch(
          addMessageThunk(userMessage)
        ).unwrap();
        const newMessages = [...Object.values(messages), newMessage];
        setAbortable(dispatch(requestGenerateImage(newMessages)));
      }}
    />
  );

  return (
    <Stack sx={{ minHeight: "100%" }}>
      <Container
        component="main"
        maxWidth="md"
        sx={{
          flexGrow: 1,
          padding: 2,
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {!Object.values(messages).length ? (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" sx={{ userSelect: "none" }}>
              {t("What can I help with?")}
            </Typography>
          </Box>
        ) : (
          <MessageList
            messages={Object.values(messages)}
            onRetry={handleRetry}
            onDislike={(message) => {
              setCoachingResponse(message);
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
        <Container maxWidth="md" disableGutters sx={{ position: "relative" }}>
          <Fade in={!atBottom}>
            <IconButton
              size="small"
              sx={{
                position: "absolute",
                right: 16,
                top: -40,
                width: 32,
                height: 32,
                border: "1px solid rgba(0, 0, 0, 0.12)",
              }}
              onClick={() => scrollToBottom()}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </Fade>
          {inputArea}
        </Container>
      </Box>
      <CoachingDialog
        open={Boolean(coachingResponse)}
        onClose={() => setCoachingResponse(null)}
        message={coachingResponse}
      />
    </Stack>
  );
}

function Chat() {
  const [abortable, setAbortable] = useAbortablePromise();
  const selectedConversation = useAppSelector(
    (state) => state.conversations.current
  );
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();
  const dispatch = useAppDispatch();

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
          <Main abortable={abortable} setAbortable={setAbortable} />
        </ScrollToBottom>
      </Stack>
    </Stack>
  );
}

export default Chat;
