import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
  Response,
  ResponseInputItem,
  ResponseInputMessageContentList,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { change as changeConversation } from "../app/conversations";
import { addMessageThunk } from "../app/db-middleware";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { ChatMessage, remove as removeMessage } from "../app/messages";
import {
  requestAssistant,
  requestCreateResearch,
  requestGenerateImage,
  requestSearch,
  requestSearchImage,
} from "../app/thunks";
import AppDrawer from "./AppDrawer";
import AddToDatasetDialog from "./fine-tuning/AddToDatasetDialog";
import InputArea, { Abortable } from "./InputArea";
import MessageList, { UserMessageContextMenu } from "./MessageList";
import {
  ResponseActions,
  ResponseContextMenu,
  SelectTextDrawer,
} from "./ResponseItem";
import { CreateResponseParams } from "../app/api-modes/types";

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
  const [coachingMessages, setCoachingMessages] = useState<
    ChatMessage[] | null
  >(null);
  const [badResponse, setBadResponse] = useState<ChatMessage | null>(null);
  const messages = useAppSelector((state) => state.messages.messages);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    payload: { message: ChatMessage; selectedPart?: number };
  } | null>(null);
  const [selectTextDrawer, setSelectTextDrawer] = useState<{
    open: boolean;
    payload?: {
      message: Response & { timestamp: number };
      selectedPart?: number;
    };
  }>({ open: false });
  const dispatch = useAppDispatch();
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

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

  const ResponseActionsBind = useMemo(
    () =>
      ({ message }: { message: Response & { timestamp: number } }) =>
        (
          <ResponseActions
            response={message}
            onRetry={(options) => handleRetry(message, options)}
            onDislike={() => {
              const msgIndex = Object.entries(messages).findIndex(
                ([_, msg]) => msg === message
              );
              const msgValues = Object.values(structuredClone(messages)).slice(
                0,
                msgIndex
              );
              setCoachingMessages(msgValues);
              setBadResponse(message);
            }}
          />
        ),
    [messages]
  );

  return (
    <Stack sx={{ flexGrow: 1 }}>
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
            onContextMenu={(e, payload) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, payload });
            }}
            slots={{ responseActions: ResponseActionsBind }}
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
          <Fade in={!isAtBottom}>
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
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Fade>
          {inputArea}
        </Container>
      </Box>

      <AddToDatasetDialog
        open={Boolean(coachingMessages)}
        onClose={() => setCoachingMessages(null)}
        prevMessages={coachingMessages}
        badResponse={badResponse}
      />

      <UserMessageContextMenu
        open={
          contextMenu !== null &&
          contextMenu.payload.message.object === "message"
        }
        onClose={() => setContextMenu(null)}
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        payload={
          contextMenu !== null &&
          contextMenu.payload.message.object === "message"
            ? contextMenu?.payload
            : undefined
        }
      />

      <ResponseContextMenu
        open={
          contextMenu !== null &&
          contextMenu.payload.message.object === "response"
        }
        onClose={() => setContextMenu(null)}
        onSelectText={() => {
          setSelectTextDrawer({
            open: true,
            payload: {
              message: contextMenu!.payload.message as Response & {
                timestamp: number;
              },
              selectedPart: contextMenu!.payload.selectedPart,
            },
          });
          setContextMenu(null);
        }}
        anchorPosition={contextMenu}
        payload={
          contextMenu !== null &&
          contextMenu.payload.message.object === "response"
            ? (contextMenu.payload as {
                message: Response & { timestamp: number };
              })
            : undefined
        }
        onRetryClick={() => handleRetry(contextMenu!.payload.message)}
      />

      <SelectTextDrawer
        open={selectTextDrawer.open}
        onClose={() =>
          setSelectTextDrawer((prev) => ({ ...prev, open: false }))
        }
        onTransitionEnd={() => {
          setSelectTextDrawer((prev) => (prev.open ? prev : { open: false }));
        }}
        payload={selectTextDrawer.payload}
      />
    </Stack>
  );
}

function Chat() {
  const [abortable, setAbortable] = useAbortablePromise();
  const selectedConversation = useAppSelector(
    (state) => state.conversations.current
  );
  const selectedConversationTitle = useAppSelector((state) => {
    const current = state.conversations.current;
    if (current === null) return null;
    const currentConversation = state.conversations.conversations[current];
    if (!currentConversation) return null;
    return currentConversation.title;
  });
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
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
            >
              {selectedConversationTitle || t("New chat")}
            </Typography>
            <IconButton
              aria-label={t("start-a-new-chat")}
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
        <Box component={StickToBottom} sx={{ flexGrow: 1, minHeight: 0 }}>
          <Box
            component={StickToBottom.Content}
            sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
          >
            <Main abortable={abortable} setAbortable={setAbortable} />
          </Box>
        </Box>
      </Stack>
    </Stack>
  );
}

export default Chat;
