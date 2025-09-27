import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
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
  useEventCallback,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "../Markdown";
import { LogprobPopover, TokenLogprobs, TokensViewer } from "./MessageViewer";
import TextToggleButtonGroup from "./TextToggleButtonGroup";
import { parseCompletion } from "./utils";

export type DatasetRecord = {
  prompt: Array<{ role: string; content: string }>;
  teacher_prompt: Array<{ role: string; content: string }>;
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

function toggleAnchor(
  anchors: DatasetRecord["anchors"] | undefined,
  anchor: { token_index: number; token_id: number },
  value: boolean
) {
  anchors ??= [];
  if (value)
    return [
      ...anchors.filter((anchor) => anchor.token_index < anchor.token_index),
      anchor,
      ...anchors.filter((anchor) => anchor.token_index > anchor.token_index),
    ];
  else {
    const newAnchors = anchors.filter(
      (anchor) => anchor.token_index !== anchor.token_index
    );
    return newAnchors.length === 0 ? undefined : newAnchors;
  }
}

function makeConfidenceMarks(selectedLogprob: TokenLogprobs) {
  const selectedProb = Math.exp(selectedLogprob.logprob);
  const topLogprobs = [...selectedLogprob.top_logprobs].sort(
    (a, b) => a.rank - b.rank
  );

  const minConfidenceDelta = 0.2;

  let prevConfidence = undefined;
  const marks = [] as Array<{ value: number; label: string }>;

  for (const logp of topLogprobs) {
    if (logp.logprob <= selectedLogprob.logprob) break;

    const prob = Math.exp(logp.logprob);
    const relativeConfidence = 1 - 1 / (1 + prob - selectedProb);
    if (
      prevConfidence !== undefined &&
      prevConfidence - relativeConfidence < minConfidenceDelta
    )
      continue;

    prevConfidence = relativeConfidence;
    marks.push({ value: relativeConfidence, label: logp.token });
  }

  return marks;
}

function AssistantMessageEditor({
  completion,
  role = "assistant",
  anchors,
  tokenizeCompletion,
  getLogprobs,
  onAnchorsChanged,
  onChange,
  slotProps,
}: {
  completion: DatasetRecord["completion"][number];
  role?: string;
  anchors?: DatasetRecord["anchors"];
  tokenizeCompletion?: () => Promise<Array<string>>;
  getLogprobs?: () => Promise<Array<TokenLogprobs>>;
  onAnchorsChanged?: React.Dispatch<
    React.SetStateAction<DatasetRecord["anchors"]>
  >;
  onChange?: (newValue: DatasetRecord["completion"][number]) => void;
  slotProps: {
    continueButton?: (params: { tokenIndex: number; tokenId: number }) => {
      onClick?: () => Promise<{ text: string; prefix: string }>;
    };
  };
}) {
  const [viewer, setViewer] = useState<"markdown" | "tokens">("markdown");
  const [tokens, setTokens] = useState<Array<string> | null>(null);
  const [logprobs, setLogprobs] = useState<Array<TokenLogprobs> | undefined>(
    undefined
  );
  const [editing, setEditing] = useState(false);
  const [editingCompletion, setEditingCompletion] = useState("");
  const [draft, setDraft] = useState<
    { text: string; prefix: string } | undefined
  >(undefined);
  const [error, setError] = useState("");

  const { t } = useTranslation();

  const reloadViewer = useEventCallback(() => {
    if (viewer === "tokens") getLogprobs?.().then(setLogprobs);
    else setLogprobs(undefined);
  });

  useEffect(() => {
    if (completion === undefined) return;
    reloadViewer();
  }, [completion]);

  useEffect(() => {
    if (!tokenizeCompletion) return;
    tokenizeCompletion().then(setTokens);
  }, [tokenizeCompletion]);

  const convertLogprobToAlpha = (x: number) => (1 - Math.exp(x)) * 0.4;

  const popoverChildren = ({
    selected,
    onClose,
  }: {
    selected: number;
    onClose: () => void;
  }) => {
    if (!logprobs) return null;
    const selectedLogprob = logprobs[selected];

    const confidenceMarks = makeConfidenceMarks(selectedLogprob);

    return (
      <LogprobPopover
        logprob={logprobs[selected]}
        onClose={onClose}
        slotProps={{
          anchorEditor: {
            anchored: (anchors ?? []).some(
              (token) => token.token_index === selected
            ),
            onChange: (value) =>
              onAnchorsChanged?.((anchors) =>
                toggleAnchor(
                  anchors,
                  {
                    token_index: selected,
                    token_id: logprobs[selected].token_id,
                  },
                  value
                )
              ),
            confidence: (anchors ?? []).find(
              (token) => token.token_index === selected
            )?.confidence,
            onConfidenceChange: (value) =>
              onAnchorsChanged?.((anchors) => {
                if (!anchors) return anchors;
                return anchors.map((anchor) =>
                  anchor.token_index === selected
                    ? { ...anchor, confidence: value }
                    : anchor
                );
              }),
            marks: confidenceMarks,
          },
        }}
        onContinueGeneration={async (tokenId: number) => {
          const onClick = slotProps.continueButton?.({
            tokenIndex: selected,
            tokenId: tokenId,
          })?.onClick;
          if (!onClick) return;
          const draft = await onClick();
          setDraft(draft);
        }}
      />
    );
  };

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
              if (v === "tokens" && logprobs === undefined && getLogprobs)
                getLogprobs()
                  .then(setLogprobs)
                  .catch((reason) => setError(reason.toString()));
            }}
            sx={{ marginLeft: 2 }}
          >
            <ToggleButton value="markdown">MD</ToggleButton>
            {Boolean(getLogprobs) && (
              <ToggleButton value="tokens">Tok</ToggleButton>
            )}
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
                    setTokens(null);
                    setLogprobs(undefined);
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
                disabled={!tokens}
                onClick={() => {
                  if (!tokens) return;
                  setEditing((oldValue) => !oldValue);
                  if (editing) {
                    onChange?.(parseCompletion(editingCompletion));
                    setTokens(null);
                    setLogprobs(undefined);
                  } else setEditingCompletion(tokens.join(""));
                }}
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
          ) : (
            tokens && (
              <TokensViewer
                tokens={tokens}
                slotProps={{
                  typography: ({ index }) => ({
                    sx: {
                      color: anchors?.some((p) => p.token_index === index)
                        ? "primary.main"
                        : undefined,
                      backgroundColor: (theme) =>
                        logprobs &&
                        alpha(
                          theme.palette.secondary.main,
                          convertLogprobToAlpha(logprobs[index].logprob)
                        ),
                    },
                  }),
                  popover: { children: popoverChildren },
                }}
              />
            )
          )
        ) : (
          <Box>
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
          </Box>
        )}
      </Box>
    </Card>
  );
}

export default AssistantMessageEditor;
