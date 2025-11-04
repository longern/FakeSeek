import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Card,
  CircularProgress,
  IconButton,
  InputBase,
  Stack,
  styled,
  ToggleButton,
  Typography,
} from "@mui/material";
import React, { Activity, lazy, Suspense, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DatasetRecord } from "./DatasetRecordEditor";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { parseCompletion } from "../utils";

const Markdown = lazy(() => import("../../Markdown"));

interface TokenRendererProps {
  anchors?: DatasetRecord["anchors"];
  setActions: (actions: () => { render: React.ReactNode }) => void;
  [key: string]: any;
}

type CompletionMessage = DatasetRecord["completion"][number];

export const MessageHeader = styled(Box)(({ theme }) => ({
  paddingLeft: theme.spacing(1.2),
  paddingRight: theme.spacing(1.2),
  [theme.breakpoints.up("sm")]: { paddingLeft: theme.spacing(2) },
  paddingTop: theme.spacing(0.8),
  paddingBottom: theme.spacing(0.8),
  position: "sticky",
  top: 0,
  borderBottom: `1px solid ${theme.palette.divider}`,
  borderTopLeftRadius: "12px",
  borderTopRightRadius: "12px",
  backgroundColor: theme.palette.background.paper,
  zIndex: 1,
}));

function AssistantMessageEditor({
  completion,
  anchors,
  applyChatTemplate,
  onChange,
  onDelete,
  slots,
  slotProps,
}: {
  completion: CompletionMessage;
  anchors?: DatasetRecord["anchors"];
  applyChatTemplate?: (completion: CompletionMessage) => Promise<string>;
  onChange?: (newValue: CompletionMessage) => void;
  onDelete?: () => void;
  slots?: { tokensRenderer?: React.ComponentType<TokenRendererProps> };
  slotProps?: { tokensRenderer?: any };
}) {
  const {
    tokensRenderer: TokensRenderer = (() =>
      null) as React.ComponentType<TokenRendererProps>,
  } = slots ?? {};

  const [viewer, setViewer] = useState<"markdown" | "raw" | "tokens">(
    "markdown"
  );
  const [editingCompletion, setEditingCompletion] = useState<string | null>(
    null
  );
  const [actions, setActions] = useState<{ render: () => React.ReactNode }>({
    render: () => null,
  });
  const [error, setError] = useState("");

  const { t } = useTranslation("fineTuning");

  const handleSaveRawEdit = useCallback(async () => {
    if (editingCompletion === null || !applyChatTemplate) return;
    try {
      const originalCompletion = await applyChatTemplate(completion);
      if (editingCompletion === originalCompletion) return;
      onChange?.(parseCompletion(editingCompletion));
    } catch (e: any) {
      setError(e.message);
    }
  }, [applyChatTemplate, completion, editingCompletion, onChange]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "visible" }}>
      <MessageHeader>
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {completion.role}
          </Typography>
          <TextToggleButtonGroup
            size="small"
            value={viewer}
            exclusive
            onChange={(_, v) => {
              if (v) setViewer(v);
              setError("");
              if (v === "raw")
                applyChatTemplate!(completion).then(setEditingCompletion);
            }}
            sx={{ marginLeft: 1.5 }}
          >
            <ToggleButton value="markdown">MD</ToggleButton>
            <ToggleButton value="raw">Raw</ToggleButton>
            <ToggleButton value="tokens">Tok</ToggleButton>
          </TextToggleButtonGroup>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            {actions.render()}

            <IconButton
              size="small"
              aria-label={t("Delete assistant message")}
              onClick={() => {
                const confirmed = window.confirm(
                  t("confirm-delete-assistant-message")
                );
                if (!confirmed) return;
                onDelete?.();
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </MessageHeader>

      <Box
        sx={{
          paddingX: 2,
          paddingTop: 1,
          paddingBottom: 2,
          overflowWrap: "break-word",
        }}
      >
        {error && <Alert severity="error" children={error} />}

        <Activity mode={viewer === "raw" ? "visible" : "hidden"}>
          {editingCompletion === null ? (
            <Box
              sx={{ display: "flex", justifyContent: "center", paddingY: 2 }}
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
              onBlur={handleSaveRawEdit}
            />
          )}
        </Activity>

        <Activity mode={viewer === "tokens" ? "visible" : "hidden"}>
          <TokensRenderer
            anchors={anchors}
            setActions={setActions}
            onChange={onChange}
            {...slotProps?.tokensRenderer}
          />
        </Activity>

        <Activity mode={viewer === "markdown" ? "visible" : "hidden"}>
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
        </Activity>
      </Box>
    </Card>
  );
}

export default AssistantMessageEditor;
