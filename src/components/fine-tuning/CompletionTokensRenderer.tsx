import { Alert, alpha } from "@mui/material";
import React, { useEffect, useState } from "react";

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
  onDraft,
  lazyTokens,
  lazyLogprobs,
  onAnchorsChanged,
  onContinueGeneration,
  onMoreLogprobs,
}: {
  anchors?: DatasetRecord["anchors"];
  onDraft?: (draft: { text: string; prefix: string }) => void;
  lazyTokens: () => Promise<Array<string>>;
  lazyLogprobs?: () => Promise<Array<TokenLogprobs>>;
  onAnchorsChanged?: React.Dispatch<
    React.SetStateAction<DatasetRecord["anchors"]>
  >;
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
  const [error, setError] = useState("");

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

    return (
      <LogprobPopover
        logprob={logprobs[selected]}
        onClose={onClose}
        slotProps={{
          anchorEditor: {
            anchored: (anchors ?? []).some((p) => p.token_index === selected),
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
            confidence: anchors?.find((p) => p.token_index === selected)
              ?.confidence,
            onConfidenceChange: (newConfidence) =>
              onAnchorsChanged?.((anchors) =>
                anchors?.map((anc) =>
                  anc.token_index === selected
                    ? { ...anc, confidence: newConfidence ?? undefined }
                    : anc
                )
              ),
            marks: confidenceMarks,
          },
        }}
        onContinueGeneration={async (tokenId: number) => {
          try {
            const draft = await onContinueGeneration?.({
              tokenIndex: selected,
              tokenId: tokenId,
            });
            if (draft) onDraft?.(draft);
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

      {tokens && (
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
      )}
    </>
  );
}

export default CompletionTokensRenderer;
