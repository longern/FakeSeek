import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import {
  Box,
  Button,
  Card,
  Divider,
  Grid,
  IconButton,
  InputBase,
  Stack,
  ToggleButton,
  Typography,
  useEventCallback,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCalculateKL,
  useContinueGeneration,
  useForward,
  useGenerate,
} from "./hooks";
import {
  KLViewer,
  LogprobsViewer,
  TokenKLDiversity,
  TokenLogprobs,
} from "./MessageViewer";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { decodeToken, ErrorBoundary, parseCompletion } from "./utils";

export type DatasetRecord = {
  prompt: Array<{ role: string; content: string }>;
  teacher_prompt: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  completion: Array<{
    role: string;
    content: string | null;
    thinking?: string;
  }>;
};

function EditableMessage({
  role,
  content,
  onChange,
}: {
  role: string;
  content: string;
  onChange?: (newContent: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { t } = useTranslation();

  useEffect(() => {
    setValue(content);
  }, [content]);

  return (
    <Box>
      <Stack direction="row">
        <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
          {role}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label={editing ? t("Save") : t("Edit")}
          size="small"
          onClick={() => {
            if (editing && value !== content) onChange?.(value);
            else inputRef.current?.focus();
            setEditing(!editing);
          }}
          sx={{ marginTop: -1, marginRight: -1 }}
        >
          {editing ? (
            <SaveIcon fontSize="small" />
          ) : (
            <EditIcon fontSize="small" />
          )}
        </IconButton>
      </Stack>
      <InputBase
        inputRef={inputRef}
        multiline
        readOnly={!editing}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        fullWidth
      />
    </Box>
  );
}

function AssistantMessageCard({
  completion,
  role = "assistant",
  draft,
  generate,
  getLogprobs,
  getKLDiversity,
  onApplyDraft,
  onDiscardDraft,
  onContinueGeneration,
}: {
  completion?: DatasetRecord["completion"][number];
  role?: string;
  draft?: { text: string; prefix: string };
  generate?: (signal?: AbortSignal) => Promise<void>;
  getLogprobs?: () => Promise<Array<TokenLogprobs>>;
  getKLDiversity?: () => Promise<Array<TokenKLDiversity>>;
  onApplyDraft?: () => void;
  onDiscardDraft?: () => void;
  onContinueGeneration?: (tokenIndex: number, tokenId: number) => void;
}) {
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [viewer, setViewer] = useState<"markdown" | "logp" | "kl">("markdown");
  const [logprobs, setLogprobs] = useState<Array<TokenLogprobs> | undefined>(
    undefined
  );
  const [klDiversity, setKLDiversity] = useState<
    Array<TokenKLDiversity> | undefined
  >(undefined);

  const { t } = useTranslation();

  const handleGenerate = useCallback(async () => {
    if (!generate) return;
    const abortController = new AbortController();
    setAbortController(abortController);
    generate(abortController.signal).finally(() => setAbortController(null));
  }, [generate]);

  const reloadViewer = useEventCallback(() => {
    if (viewer === "logp") getLogprobs?.().then(setLogprobs);
    else setLogprobs(undefined);

    if (viewer === "kl") getKLDiversity?.().then(setKLDiversity);
    else setKLDiversity(undefined);
  });

  useEffect(() => {
    if (completion === undefined) return;
    reloadViewer();
  }, [completion]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "visible" }}>
      <Box
        sx={{
          paddingX: 2,
          paddingY: 1,
          position: "sticky",
          top: 0,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
          backgroundColor: "background.paper",
          zIndex: 1,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {role}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5}>
            {draft === undefined ? null : (
              <>
                <IconButton
                  size="small"
                  aria-label={t("Apply draft")}
                  onClick={onApplyDraft}
                  color="success"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t("Discard draft")}
                  onClick={onDiscardDraft}
                  color="error"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            )}
            <TextToggleButtonGroup
              size="small"
              value={viewer}
              exclusive
              onChange={(_, v) => {
                if (v) setViewer(v);
                if (v === "logp" && logprobs === undefined && getLogprobs)
                  getLogprobs().then(setLogprobs);
                if (v === "kl" && klDiversity === undefined && getKLDiversity)
                  getKLDiversity().then(setKLDiversity);
              }}
            >
              <ToggleButton value="markdown">MD</ToggleButton>
              {Boolean(getLogprobs) && (
                <ToggleButton value="logp">logP</ToggleButton>
              )}
              {Boolean(getKLDiversity) && (
                <ToggleButton value="kl">KL</ToggleButton>
              )}
            </TextToggleButtonGroup>
            {!generate ? null : (
              <IconButton
                size="small"
                {...(abortController
                  ? {
                      "aria-label": t("Stop generating"),
                      onClick: () => abortController.abort(),
                      children: <StopIcon fontSize="small" />,
                    }
                  : {
                      "aria-label": t("Generate"),
                      onClick: handleGenerate,
                      children: <SendIcon fontSize="small" />,
                    })}
              />
            )}
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ paddingX: 2, paddingBottom: 2 }}>
        {draft ? (
          <>
            <Typography component="span" whiteSpace="pre-wrap">
              {draft.prefix}
            </Typography>
            <Typography
              component="span"
              whiteSpace="pre-wrap"
              color="text.secondary"
            >
              {draft.text}
            </Typography>
          </>
        ) : viewer === "kl" ? (
          <KLViewer
            klDiversity={klDiversity}
            onContinueGeneration={onContinueGeneration}
          />
        ) : viewer === "logp" ? (
          <ErrorBoundary
            fallback={
              <LogprobsViewer
                logprobs={logprobs}
                decoder={(t) => t}
                onContinueGeneration={onContinueGeneration}
              />
            }
          >
            <LogprobsViewer
              logprobs={logprobs}
              decoder={decodeToken}
              onContinueGeneration={onContinueGeneration}
            />
          </ErrorBoundary>
        ) : (
          completion && (
            <Box>
              <Typography
                variant="body2"
                sx={{
                  borderLeft: (theme) => `2px solid ${theme.palette.divider}`,
                  paddingLeft: 1,
                  marginY: 1,
                  whiteSpace: "pre-wrap",
                  color: "text.secondary",
                }}
              >
                {completion.thinking}
              </Typography>
              <Box sx={{ whiteSpace: "pre-wrap" }}>{completion.content}</Box>
            </Box>
          )
        )}
      </Box>
    </Card>
  );
}

function DatasetRecordEditor({
  record,
  onChange,
}: {
  record: DatasetRecord & {
    teacher_completion?: Array<{ role: string; content: string }>;
  };
  onChange: (record: DatasetRecord) => void;
}) {
  const [draft, setDraft] = useState<
    | {
        text: string;
        prefix: string;
      }
    | undefined
  >(undefined);
  const [teacherDraft, setTeacherDraft] = useState<
    | {
        text: string;
        prefix: string;
      }
    | undefined
  >(undefined);

  const generate = useGenerate();
  const forward = useForward();
  const calculateKL = useCalculateKL();
  const continueGeneration = useContinueGeneration();

  const handleGenerate = useCallback(
    async (signal?: AbortSignal) => {
      const completion = await generate(record.prompt, { signal });

      const message = completion.choices[0].message;
      const thinking =
        "reasoning_content" in message &&
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : undefined;

      const newContent = {
        ...record,
        completion: [{ role: "assistant", content: message.content, thinking }],
      };
      onChange?.(newContent);
    },
    [generate, record]
  );

  const handleTeacherGenerate = useCallback(
    async (signal?: AbortSignal) => {
      const completion = await generate(record.teacher_prompt, { signal });

      const message = completion.choices[0].message;
      const thinking =
        "reasoning_content" in message &&
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : undefined;

      const newContent = {
        ...record,
        teacher_completion: [
          { role: "assistant", content: message.content, thinking },
        ],
      };
      onChange?.(newContent);
    },
    [generate, record]
  );

  const handleContinueGeneration = useCallback(
    async (tokenIndex: number, tokenId: number, merge?: boolean) => {
      const {
        prefix,
        token,
        choice: { text },
      } = await continueGeneration({
        prompt: merge ? record.teacher_prompt : record.prompt,
        completion: record.completion as any,
        tokenIndex,
        tokenId,
      });
      setDraft({ text: token + text, prefix });
    },
    [continueGeneration, record]
  );

  const handleTeacherContinueGeneration = useCallback(
    async (tokenIndex: number, tokenId: number, merge?: boolean) => {
      const {
        prefix,
        token,
        choice: { text },
      } = await continueGeneration({
        prompt: merge ? record.prompt : record.teacher_prompt,
        completion: record.teacher_completion as any,
        tokenIndex,
        tokenId,
      });
      setTeacherDraft({ text: token + text, prefix });
    },
    [continueGeneration, record]
  );

  if (record === null) return null;

  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={2} sx={{ padding: 2 }}>
              <Card variant="outlined" sx={{ borderRadius: 3, padding: 2 }}>
                {record.prompt?.map((msg, i) => (
                  <EditableMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    onChange={(newValue) => {
                      const newContent = { ...record };
                      newContent.prompt[i] = {
                        ...newContent.prompt[i],
                        content: newValue,
                      };
                      onChange?.(newContent);
                    }}
                  />
                ))}
              </Card>

              <AssistantMessageCard
                role={record.completion?.[0]?.role}
                completion={record.completion?.[0]}
                draft={draft}
                generate={handleGenerate}
                getLogprobs={async () => {
                  if (!record.completion) throw new Error("No completion");
                  const completion = await forward({
                    prompt: record.prompt,
                    completion: record.completion as any,
                    topLogprobs: 5,
                  });
                  return completion;
                }}
                getKLDiversity={async () => {
                  if (!record.completion)
                    throw new Error("No teacher completion");
                  return await calculateKL({
                    prompt: record.prompt,
                    teacherPrompt: record.teacher_prompt,
                    completion: record.completion as any,
                  });
                }}
                onApplyDraft={() => {
                  if (!draft) return;
                  onChange?.({
                    ...record,
                    completion: [parseCompletion(draft.prefix + draft.text)],
                  });
                  setDraft(undefined);
                }}
                onDiscardDraft={() => setDraft(undefined)}
                onContinueGeneration={handleContinueGeneration}
              />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={2} sx={{ padding: 2 }}>
              <Card variant="outlined" sx={{ borderRadius: 3, padding: 2 }}>
                {record.teacher_prompt === undefined ? (
                  <Button
                    onClick={() => {
                      const newContent = { ...record };
                      newContent.teacher_prompt = [...newContent.prompt];
                      onChange?.(newContent);
                    }}
                  >
                    Copy from prompt
                  </Button>
                ) : (
                  record.teacher_prompt?.map((msg, i) => (
                    <EditableMessage
                      key={i}
                      role={msg.role}
                      content={msg.content}
                      onChange={(newValue) => {
                        const newContent = { ...record };
                        newContent.teacher_prompt![i] = {
                          ...newContent.teacher_prompt![i],
                          content: newValue,
                        };
                        onChange?.(newContent);
                      }}
                    />
                  ))
                )}
              </Card>

              <AssistantMessageCard
                role={record.teacher_completion?.[0]?.role}
                completion={record.teacher_completion?.[0]}
                draft={teacherDraft}
                generate={handleTeacherGenerate}
                getLogprobs={async () => {
                  if (!record.teacher_completion)
                    throw new Error("No completion");
                  const completion = await forward({
                    prompt: record.teacher_prompt,
                    completion: record.teacher_completion as any,
                    topLogprobs: 5,
                  });
                  return completion;
                }}
                getKLDiversity={async () => {
                  if (!record.teacher_completion)
                    throw new Error("No teacher completion");
                  return await calculateKL({
                    prompt: record.teacher_prompt,
                    teacherPrompt: record.prompt,
                    completion: record.teacher_completion!,
                  });
                }}
                onApplyDraft={() => {
                  if (!teacherDraft) return;
                  onChange?.({
                    ...record,
                    completion: [
                      parseCompletion(teacherDraft.prefix + teacherDraft.text),
                    ],
                  });
                  setTeacherDraft(undefined);
                }}
                onDiscardDraft={() => setTeacherDraft(undefined)}
                onContinueGeneration={handleTeacherContinueGeneration}
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Stack>
  );
}

export default DatasetRecordEditor;
