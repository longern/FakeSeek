import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  alpha,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseCompletion } from "../utils";
import AnchorEditor from "./AnchorEditor";
import type { DatasetRecord } from "./DatasetRecordEditor";
import {
  LogprobTable,
  TokenList,
  TokenListItem,
  TokenLogprobs,
} from "./MessageViewer";

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
  lazyTokens: () => Promise<{ tokens: Array<string>; tokenIds: Array<number> }>;
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
  const [tokens, setTokens] = useState<{
    tokens: Array<string>;
    tokenIds: Array<number>;
  } | null>(null);
  const [logprobs, setLogprobs] = useState<Array<TokenLogprobs> | undefined>(
    undefined
  );
  const [draft, setDraft] = useState<
    { text: string; prefix: string } | undefined
  >(undefined);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(
    null
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
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

  const selectedToken = useMemo(() => {
    if (selectedTokenIndex === null) return null;

    return {
      index: selectedTokenIndex,
      token: tokens!.tokens![selectedTokenIndex],
      tokenId: tokens!.tokenIds![selectedTokenIndex],
      logprob: logprobs?.[selectedTokenIndex],
      anchored: (anchors ?? []).some(
        (p) => p.token_index === selectedTokenIndex
      ),
      confidence: anchors?.find((p) => p.token_index === selectedTokenIndex)
        ?.confidence,
    };
  }, [selectedTokenIndex, logprobs, tokens, anchors]);

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
      ) : tokens === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", paddingY: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TokenList>
            {tokens.tokens.map((token, index) => (
              <TokenListItem
                key={index}
                token={token}
                sx={{
                  color: anchors?.some((p) => p.token_index === index)
                    ? "primary.main"
                    : undefined,
                  backgroundColor: (theme) =>
                    logprobs &&
                    alpha(
                      theme.palette.secondary.main,
                      convertLogprobToAlpha(logprobs[index].logprob)
                    ),
                }}
                onClick={(event) => {
                  setSelectedTokenIndex(index);
                  setAnchorEl(event.currentTarget);
                }}
              />
            ))}
          </TokenList>

          <Popover
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            {selectedToken && (
              <Stack
                sx={{ minWidth: { xs: "320px", sm: "400px" } }}
                divider={<Divider />}
              >
                <AnchorEditor
                  anchored={selectedToken.anchored}
                  onChange={(value) => {
                    const anchor = {
                      token_index: selectedToken.index,
                      token_id: selectedToken.tokenId,
                    };
                    onAnchorsChanged?.((anchors) =>
                      toggleAnchor(anchors, anchor, value)
                    );
                  }}
                  confidence={selectedToken.confidence}
                  onConfidenceChange={(newConfidence) =>
                    onAnchorsChanged?.((anchors) =>
                      anchors?.map((anc) =>
                        anc.token_index === selectedToken.index
                          ? { ...anc, confidence: newConfidence ?? undefined }
                          : anc
                      )
                    )
                  }
                  marks={
                    selectedToken?.logprob &&
                    makeConfidenceMarks(selectedToken.logprob)
                  }
                />

                {selectedToken.logprob && (
                  <Box sx={{ padding: 2 }}>
                    <LogprobTable
                      logprob={selectedToken.logprob}
                      onContinueGeneration={async () => {
                        setAnchorEl(null);
                        try {
                          const draft = await onContinueGeneration?.({
                            tokenIndex: selectedToken.index,
                            tokenId: selectedToken.tokenId,
                          });
                          if (draft) setDraft(draft);
                        } catch (error: any) {
                          setError(error.toString());
                        }
                      }}
                      onMoreLogprobs={async () => {
                        if (!onMoreLogprobs) return;
                        try {
                          const logprob = await onMoreLogprobs(
                            selectedToken.index
                          );
                          setLogprobs((prevLogprobs) => {
                            return prevLogprobs?.map((lp, index) =>
                              index === selectedToken.index ? logprob : lp
                            );
                          });
                        } catch (error: any) {
                          setError(error.toString());
                        }
                      }}
                    />
                  </Box>
                )}
              </Stack>
            )}
          </Popover>
        </>
      )}
    </>
  );
}

export default CompletionTokensRenderer;
