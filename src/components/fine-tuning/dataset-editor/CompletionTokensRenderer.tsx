import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Alert, alpha, IconButton, Typography } from "@mui/material";
import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseCompletion } from "../utils";
import AnchorEditor from "./AnchorEditor";
import type { DatasetRecord } from "./DatasetRecordEditor";
import { LogprobPopover, TokenLogprobs, TokensViewer } from "./MessageViewer";

function toggleAnchor(
  anchors: DatasetRecord["anchors"] | undefined,
  anchor: { token_index: number; token_id: number },
  value: boolean
) {
  anchors ??= [];
  if (value)
    return [
      ...anchors.filter((anc) => anc.token_index < anchor.token_index),
      anchor,
      ...anchors.filter((anc) => anc.token_index > anchor.token_index),
    ];
  else {
    const newAnchors = anchors.filter(
      (anc) => anc.token_index !== anchor.token_index
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
  const marks = [{ value: 1, label: "1" }];

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

function CompletionTokensRenderer({
  anchors,
  setActions,
  lazyTokens,
  lazyLogprobs,
  onAnchorsChanged,
  onChange,
  onContinueGeneration,
  onMoreLogprobs,
}: {
  anchors?: DatasetRecord["anchors"];
  setActions: (actions: { render: () => React.ReactNode }) => void;
  lazyTokens: () => Promise<Array<string>>;
  lazyLogprobs?: () => Promise<Array<TokenLogprobs>>;
  onAnchorsChanged?: React.Dispatch<
    React.SetStateAction<DatasetRecord["anchors"]>
  >;
  onChange?: (newValue: DatasetRecord["completion"][number]) => void;
  onContinueGeneration?: (token: {
    tokenIndex: number;
    tokenId: number;
  }) => Promise<{ text: string; prefix: string }>;
  onMoreLogprobs?: (tokenIndex: number) => Promise<TokenLogprobs>;
}) {
  const [tokens, setTokens] = useState<Array<string> | null>(null);
  const [logprobs, setLogprobs] = useState<Array<TokenLogprobs> | undefined>(
    undefined
  );
  const [draft, setDraft] = useState<
    { text: string; prefix: string } | undefined
  >(undefined);
  const [error, setError] = useState("");

  const { t } = useTranslation("fineTuning");

  const hasDraft = draft !== undefined;

  const handleApplyDraft = useEffectEvent(() => {
    if (!draft) return;
    onChange?.(parseCompletion(draft.prefix + draft.text));
    setDraft(undefined);
  });

  const actions = useMemo(
    () => ({
      render: () =>
        hasDraft && (
          <>
            <IconButton
              size="small"
              aria-label={t("Apply draft")}
              onClick={handleApplyDraft}
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
        ),
    }),
    [hasDraft, t]
  );

  useEffect(() => {
    setActions(actions);
    return () => setActions({ render: () => null });
  }, [actions, setActions]);

  useEffect(() => {
    lazyTokens()
      .then(setTokens)
      .catch((error) => setError(error.toString()));
  }, [lazyTokens]);

  useEffect(() => {
    if (!lazyLogprobs) return;
    setLogprobs(undefined);
    lazyLogprobs()
      .then(setLogprobs)
      .catch((error) => setError(error.toString()));
  }, [lazyLogprobs]);

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

    const anchorEditor = (
      <AnchorEditor
        anchored={(anchors ?? []).some((p) => p.token_index === selected)}
        onChange={(value) =>
          onAnchorsChanged?.((anchors) =>
            toggleAnchor(
              anchors,
              {
                token_index: selected,
                token_id: logprobs[selected].token_id,
              },
              value
            )
          )
        }
        confidence={
          anchors?.find((p) => p.token_index === selected)?.confidence
        }
        onConfidenceChange={(newConfidence) =>
          onAnchorsChanged?.((anchors) =>
            anchors?.map((anc) =>
              anc.token_index === selected
                ? { ...anc, confidence: newConfidence ?? undefined }
                : anc
            )
          )
        }
        marks={confidenceMarks}
      />
    );

    return (
      <LogprobPopover
        logprob={logprobs[selected]}
        onClose={onClose}
        anchorEditor={anchorEditor}
        onContinueGeneration={async (tokenId: number) => {
          try {
            const draft = await onContinueGeneration?.({
              tokenIndex: selected,
              tokenId: tokenId,
            });
            if (draft) setDraft(draft);
          } catch (error: any) {
            setError(error.toString());
          }
        }}
        onMoreLogprobs={async () => {
          if (!onMoreLogprobs) return;
          try {
            const logprob = await onMoreLogprobs(selected);
            setLogprobs((prevLogprobs) => {
              return prevLogprobs?.map((lp, index) =>
                index === selected ? logprob : lp
              );
            });
          } catch (error: any) {
            setError(error.toString());
          }
        }}
      />
    );
  };

  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError("")} children={error} />
      )}

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
      )}
    </>
  );
}

export default CompletionTokensRenderer;
