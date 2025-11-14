import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  completionApplyTemplate,
  encodeSingleToken,
  getTokenizer,
  tokenizeCompletion,
  useContinueGeneration,
  useForward,
  useGenerate,
  useMoreLogprobs,
} from "../hooks";
import AssistantMessageEditor, {
  MessageHeader,
} from "./AssistantMessageEditor";
import CompletionTokensRenderer from "./CompletionTokensRenderer";
import { TokenLogprobs } from "./MessageViewer";

type Content =
  | string
  | Array<{ type: "text"; text: string } | { type: "image"; image: string }>;

export type DatasetRecord = {
  prompt: Array<{ role: string; content: Content }>;
  tools?: Array<any>;
  completion: Array<{
    role: string;
    content: string | null;
    thinking?: string;
  }>;
  anchors?: Array<{
    token_index: number;
    token_id: number;
    confidence?: number;
  }>;
};

export function EditableMessage({
  role,
  content,
  readonly,
  stickyHeader,
  onChange,
}: {
  role: string;
  content: Content;
  readonly?: boolean;
  stickyHeader?: boolean;
  onChange?: (newContent: Content) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    setValue(content);
  }, [content]);

  return (
    <Box>
      <MessageHeader sx={{ position: stickyHeader ? "sticky" : "static" }}>
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {role}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5}>
            {!readonly && (
              <IconButton
                ref={editButtonRef}
                aria-label={editing ? t("Save") : t("Edit")}
                size="small"
                color={editing ? "primary" : "default"}
                sx={{ marginTop: -1, marginRight: -1 }}
                onClick={() => {
                  if (editing) {
                    setEditing(false);
                    if (value !== content) onChange?.(value);
                  } else {
                    setEditing(true);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Stack>
      </MessageHeader>

      {typeof content === "string" ? (
        <InputBase
          inputRef={inputRef}
          multiline
          readOnly={!editing}
          minRows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(event) => {
            if (event.relatedTarget === editButtonRef.current) return;
            if (editing && value !== content) onChange?.(value);
            setEditing(false);
          }}
          fullWidth
          sx={{ paddingX: 2, paddingTop: 1, paddingBottom: 2 }}
        />
      ) : (
        <Box sx={{ paddingX: 2, paddingTop: 1, paddingBottom: 2 }}>
          {content.map((part, i) =>
            part.type === "text" ? (
              <Typography
                key={i}
                variant="body1"
                component="div"
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {part.text}
              </Typography>
            ) : part.type === "image" ? (
              <Box
                key={i}
                component="img"
                src={part.image}
                alt=""
                sx={{ maxWidth: "100%" }}
              />
            ) : null
          )}
        </Box>
      )}
    </Box>
  );
}

function DatasetRecordEditor({
  record,
  model,
  onChange,
}: {
  record: DatasetRecord;
  model?: string;
  onChange: (record: (prev: DatasetRecord) => DatasetRecord) => void;
}) {
  const [generationAbortController, setGenerationAbortController] = useState<
    AbortController | undefined
  >(undefined);

  const generate = useGenerate();
  const forward = useForward();
  const continueGeneration = useContinueGeneration();
  const moreLogprobs = useMoreLogprobs();
  const { t } = useTranslation("fineTuning");

  const handleGenerate = useCallback(
    async (signal?: AbortSignal) => {
      const completion = await generate(record.prompt, { signal });

      const message = completion.choices[0].message;
      const thinking =
        "reasoning_content" in message &&
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : undefined;

      onChange?.((prev) => ({
        ...prev,
        completion: [{ role: "assistant", content: message.content, thinking }],
      }));
    },
    [generate, record]
  );

  const lazyTokens = useMemo(
    () =>
      typeof model === "string"
        ? () =>
            tokenizeCompletion({
              model,
              prompt: record.prompt,
              completion: record.completion,
            })
        : undefined,
    [model, record.prompt, record.completion]
  );

  const lazyLogprobs = useMemo(
    () =>
      typeof model === "string"
        ? () =>
            forward({
              prompt: record.prompt,
              completion: record.completion as any,
              tokenizerModel: model,
              topLogprobs: 5,
            })
        : undefined,
    [model, record.prompt, record.completion]
  );

  if (record === null) return null;

  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <Container sx={{ padding: 2 }}>
          <Stack spacing={2}>
            {record.prompt?.map((msg, i) => (
              <Card
                key={i}
                variant="outlined"
                sx={{ borderRadius: 3, overflow: "visible" }}
              >
                <EditableMessage
                  role={msg.role}
                  content={msg.content}
                  stickyHeader
                  onChange={(newValue) => {
                    onChange?.((prev) => {
                      const newContent = { ...prev };
                      newContent.prompt[i] = {
                        ...newContent.prompt[i],
                        content: newValue,
                      };
                      return newContent;
                    });
                  }}
                />
              </Card>
            ))}

            {!record.completion ? (
              <Divider>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    if (generationAbortController) {
                      generationAbortController.abort();
                      return;
                    }

                    const abortController = new AbortController();
                    setGenerationAbortController(abortController);
                    handleGenerate(abortController.signal).finally(() =>
                      setGenerationAbortController(undefined)
                    );
                  }}
                >
                  {generationAbortController ? (
                    <>
                      <CircularProgress size={16} sx={{ marginRight: 1 }} />
                      {t("Stop")}
                    </>
                  ) : (
                    t("Generate")
                  )}
                </Button>
              </Divider>
            ) : (
              <AssistantMessageEditor
                completion={record.completion[0]}
                anchors={record.anchors}
                onChange={(newValue) =>
                  onChange?.((prev) => ({ ...prev, completion: [newValue] }))
                }
                onDelete={() =>
                  onChange?.((prev) => ({
                    ...prev,
                    completion: undefined as any,
                  }))
                }
                applyChatTemplate={() =>
                  completionApplyTemplate({
                    model: model!,
                    prompt: record.prompt,
                    completion: record.completion,
                  })
                }
                slots={{
                  tokensRenderer: CompletionTokensRenderer as any,
                }}
                slotProps={{
                  tokensRenderer: {
                    anchors: record.anchors,
                    lazyTokens,
                    lazyLogprobs,
                    onChange: (newValue) =>
                      onChange?.((prev) => ({
                        ...prev,
                        completion: [newValue],
                      })),
                    onAnchorsChanged: (newValue) => {
                      onChange?.((prev) => ({
                        ...prev,
                        anchors:
                          typeof newValue === "function"
                            ? newValue(record.anchors)
                            : newValue,
                      }));
                    },
                    onContinueGeneration: async ({ tokenIndex, tokenId }) => {
                      const { prefix, token, choice } =
                        await continueGeneration({
                          prompt: record.prompt,
                          completion: record.completion as any,
                          tokenIndex,
                          tokenId,
                          tokenizerModel: model!,
                          topLogprobs: 5,
                        });
                      return { text: token + choice.text, prefix };
                    },
                    onMoreLogprobs: async (tokenIndex: number) => {
                      const logprobs = await moreLogprobs({
                        prompt: record.prompt,
                        completion: record.completion as any,
                        tokenIndex,
                        tokenizerModel: model!,
                        topLogprobs: 20,
                      });
                      if (!logprobs) return null;

                      const tokenizer = await getTokenizer(model!);

                      return {
                        token: logprobs.tokens![0],
                        token_id: encodeSingleToken(
                          tokenizer,
                          logprobs.tokens![0]
                        ),
                        logprob: logprobs.token_logprobs![0],
                        top_logprobs: Object.entries(logprobs.top_logprobs![0])
                          .sort((a, b) => b[1] - a[1])
                          .map(([token, logprob], index) => ({
                            token,
                            token_id: encodeSingleToken(tokenizer, token),
                            logprob,
                            rank: index + 1,
                          })),
                      } as TokenLogprobs;
                    },
                  } as Partial<ComponentProps<typeof CompletionTokensRenderer>>,
                }}
              />
            )}
          </Stack>
        </Container>
      </Box>
    </Stack>
  );
}

export default DatasetRecordEditor;
