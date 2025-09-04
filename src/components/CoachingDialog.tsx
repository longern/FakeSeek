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
import {
  Response,
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses.mjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { requestResponsesAPI } from "../app/api-modes/responses";
import { useAppSelector } from "../app/hooks";
import messageReducer, {
  addResponse,
  ChatMessage,
  remove as removeMessage,
} from "../app/messages";
import { messageDispatchWrapper, normMessage } from "../app/thunks";
import MessageList from "./MessageList";

type TrainingMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      thinking?: string;
      tool_calls?: Array<{ name: string; arguments: any }>;
    }
  | { role: "tool"; content: string }
  | { role: "system"; content: string };

type TrainingRecord = {
  prompt: TrainingMessage[];
  teacher_prompt: TrainingMessage[];
  completion: TrainingMessage[];
  tools?: Tool[];
};

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

function toTrainingMessages(
  messages: ChatMessage[],
  options?: { instructions?: string }
) {
  const records = messages.flatMap((msg: ChatMessage): TrainingMessage[] => {
    switch (msg.object) {
      case "message":
        return [
          {
            role: "user",
            content: msg.content
              .flatMap((part) =>
                part.type === "input_text" ? [part.text] : []
              )
              .join(""),
          },
        ];

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
                role: "assistant" as const,
                content: item.content
                  .map((part) =>
                    part.type === "refusal" ? part.refusal : part.text
                  )
                  .join(""),
                thinking: pendingReasoning,
              });
              break;
            case "function_call":
              records.push({
                role: "assistant" as const,
                content: null,
                thinking: pendingReasoning,
                tool_calls: [
                  { name: item.name, arguments: JSON.parse(item.arguments) },
                ],
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
  defaultInstructions,
  prevMessages,
  tools,
}: {
  open: boolean;
  onClose: () => void;
  defaultInstructions?: string;
  prevMessages: ChatMessage[] | null;
  badResponse: ChatMessage | null;
  tools?: Tool[];
}) {
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[] | null>(
    null
  );
  const [messageStore, setMessageStore] = useState<ReturnType<
    typeof messageStoreInitializer
  > | null>(null);
  const [instructions, setInstructions] = useState(defaultInstructions ?? "");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [greedyDecoding, setGreedyDecoding] = useState(false);

  const presets = useAppSelector((state) => state.presets);

  const { t } = useTranslation();

  const currentPreset = presets.presets?.[presets.current!];

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
    if (!messageStore?.dispatch) return;
    const msgValues = Object.values(messageStore.getState().messages);
    if (
      msgValues.length &&
      msgValues[msgValues.length - 1].object === "response"
    )
      messageStore.dispatch(removeMessage(msgValues[msgValues.length - 1].id));

    const currentMessages = Object.values(messageStore.getState().messages);
    const messageDispatch = messageDispatchWrapper(messageStore.dispatch);
    requestResponsesAPI(Object.values(currentMessages).flatMap(normMessage), {
      apiKey: currentPreset.apiKey,
      baseURL: currentPreset.baseURL,
      model: currentPreset.defaultModel,
      onStreamEvent: messageDispatch,
      instructions: instructions ?? undefined,
      tools: tools?.length ? tools : undefined,
      temperature: greedyDecoding ? 0 : undefined,
    }).catch((error) => {
      messageStore.dispatch(
        addResponse({
          object: "response",
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          error: {
            code: "server_error",
            message: (error as Error).message,
          },
          output: [],
        } as unknown as Response & { timestamp: number })
      );
    });
  }, [messageStore?.dispatch, currentPreset, instructions, greedyDecoding]);

  const handleExport = useCallback(() => {
    if (!prevMessages || !currentMessages) {
      console.error("Null messages");
      return;
    }

    const record: TrainingRecord = {
      prompt: toTrainingMessages(prevMessages, {
        instructions: defaultInstructions,
      }),
      teacher_prompt: toTrainingMessages(currentMessages.slice(0, -1), {
        instructions,
      }),
      completion: toTrainingMessages(currentMessages.slice(-1)),
      tools: tools?.length ? tools : undefined,
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
                variant="outlined"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                label={t("Instructions")}
                fullWidth
                multiline
                minRows={2}
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
              label={t("Greedy decoding")}
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
