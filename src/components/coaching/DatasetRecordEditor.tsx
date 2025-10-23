import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Card,
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
  tokenizeCompletion,
  useContinueGeneration,
  useForward,
  useGenerate,
} from "./hooks";
import AssistantMessageEditor from "./AssistantMessageEditor";
import CompletionTokensRenderer from "./CompletionTokensRenderer";

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

  const { t } = useTranslation();

  useEffect(() => {
    setValue(content);
  }, [content]);

  return (
    <Box>
      <Box
        sx={{
          paddingX: 2,
          paddingY: 1,
          position: stickyHeader ? "sticky" : undefined,
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
            {!readonly && (
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
            )}
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ paddingX: 2, paddingTop: 1, paddingBottom: 2 }}>
        {typeof content === "string" ? (
          <InputBase
            inputRef={inputRef}
            multiline
            readOnly={!editing}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
          />
        ) : (
          content.map((part, i) =>
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
          )
        )}
      </Box>
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
  onChange: (record: DatasetRecord) => void;
}) {
  const generate = useGenerate();
  const forward = useForward();
  const continueGeneration = useContinueGeneration();
  const { t } = useTranslation();

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
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, overflow: "visible" }}
            >
              {record.prompt?.map((msg, i) => (
                <EditableMessage
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  stickyHeader
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

            {!record.completion ? (
              <Divider>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleGenerate()}
                >
                  {t("Generate")}
                </Button>
              </Divider>
            ) : (
              <AssistantMessageEditor
                role={record.completion[0].role}
                completion={record.completion[0]}
                anchors={record.anchors}
                onChange={(newValue) =>
                  onChange?.({ ...record, completion: [newValue] })
                }
                onDelete={() =>
                  onChange?.({ ...record, completion: undefined as any })
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
                    onAnchorsChanged: (newValue) => {
                      onChange?.({
                        ...record,
                        anchors:
                          typeof newValue === "function"
                            ? newValue(record.anchors)
                            : newValue,
                      });
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
