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
  Popover,
  Stack,
  ToggleButton,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCalculateKL, useForward, useGenerate } from "./hooks";
import KLViewer, { TokenKLDiversity, TokenLogprobs } from "./MessageViewer";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { decodeToken, ErrorBoundary } from "./utils";

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

function LogprobsViewer({
  logprobs,
  decoder,
  convertToAlpha,
}: {
  logprobs?: Array<TokenLogprobs>;
  decoder: (token: string) => string;
  convertToAlpha?: (x: number) => number;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedLogprob, setSelectedLogprob] = useState<
    TokenLogprobs | undefined
  >(undefined);

  convertToAlpha = convertToAlpha ?? ((x) => (1 - x) * 0.4);

  if (!logprobs) return null;

  return (
    <>
      {logprobs.map((logprob, i) => (
        <Box
          key={i}
          component="span"
          sx={{
            whiteSpace: "pre-wrap",
            backgroundColor: (theme) =>
              alpha(
                theme.palette.secondary.main,
                convertToAlpha(Math.exp(logprob.logprob))
              ),
          }}
          onClick={(event) => {
            setSelectedLogprob(logprob);
            setAnchorEl(event.currentTarget);
          }}
        >
          {decoder(logprob.token)}
        </Box>
      ))}

      <Popover
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Card variant="outlined" sx={{ margin: 2, padding: 1 }}>
          {selectedLogprob === undefined ? null : (
            <table>
              <tbody>
                {selectedLogprob.top_logprobs.map((topLogprob) => (
                  <tr key={topLogprob.token_id}>
                    <td>
                      <Box
                        component="span"
                        sx={{ whiteSpace: "pre-wrap", marginRight: 2 }}
                      >
                        {topLogprob.token}
                      </Box>
                    </td>
                    <td>{Math.exp(topLogprob.logprob).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Popover>
    </>
  );
}

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
  generate,
  getLogprobs,
  getKLDiversity,
}: {
  completion?: DatasetRecord["completion"][number];
  role?: string;
  generate?: (signal?: AbortSignal) => Promise<void>;
  getLogprobs?: () => Promise<Array<TokenLogprobs>>;
  getKLDiversity?: () => Promise<Array<TokenKLDiversity>>;
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

  useEffect(() => {
    if (completion === undefined) return;
    setLogprobs(undefined);
    setKLDiversity(undefined);
    setViewer("markdown");
  }, [completion]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <Box sx={{ paddingX: 2, paddingY: 1 }}>
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {role}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5}>
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
        {viewer === "kl" ? (
          <KLViewer klDiversity={klDiversity} />
        ) : viewer === "logp" ? (
          <ErrorBoundary
            fallback={<LogprobsViewer logprobs={logprobs} decoder={(t) => t} />}
          >
            <LogprobsViewer logprobs={logprobs} decoder={decodeToken} />
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
  const generate = useGenerate();
  const forward = useForward();
  const calculateKL = useCalculateKL();

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

  if (record === null) return null;

  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
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
              />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Stack>
  );
}

export default DatasetRecordEditor;
