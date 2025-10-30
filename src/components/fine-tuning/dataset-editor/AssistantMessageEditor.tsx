import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  alpha,
  Box,
  Card,
  IconButton,
  InputBase,
  Stack,
  ToggleButton,
  Typography,
} from "@mui/material";
import React, { Activity, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "../../Markdown";
import type { DatasetRecord } from "./DatasetRecordEditor";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { parseCompletion } from "../utils";

interface TokenRendererProps {
  anchors?: DatasetRecord["anchors"];
  onDraft: (draft: { text: string; prefix: string }) => void;
  [key: string]: any;
}

type CompletionMessage = DatasetRecord["completion"][number];

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
  const [editingCompletion, setEditingCompletion] = useState("");
  const [draft, setDraft] = useState<
    { text: string; prefix: string } | undefined
  >(undefined);
  const [error, setError] = useState("");

  const { t } = useTranslation("fineTuning");

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
            sx={{ marginLeft: 2 }}
          >
            <ToggleButton value="markdown">MD</ToggleButton>
            <ToggleButton value="raw">Raw</ToggleButton>
            <ToggleButton value="tokens">Tok</ToggleButton>
          </TextToggleButtonGroup>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5}>
            {draft && (
              <>
                <IconButton
                  size="small"
                  aria-label={t("Apply draft")}
                  onClick={() => {
                    onChange?.(parseCompletion(draft.prefix + draft.text));
                    setDraft(undefined);
                  }}
                  color="success"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t("Discard draft")}
                  onClick={() => setDraft(undefined)}
                  color="error"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            )}
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
      </Box>
      <Box
        sx={{
          paddingX: 2,
          paddingTop: 1,
          paddingBottom: 2,
          overflowWrap: "break-word",
        }}
      >
        {error && <Alert severity="error" children={error} />}

        {draft ? (
          <>
            <Typography component="span" whiteSpace="pre-wrap">
              {draft.prefix}
            </Typography>
            <Typography
              component="span"
              whiteSpace="pre-wrap"
              sx={{
                backgroundColor: (theme) =>
                  alpha(theme.palette.success.main, 0.12),
                color: "text.secondary",
              }}
            >
              {draft.text}
            </Typography>
          </>
        ) : null}

        <Activity mode={viewer === "raw" ? "visible" : "hidden"}>
          <InputBase
            value={editingCompletion}
            multiline
            fullWidth
            sx={{ lineHeight: 1.5, padding: 0 }}
            onChange={(event) => setEditingCompletion(event.target.value)}
            onBlur={async () => {
              try {
                const originalCompletion = await applyChatTemplate!(completion);
                if (editingCompletion === originalCompletion) return;
                onChange?.(parseCompletion(editingCompletion));
              } catch (e: any) {
                setError(e.message);
              }
            }}
          />
        </Activity>

        <Activity mode={viewer === "tokens" && !draft ? "visible" : "hidden"}>
          <TokensRenderer
            anchors={anchors}
            onDraft={setDraft}
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
          <Markdown>{completion.content!}</Markdown>
        </Activity>
      </Box>
    </Card>
  );
}

export default AssistantMessageEditor;
