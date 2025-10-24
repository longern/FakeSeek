import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
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
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "../Markdown";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { parseCompletion } from "./utils";
import type { DatasetRecord } from "./DatasetRecordEditor";

export function KeepMounted({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted ? (
    <Box sx={{ display: open ? undefined : "none" }}>{children}</Box>
  ) : null;
}

interface TokenRendererProps {
  anchors?: DatasetRecord["anchors"];
  onDraft: (draft: { text: string; prefix: string }) => void;
  [key: string]: any;
}

function AssistantMessageEditor({
  completion,
  role = "assistant",
  anchors,
  hideLogprobs,
  applyChatTemplate,
  onChange,
  onDelete,
  slots,
  slotProps,
}: {
  completion: DatasetRecord["completion"][number];
  role?: string;
  anchors?: DatasetRecord["anchors"];
  hideLogprobs?: boolean;
  applyChatTemplate?: (
    completion: DatasetRecord["completion"][number]
  ) => Promise<string>;
  onChange?: (newValue: DatasetRecord["completion"][number]) => void;
  onDelete?: () => void;
  slots?: { tokensRenderer?: React.ComponentType<TokenRendererProps> };
  slotProps?: { tokensRenderer?: any };
}) {
  const {
    tokensRenderer: TokensRenderer = (() =>
      null) as React.ComponentType<TokenRendererProps>,
  } = slots ?? {};

  const [viewer, setViewer] = useState<"markdown" | "tokens">("markdown");
  const [editing, setEditing] = useState(false);
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
            {role}
          </Typography>
          <TextToggleButtonGroup
            size="small"
            value={viewer}
            exclusive
            onChange={(_, v) => {
              if (v) setViewer(v);
              setError("");
              if (v !== "tokens") setEditing(false);
            }}
            sx={{ marginLeft: 2 }}
          >
            <ToggleButton value="markdown">MD</ToggleButton>
            {!hideLogprobs && <ToggleButton value="tokens">Tok</ToggleButton>}
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
            {viewer === "tokens" && (
              <IconButton
                size="small"
                aria-label={editing ? t("Save") : t("Edit")}
                disabled={!applyChatTemplate}
                onClick={async () => {
                  if (!applyChatTemplate) return;
                  setEditing((oldValue) => !oldValue);
                  const originalCompletion = await applyChatTemplate(
                    completion
                  );
                  if (editing) {
                    if (editingCompletion === originalCompletion) return;
                    onChange?.(parseCompletion(editingCompletion));
                  } else {
                    setEditingCompletion(originalCompletion);
                  }
                }}
              >
                {editing ? (
                  <SaveIcon fontSize="small" />
                ) : (
                  <EditIcon fontSize="small" />
                )}
              </IconButton>
            )}
            <IconButton
              size="small"
              aria-label={t("Delete assistant message")}
              onClick={() => {
                const confirmed = window.confirm(
                  t("Are you sure you want to delete this assistant message?")
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
        ) : viewer === "tokens" ? (
          editing ? (
            <InputBase
              value={editingCompletion}
              multiline
              fullWidth
              sx={{ lineHeight: 1.5, padding: 0 }}
              onChange={(event) => setEditingCompletion(event.target.value)}
            />
          ) : null
        ) : null}

        <KeepMounted open={viewer === "tokens" && !editing && !draft}>
          <TokensRenderer
            anchors={anchors}
            onDraft={(draft) => setDraft(draft)}
            {...slotProps?.tokensRenderer}
          />
        </KeepMounted>

        <KeepMounted open={viewer === "markdown"}>
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
        </KeepMounted>
      </Box>
    </Card>
  );
}

export default AssistantMessageEditor;
