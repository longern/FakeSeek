import {
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Divider,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { completionApplyTemplate, useGenerate } from "../hooks";
import { parseCompletion } from "../utils";
import AssistantMessageCard from "./AssistantMessageCard";
import EditableMessage from "./EditableMessage";
import TokensViewer from "./TokensViewer";

const Markdown = lazy(() => import("../../Markdown"));

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

function MarkdownViewer({
  completion,
}: {
  completion: DatasetRecord["completion"][0];
}) {
  return (
    <>
      <Typography
        variant="body2"
        sx={{
          borderLeft: (theme) => `2px solid ${theme.palette.divider}`,
          paddingLeft: 1,
          marginY: 1,
          color: "text.secondary",
          whiteSpace: "pre-wrap",
        }}
      >
        {completion.thinking}
      </Typography>
      <Suspense fallback={completion.content}>
        <Markdown>{completion.content!}</Markdown>
      </Suspense>
    </>
  );
}

function RawCompletionViewer({
  open,
  completion,
  formatCompletion,
  onChange,
}: {
  open: boolean;
  completion: DatasetRecord["completion"][number];
  formatCompletion: (
    completion: DatasetRecord["completion"][number]
  ) => Promise<string>;
  onChange: (completion: DatasetRecord["completion"][number]) => void;
}) {
  const [editingCompletion, setEditingCompletion] = useState<string | null>(
    null
  );

  const handleSave = useCallback(async () => {
    if (editingCompletion === null) return;
    try {
      const originalCompletion = await formatCompletion(completion);
      if (editingCompletion === originalCompletion) return;
      onChange?.(parseCompletion(editingCompletion));
    } catch (e: any) {
      console.error(e.message);
    }
  }, [editingCompletion, onChange, formatCompletion]);

  useEffect(() => {
    if (!open) return;
    formatCompletion(completion).then(setEditingCompletion);
  }, [open, completion.content]);

  return editingCompletion === null ? (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        paddingY: 2,
      }}
    >
      <CircularProgress />
    </Box>
  ) : (
    <InputBase
      value={editingCompletion}
      multiline
      fullWidth
      sx={{ lineHeight: 1.5, padding: 0 }}
      onChange={(event) => setEditingCompletion(event.target.value)}
      onBlur={handleSave}
    />
  );
}

function DatasetRecordEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Stack sx={{ height: "100%" }} divider={<Divider />}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <Container sx={{ padding: 2 }}>
          <Stack spacing={2}>{children}</Stack>
        </Container>
      </Box>
    </Stack>
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
  const { t } = useTranslation("fineTuning");

  const handleGenerate = useCallback(async () => {
    const abortController = new AbortController();
    setGenerationAbortController(abortController);

    try {
      const completion = await generate(record.prompt, {
        signal: abortController.signal,
      });

      const message = completion.choices[0].message;
      const thinking = ["reasoning", "reasoning_content"].reduce<
        string | undefined
      >(
        (acc, key) =>
          acc ??
          (key in message && typeof message[key] === "string"
            ? message[key]
            : undefined),
        undefined
      );

      onChange?.((prev) => ({
        ...prev,
        completion: [{ role: "assistant", content: message.content, thinking }],
      }));
    } finally {
      setGenerationAbortController(undefined);
    }
  }, [generate, onChange, record.prompt]);

  const formatCompletion = useCallback(
    (completion: DatasetRecord["completion"][number]) => {
      return completionApplyTemplate({
        model: model!,
        prompt: record.prompt,
        completion: [completion],
      });
    },
    [model, record.completion, record.prompt]
  );

  if (record === null) return null;

  return (
    <DatasetRecordEditorLayout>
      {record.prompt?.map((msg, index) => (
        <Card
          key={index}
          variant="outlined"
          sx={{ borderRadius: 3, overflow: "visible" }}
        >
          <EditableMessage
            role={msg.role}
            content={msg.content}
            stickyHeader
            onChange={(newValue) => {
              onChange?.((prev) => ({
                ...prev,
                prompt: prev.prompt.map((m, i) =>
                  i === index ? { ...m, content: newValue } : m
                ),
              }));
            }}
          />
        </Card>
      ))}

      {!record.completion ? (
        <Divider>
          <Button
            variant="outlined"
            size="small"
            onClick={
              generationAbortController
                ? () => generationAbortController.abort()
                : handleGenerate
            }
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
        <AssistantMessageCard
          viewers={{
            markdown: () => (
              <MarkdownViewer completion={record.completion[0]} />
            ),
            raw: ({ open }) => (
              <RawCompletionViewer
                open={open}
                completion={record.completion[0]}
                formatCompletion={formatCompletion}
                onChange={(newValue) =>
                  onChange?.((prev) => ({ ...prev, completion: [newValue] }))
                }
              />
            ),
            tokens: ({ setActions }) =>
              model && (
                <TokensViewer
                  record={record}
                  model={model}
                  onChange={onChange}
                  setActions={setActions}
                />
              ),
          }}
          viewersDisabled={!model ? ["tokens"] : undefined}
          role={record.completion?.[0].role}
          onDelete={() =>
            onChange?.((prev) => ({
              ...prev,
              completion: undefined as any,
              anchors: undefined,
            }))
          }
        />
      )}
    </DatasetRecordEditorLayout>
  );
}

export default DatasetRecordEditor;
