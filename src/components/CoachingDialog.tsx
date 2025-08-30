import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { configureStore } from "@reduxjs/toolkit";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "../app/hooks";
import messageReducer, {
  ChatMessage,
  remove as removeMessage,
} from "../app/messages";
import {
  messageDispatchWrapper,
  normMessage,
  streamRequestAssistant,
} from "../app/thunks";
import MessageList from "./MessageList";

function messageStoreInitializer(messages: ChatMessage[]) {
  return configureStore({
    reducer: messageReducer,
    preloadedState: {
      messages: Object.fromEntries(
        messages.map((msg) => [msg.id, msg] as const)
      ),
    },
  });
}

function toTrainingRecord(
  messages: ChatMessage[],
  options?: { instructions: string; tools?: any[] }
) {
  const records = messages.flatMap((msg) => {
    switch (msg.object) {
      case "message":
        return [{ role: msg.role as string, content: msg.content[0].text }];

      case "response":
        const records = [];
        let pendingReasoning: string | undefined = undefined;
        for (const item of msg.output) {
          switch (item.type) {
            case "reasoning":
              pendingReasoning = (item.content ?? item.summary)
                .map((part) => part.text)
                .join("\n");
              break;
            case "message":
              records.push({
                role: "assistant",
                content: item.content.map((part) =>
                  part.type === "refusal" ? part.refusal : part.text
                ),
                thinking: pendingReasoning,
              });
              break;
          }
        }
        return records;

      case "function_call_output":
        return [{ role: "tool", content: msg.output }];
    }
  });

  if (options?.instructions)
    records.unshift({ role: "system", content: options.instructions });

  return records;
}

function CoachingDialog({
  open,
  onClose,
  prevMessages,
}: {
  open: boolean;
  onClose: () => void;
  prevMessages: ChatMessage[] | null;
  badResponse: ChatMessage | null;
}) {
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[] | null>(
    null
  );
  const [messageStore, setMessageStore] = useState<ReturnType<
    typeof messageStoreInitializer
  > | null>(null);
  const [instructions, setInstructions] = useState("");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [greedyDecoding, setGreedyDecoding] = useState(false);

  const provider = useAppSelector((state) => state.provider);

  const { t } = useTranslation();

  useEffect(() => {
    if (!open || !prevMessages) return setMessageStore(null);

    setCurrentMessages(prevMessages);
    const store = messageStoreInitializer(prevMessages);
    store.subscribe(() =>
      setCurrentMessages(Object.values(store.getState().messages))
    );
    setMessageStore(store);
  }, [open, prevMessages]);

  const UserMessageActions = useMemo(
    () =>
      ({
        message,
      }: {
        message: ResponseInputItem.Message & {
          id: string;
          object: "message";
          timestamp: number;
        };
      }) =>
        (
          <Stack
            direction="row"
            gap="4px"
            sx={{ marginTop: 1, alignItems: "center" }}
          >
            <IconButton
              aria-label="Edit"
              sx={{ width: "28px", height: "28px", borderRadius: 1 }}
              onClick={() => setEditingMessage(message)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
    []
  );

  const handleSend = useCallback(() => {
    if (!messageStore?.dispatch || !currentMessages) return;
    const msgValues = Object.values(messageStore.getState().messages);
    if (
      msgValues.length &&
      msgValues[msgValues.length - 1].object === "response"
    )
      messageStore.dispatch(removeMessage(msgValues[msgValues.length - 1].id));

    const messageDispatch = messageDispatchWrapper(messageStore.dispatch);
    streamRequestAssistant(
      Object.values(currentMessages).flatMap(normMessage),
      {
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        onStreamEvent: messageDispatch,
        instructions: instructions ?? undefined,
        top_p: greedyDecoding ? 0 : undefined,
      }
    );
  }, [
    messageStore?.dispatch,
    currentMessages,
    provider,
    instructions,
    greedyDecoding,
  ]);

  const handleExport = useCallback(() => {
    if (!prevMessages || !currentMessages) {
      console.error("Null messages");
      return;
    }

    const record = {
      prompt: toTrainingRecord(prevMessages),
      teacher_prompt: toTrainingRecord(currentMessages.slice(0, -1)),
      completion: toTrainingRecord(currentMessages.slice(-1)),
    };

    console.log(JSON.stringify(record));
  }, [prevMessages, currentMessages]);

  if (!currentMessages) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            overflow: "hidden", // KaTeX overflow?
          },
        },
      }}
    >
      <DialogTitle sx={{ padding: 0, backgroundColor: "background.default" }}>
        <Toolbar disableGutters>
          <IconButton aria-label="Close" size="large" onClick={onClose}>
            <NavigateBeforeIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
          >
            {t("Coach")}
          </Typography>
          <Box sx={{ width: 48 }} />
        </Toolbar>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          paddingX: 2,
          paddingBottom: 0,
          backgroundColor: (theme) => theme.palette.background.paper,
        }}
      >
        <Container sx={{ paddingX: 0, paddingY: 2 }}>
          <Card variant="outlined">
            <CardContent sx={{ "&:last-child": { paddingBottom: 2 } }}>
              <TextField
                variant="filled"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                label={t("Instructions")}
                fullWidth
                multiline
                sx={{ marginBottom: 2 }}
              />
              <MessageList
                messages={Object.values(currentMessages)}
                slots={{ messageActions: UserMessageActions }}
              />
            </CardContent>
          </Card>
        </Container>
      </DialogContent>
      <DialogActions sx={{ paddingX: 2 }}>
        <Container sx={{ paddingX: 0 }}>
          <Stack gap={1} sx={{ flexDirection: "row" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={greedyDecoding}
                  onChange={(event) => setGreedyDecoding(event.target.checked)}
                ></Switch>
              }
              label={t("Greedy Decoding")}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" onClick={handleSend}>
              {t("Send")}
            </Button>
            <Button variant="contained" onClick={handleExport}>
              {t("Export")}
            </Button>
          </Stack>
        </Container>
      </DialogActions>
    </Dialog>
  );
}

export default CoachingDialog;
