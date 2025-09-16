import EditIcon from "@mui/icons-material/Edit";
import MergeIcon from "@mui/icons-material/Merge";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import {
  Box,
  Button,
  Card,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputBase,
  Popover,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import OpenAI from "openai";
import { ChatCompletionTokenLogprob } from "openai/resources/index.mjs";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "../../app/hooks";
import { decodeToken } from "./utils";

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

function useForward() {
  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const forward = useCallback(
    async ({
      prompt,
      completion,
      model,
    }: {
      prompt: Array<{ role: string; content: string }>;
      completion: Array<{ role: string; content: string }>;
      model?: string;
    }) => {
      const { AutoTokenizer } = await import("@huggingface/transformers");

      model = model ?? "openai/gpt-oss-120b";

      const tokenizer = await AutoTokenizer.from_pretrained(model);
      if (!tokenizer.chat_template) {
        const { downloadFile } = await import("@huggingface/hub");
        const templateBlob = await downloadFile({
          repo: model,
          path: "chat_template.jinja",
        });
        const chatTemplate = await templateBlob?.text();
        tokenizer.chat_template = chatTemplate;
      }

      const text = tokenizer.apply_chat_template([...prompt, ...completion], {
        tokenize: false,
      }) as string;

      const client = new OpenAI({
        apiKey: currentPreset?.apiKey,
        baseURL: currentPreset?.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const extraBody: Record<string, any> = { prompt_logprobs: 1 };
      const logprobsResponse = await client.completions.create({
        model: "gpt-oss-120b",
        prompt: text,
        max_tokens: 1,
        ...extraBody,
      });

      const choice = logprobsResponse.choices[0];
      if (!("prompt_logprobs" in choice))
        throw new Error("No prompt_logprobs in completion");

      const promptLogprobs = choice.prompt_logprobs as Array<{
        [tokenId: string]: {
          logprob: number;
          rank: number;
          decoded_token: string;
        };
      }>;

      const promptIds = tokenizer.apply_chat_template(prompt, {
        add_generation_prompt: true,
      }) as { size: number };
      promptLogprobs.splice(0, promptIds.size);

      return promptLogprobs;
    },
    [currentPreset]
  );

  return forward;
}

type TokenKLDiversity = {
  token: string;
  lpr: number;
  teacherLogprob: number;
  logprobs: {
    [tokenId: string]: {
      logprob: number;
      rank: number;
      decoded_token: string;
    };
  };
};

function useCalculateKL() {
  const forward = useForward();

  const calculateKL = useCallback(
    async ({
      prompt,
      teacherPrompt,
      completion,
      model,
    }: {
      prompt: Array<{ role: string; content: string }>;
      teacherPrompt: Array<{ role: string; content: string }>;
      completion: Array<{ role: string; content: string }>;
      model?: string;
    }) => {
      const logprobs = await forward({ model, prompt, completion });
      const teacherLogprobs = await forward({
        model,
        prompt: teacherPrompt,
        completion,
      });

      if (logprobs.length !== teacherLogprobs.length)
        throw new Error("Logprobs length mismatch");

      const klValues = teacherLogprobs.map((teacherLogprob, i) => {
        const logprob = logprobs[i];
        const tokenId = (() => {
          for (const id of Object.keys(teacherLogprob))
            if (id in logprob) return id;
        })();

        if (!tokenId)
          throw new Error(`Token ID not found in logprobs at position ${i}`);

        return {
          token: teacherLogprob[tokenId].decoded_token,
          lpr: logprob[tokenId].logprob - teacherLogprob[tokenId].logprob,
          teacherLogprob: teacherLogprob[tokenId].logprob,
          logprobs: logprob,
        } as TokenKLDiversity;
      });

      return klValues;
    },
    [forward]
  );

  return calculateKL;
}

function LogprobsViewer({
  logprobs,
  decoder,
  convertToAlpha,
}: {
  logprobs: Array<ChatCompletionTokenLogprob> | null;
  decoder: (token: string) => string;
  convertToAlpha?: (x: number) => number;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedLogprob, setSelectedLogprob] = useState<
    ChatCompletionTokenLogprob | undefined
  >(undefined);

  convertToAlpha = convertToAlpha ?? ((x) => x * 0.4);

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
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        <Card variant="outlined" sx={{ margin: 2, padding: 1 }}>
          {selectedLogprob === undefined ? null : !selectedLogprob.top_logprobs
              .length ? (
            Math.exp(selectedLogprob.logprob).toFixed(3)
          ) : (
            <table>
              <tbody>
                {selectedLogprob.top_logprobs.map((topLogprob) => (
                  <tr key={topLogprob.token}>
                    <td>
                      <Box
                        component="span"
                        sx={{ whiteSpace: "pre-wrap", marginRight: 2 }}
                      >
                        {decoder(topLogprob.token)}
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

function KLViewer({
  klDiversity,
  decoder,
  convertToAlpha,
}: {
  klDiversity: Array<TokenKLDiversity> | null;
  decoder?: (token: string) => string;
  convertToAlpha?: (x: number) => number;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedKL, setSelectedKL] = useState<TokenKLDiversity | undefined>(
    undefined
  );

  decoder = decoder ?? ((x) => x);
  convertToAlpha = convertToAlpha ?? ((x) => Math.max(Math.tanh(-x) * 0.4, 0));

  if (!klDiversity) return null;

  return (
    <>
      {klDiversity.map((kl, i) => (
        <Box
          key={i}
          component="span"
          sx={{
            whiteSpace: "pre-wrap",
            backgroundColor: (theme) =>
              alpha(theme.palette.secondary.main, convertToAlpha(kl.lpr)),
          }}
          onClick={(event) => {
            setSelectedKL(kl);
            setAnchorEl(event.currentTarget);
          }}
        >
          {decoder(kl.token)}
        </Box>
      ))}

      {selectedKL && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
        >
          <Box sx={{ paddingX: 2 }}>
            <Table size="small" sx={{ marginTop: 1 }}>
              <TableBody>
                <TableRow>
                  <TableCell>Token</TableCell>
                  <TableCell align="right">
                    {decoder(selectedKL.token)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Teacher prob</TableCell>
                  <TableCell align="right">
                    <code>
                      {Math.exp(selectedKL.teacherLogprob).toFixed(3)}
                    </code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>LPR</TableCell>
                  <TableCell align="right">
                    <code>{selectedKL.lpr.toFixed(3)}</code>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography
              variant="subtitle2"
              sx={{ marginTop: 2, marginBottom: 1 }}
            >
              Top prob tokens
            </Typography>
            <Card sx={{ marginTop: 1, marginBottom: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Token</TableCell>
                    <TableCell align="right">Prob</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(selectedKL.logprobs).map(
                    ([tokenId, logprob], index) => (
                      <TableRow
                        key={tokenId}
                        sx={{
                          backgroundColor:
                            index % 2 === 0
                              ? "action.hover"
                              : "background.paper",
                        }}
                      >
                        <TableCell>
                          <Box
                            component="span"
                            sx={{ whiteSpace: "pre-wrap", marginRight: 2 }}
                          >
                            {decoder(logprob.decoded_token)}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <code>{Math.exp(logprob.logprob).toFixed(3)}</code>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </Card>
          </Box>
        </Popover>
      )}
    </>
  );
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

function Completion({
  completion,
}: {
  completion: DatasetRecord["completion"][0];
}) {
  return (
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

function DatasetRecordEditor({
  record,
  onChange,
}: {
  record: DatasetRecord & {
    teacher_completion?: Array<{ role: string; content: string }>;
  };
  onChange: (record: DatasetRecord) => void;
}) {
  const [logprobs, setLogprobs] =
    useState<Array<ChatCompletionTokenLogprob> | null>(null);
  const [showLogprobs, setShowLogprobs] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const [teacherViewer, setTeacherViewer] = useState<
    "markdown" | "logp" | "kl"
  >("markdown");
  const [teacherLogprobs, setTeacherLogprobs] =
    useState<Array<ChatCompletionTokenLogprob> | null>(null);
  const [showTeacherLogprobs, setShowTeacherLogprobs] = useState(false);
  const [klDiversity, setKLDiversity] =
    useState<Array<TokenKLDiversity> | null>(null);
  const [teacherAbortController, setTeacherAbortController] =
    useState<AbortController | null>(null);

  const generate = useGenerate();
  const calculateKL = useCalculateKL();

  const { t } = useTranslation();

  const handleGenerate = useCallback(async () => {
    const abortController = new AbortController();
    setAbortController(abortController);

    try {
      const completion = await generate(record.prompt, {
        signal: abortController.signal,
      });

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

  const handleTeacherGenerate = useCallback(async () => {
    const abortController = new AbortController();
    setTeacherAbortController(abortController);

    try {
      const completion = await generate(record.teacher_prompt, {
        signal: abortController.signal,
      });

      const message = completion.choices[0].message;
      const thinking =
        "reasoning_content" in message &&
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : undefined;

      setTeacherLogprobs(completion.choices[0].logprobs?.content ?? null);
      const newContent = {
        ...record,
        teacher_completion: [
          {
            role: "assistant",
            content: completion.choices[0].message.content,
            thinking,
          },
        ],
      };
      onChange?.(newContent);
    } finally {
      setTeacherAbortController(null);
    }
  }, [generate, record]);

  const handleMerge = useCallback(async () => {
    if (!record.teacher_completion) return;
    const klValues = await calculateKL({
      prompt: record.prompt,
      teacherPrompt: record.teacher_prompt,
      completion: record.teacher_completion!,
    });
    setKLDiversity(klValues);
  }, [calculateKL, record]);

  if (record === null) return null;

  const renderedCompletion = record.completion?.[0] && (
    <Completion completion={record.completion[0]} />
  );
  const renderedTeacherCompletion = (record as any).teacher_completion?.[0] && (
    <Completion completion={(record as any).teacher_completion[0]} />
  );

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

              <Card variant="outlined" sx={{ borderRadius: 3, padding: 2 }}>
                <Stack direction="row">
                  <Typography
                    variant="subtitle2"
                    sx={{ textTransform: "capitalize" }}
                  >
                    {record.completion?.[0]?.role ?? "assistant"}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton
                    size="small"
                    sx={{ marginTop: -1, marginRight: -1 }}
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
                </Stack>
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

              <Card variant="outlined" sx={{ borderRadius: 3, padding: 2 }}>
                <Stack direction="row">
                  <Typography
                    variant="subtitle2"
                    sx={{ textTransform: "capitalize" }}
                  >
                    {record.completion?.[0]?.role ?? "assistant"}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Box sx={{ marginTop: -1, marginRight: -1 }}>
                    <ToggleButtonGroup
                      size="small"
                      value={teacherViewer}
                      exclusive
                      onChange={(_, v) => {
                        if (v) setTeacherViewer(v);
                      }}
                      sx={{ marginRight: 1 }}
                    >
                      <ToggleButton value="markdown">MD</ToggleButton>
                      <ToggleButton value="logp">logP</ToggleButton>
                      <ToggleButton value="kl">KL</ToggleButton>
                    </ToggleButtonGroup>
                    <IconButton
                      aria-label={t("Merge")}
                      size="small"
                      disabled={!record.teacher_completion}
                      onClick={handleMerge}
                    >
                      <MergeIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      {...(teacherAbortController
                        ? {
                            "aria-label": t("Stop generating"),
                            onClick: () => teacherAbortController.abort(),
                            children: <StopIcon fontSize="small" />,
                          }
                        : {
                            "aria-label": t("Generate"),
                            onClick: handleTeacherGenerate,
                            children: <SendIcon fontSize="small" />,
                          })}
                    />
                  </Box>
                </Stack>
                {teacherLogprobs && (
                  <Box>
                    <FormControl>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showTeacherLogprobs}
                            onChange={(e) =>
                              setShowTeacherLogprobs(e.target.checked)
                            }
                          ></Switch>
                        }
                        label={t("Show logprobs")}
                      ></FormControlLabel>
                    </FormControl>
                  </Box>
                )}
                {klDiversity ? (
                  <KLViewer klDiversity={klDiversity} />
                ) : teacherLogprobs && showTeacherLogprobs ? (
                  <ErrorBoundary
                    fallback={
                      <LogprobsViewer
                        logprobs={teacherLogprobs}
                        decoder={(t) => t}
                      />
                    }
                  >
                    <LogprobsViewer
                      logprobs={teacherLogprobs}
                      decoder={decodeToken}
                    />
                  </ErrorBoundary>
                ) : (
                  renderedTeacherCompletion
                )}
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Stack>
  );
}

export default DatasetRecordEditor;
