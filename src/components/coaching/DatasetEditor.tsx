import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputBase,
  Pagination,
  Stack,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import OpenAI from "openai";
import { ChatCompletionTokenLogprob } from "openai/resources/index.mjs";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import yaml from "yaml";

import { useAppSelector } from "../../app/hooks";
import { decodeToken } from "./utils";

export async function getDatasetDirectoryHandle() {
  const root = await navigator.storage.getDirectory();
  const coachingDirHandle = await root.getDirectoryHandle(".coaching", {
    create: true,
  });
  const datasetDirectoryHandle = await coachingDirHandle.getDirectoryHandle(
    "datasets",
    { create: true }
  );
  return datasetDirectoryHandle;
}

type DatasetRecord = {
  prompt: Array<{ role: string; content: string }>;
  teacher_prompt: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  completion: Array<{
    role: string;
    content: string | null;
    thinking?: string;
  }>;
};

function parseDataset(content: string): Array<DatasetRecord> {
  return yaml.parseDocument(content).toJS();
}

function useGenerate() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const generate = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      options?: { signal?: AbortSignal }
    ) => {
      if (currentPreset === null) throw new Error("No preset selected");
      const client = new OpenAI({
        apiKey: currentPreset.apiKey,
        baseURL: currentPreset.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const completion = client.chat.completions.create(
        {
          model: currentPreset.defaultModel!,
          messages: messages as any,
          temperature: currentPreset.temperature,
          logprobs: true,
          top_logprobs: 5,
        },
        { signal: options?.signal }
      );
      return completion;
    },
    [currentPreset]
  );

  return generate;
}

function LogprobsViewer({
  logprobs,
  decoder,
}: {
  logprobs: Array<ChatCompletionTokenLogprob> | null;
  decoder: (token: string) => string;
}) {
  if (!logprobs) return null;

  return logprobs.map((logprob, i) => (
    <Tooltip
      key={i}
      title={
        !logprob.top_logprobs.length ? (
          Math.exp(logprob.logprob).toFixed(3)
        ) : (
          <table>
            <tbody>
              {logprob.top_logprobs.map((topLogprob) => (
                <tr key={topLogprob.token}>
                  <td>
                    <Box
                      component="span"
                      sx={{ whiteSpace: "pre-wrap", marginRight: 1 }}
                    >
                      {decoder(topLogprob.token)}
                    </Box>
                  </td>
                  <td>{Math.exp(topLogprob.logprob).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      slotProps={{ transition: { mountOnEnter: true, unmountOnExit: true } }}
    >
      <Box
        component="span"
        sx={{
          whiteSpace: "pre-wrap",
          backgroundColor: (theme) =>
            alpha(
              theme.palette.secondary.main,
              Math.exp(logprob.logprob) * 0.4
            ),
        }}
      >
        {decoder(logprob.token)}
      </Box>
    </Tooltip>
  ));
}

class ErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
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

function DatasetRecordEditor({
  record,
  onChange,
  onDelete,
}: {
  record: DatasetRecord;
  onChange: (record: DatasetRecord) => void;
  onDelete: () => void;
}) {
  const [logprobs, setLogprobs] =
    useState<Array<ChatCompletionTokenLogprob> | null>(null);
  const [showLogprobs, setShowLogprobs] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const generate = useGenerate();

  const { t } = useTranslation();

  const handleGenerate = useCallback(async () => {
    const abortController = new AbortController();
    setAbortController(abortController);

    try {
      const completion = await generate(
        record.teacher_prompt ?? record.prompt,
        { signal: abortController.signal }
      );

      const message = completion.choices[0].message;
      const thinking =
        "reasoning_content" in message &&
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : undefined;

      setLogprobs(completion.choices[0].logprobs?.content ?? null);
      const newContent = {
        ...record,
        completion: [
          {
            role: "assistant",
            content: completion.choices[0].message.content,
            thinking,
          },
        ],
      };
      onChange?.(newContent);
    } finally {
      setAbortController(null);
    }
  }, [generate, record]);

  if (record === null) return null;

  const renderedCompletion = record.completion?.[0] && (
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
        {record.completion[0].thinking}
      </Typography>
      <Box sx={{ whiteSpace: "pre-wrap" }}>{record.completion[0].content}</Box>
    </Box>
  );

  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
        <Container sx={{ paddingY: 1 }}>
          <Stack spacing={2}>
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

            <Card variant="outlined" sx={{ borderRadius: 3, padding: 2 }}>
              {logprobs && (
                <Box>
                  <FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showLogprobs}
                          onChange={(e) => setShowLogprobs(e.target.checked)}
                        ></Switch>
                      }
                      label={t("Show logprobs")}
                    ></FormControlLabel>
                  </FormControl>
                </Box>
              )}
              <Typography
                variant="subtitle2"
                sx={{ textTransform: "capitalize" }}
              >
                {record.completion?.[0]?.role ?? "assistant"}
              </Typography>
              {logprobs && showLogprobs ? (
                <ErrorBoundary
                  fallback={
                    <LogprobsViewer logprobs={logprobs} decoder={(t) => t} />
                  }
                >
                  <LogprobsViewer logprobs={logprobs} decoder={decodeToken} />
                </ErrorBoundary>
              ) : (
                renderedCompletion
              )}
            </Card>
          </Stack>
        </Container>
      </Box>

      <Container sx={{ padding: 1 }}>
        <Stack direction="row" spacing={1}>
          {abortController ? (
            <Button variant="outlined" onClick={() => abortController.abort()}>
              {t("Cancel")}
            </Button>
          ) : (
            <Button variant="outlined" onClick={handleGenerate}>
              {t("Generate")}
            </Button>
          )}
          <IconButton aria-label={t("Delete record")} onClick={onDelete}>
            <DeleteIcon />
          </IconButton>
        </Stack>
      </Container>
    </Stack>
  );
}

function DatasetEditor({
  open,
  onClose,
  datasetName,
}: {
  open: boolean;
  onClose: () => void;
  datasetName?: string;
}) {
  const [content, setContent] = useState<Array<DatasetRecord> | null>(null);
  const [selected, setSelected] = useState(0);
  const [modified, setModified] = useState(false);

  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const { t } = useTranslation();

  const confirmClose = useCallback(() => {
    if (!modified) return onClose();
    const ok = window.confirm(t("confirm-close-with-unsaved-changes"));
    if (ok) onClose();
  }, [modified, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!datasetName || content === null) return;

    const document = new yaml.Document(content);
    document.commentBefore = ` Model: ${currentPreset?.defaultModel}`;
    const documentString = document.toString({ lineWidth: 0 });

    const dir = await getDatasetDirectoryHandle();
    const fileHandle = await dir.getFileHandle(datasetName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(documentString);
    await writable.close();
    setModified(false);
  }, [content, datasetName]);

  useEffect(() => {
    if (!open) return;

    if (!datasetName) {
      setContent([]);
      return;
    }

    getDatasetDirectoryHandle().then(async (dir) => {
      const fileHandle = await dir.getFileHandle(datasetName, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const content = text ? parseDataset(text) : [];
      setContent(content);
      setSelected(0);
      setModified(false);
    });
  }, [open, datasetName]);

  return (
    <Dialog open={open} onClose={confirmClose} fullScreen>
      <DialogTitle sx={{ padding: 0, backgroundColor: "background.default" }}>
        <Toolbar disableGutters>
          <IconButton aria-label="Close" size="large" onClick={confirmClose}>
            <NavigateBeforeIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
            noWrap
          >
            {datasetName}
          </Typography>
          <IconButton
            aria-label="Save"
            size="large"
            disabled={!modified}
            onClick={handleSave}
          >
            <SaveIcon />
          </IconButton>
        </Toolbar>
      </DialogTitle>

      <DialogContent dividers sx={{ padding: 0 }}>
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
            {content?.[selected] === undefined ? (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {content === null
                    ? t("Loading...")
                    : content.length === 0
                    ? t("No records")
                    : t("Out of range")}
                </Typography>
              </Box>
            ) : (
              <DatasetRecordEditor
                key={selected}
                record={content[selected]}
                onChange={(newRecord) => {
                  setContent((prev) => {
                    if (!prev) return prev;
                    const newContent = [...prev];
                    newContent[selected] = newRecord;
                    return newContent;
                  });
                  setModified(true);
                }}
                onDelete={() => {
                  setContent((prev) =>
                    prev ? prev.filter((_, i) => i !== selected) : prev
                  );
                  setSelected((prev) => (prev > 0 ? prev - 1 : 0));
                  setModified(true);
                }}
              />
            )}
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ padding: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Box sx={{ width: "342px" }}>
              <Pagination
                count={content?.length}
                page={selected + 1}
                onChange={(_, page) => setSelected(page - 1)}
                disabled={content === null || content.length === 0}
              />
            </Box>
            <IconButton
              aria-label={t("Add record")}
              size="small"
              onClick={() => {
                setContent((prev) =>
                  prev
                    ? [
                        ...prev,
                        { prompt: [{ role: "user", content: "" }] } as any,
                      ]
                    : prev
                );
                setSelected(content ? content.length : 0);
                setModified(true);
              }}
            >
              <AddIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default DatasetEditor;
