import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  alpha,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  Popover,
  Stack,
  SwipeableDrawer,
  SxProps,
  Typography,
  useMediaQuery,
} from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
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

function TokenEditor({
  token,
  onChange,
  previousToken,
  nextToken,
  sx,
}: {
  token: string;
  onChange: (newToken: string) => void;
  previousToken?: string;
  nextToken?: string;
  sx?: SxProps;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    setEditing(false);
  }, [token]);

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      {editing ? (
        <InputBase
          name="token-editor-input"
          placeholder={token}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <Box>
          <Box component="span" sx={{ opacity: 0.2 }}>
            {previousToken}
          </Box>
          <Box component="span">{token}</Box>
          <Box component="span" sx={{ opacity: 0.2 }}>
            {nextToken}
          </Box>
        </Box>
      )}
      <IconButton
        size="small"
        aria-label={editing ? t("Save token") : t("Edit token")}
        onClick={() => {
          if (editing) value && onChange(value);
          else setValue("");
          setEditing(!editing);
        }}
      >
        {editing ? (
          <SaveIcon fontSize="small" />
        ) : (
          <EditIcon fontSize="small" />
        )}
      </IconButton>
    </Stack>
  );
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
  const [continueToken, setContinueToken] = useState<{
    tokenIndex: number;
    tokenId: number;
  } | null>(null);
  const [error, setError] = useState("");
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation("fineTuning");

  const hasDraft = draft !== undefined;

  const handleApplyDraft = useEffectEvent(() => {
    if (!draft) return;

    // Auto-anchor if new token is not the top predicted token
    if (continueToken !== null && onAnchorsChanged) {
      onAnchorsChanged((anchors) => {
        const logprob = logprobs?.[continueToken.tokenIndex];
        const topTokenId = logprob?.top_logprobs?.[0].token_id;
        return toggleAnchor(
          anchors?.filter((p) => p.token_index < continueToken.tokenIndex),
          {
            token_index: continueToken.tokenIndex,
            token_id: continueToken.tokenId,
          },
          topTokenId !== continueToken.tokenId
        );
      });
    }

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
              onClick={() => {
                setDraft(undefined);
                setContinueToken(null);
              }}
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

  const handleContinueGeneration = useCallback(
    async (tokenId: number) => {
      if (selectedToken === null) return;
      setAnchorEl(null);
      const continueToken = {
        tokenIndex: selectedToken.index,
        tokenId,
      };
      setContinueToken(continueToken);
      try {
        const draft = await onContinueGeneration?.(continueToken);
        if (draft) setDraft(draft);
      } catch (error: any) {
        setError(error.toString());
      }
    },
    [onContinueGeneration, selectedToken]
  );

  const handleMoreLogprobs = useCallback(async () => {
    if (!onMoreLogprobs || !selectedToken) return;
    try {
      const logprob = await onMoreLogprobs(selectedToken.index);
      setLogprobs((prevLogprobs) => {
        return prevLogprobs?.map((lp, index) =>
          index !== selectedToken.index
            ? lp
            : { ...lp, top_logprobs: logprob.top_logprobs }
        );
      });
    } catch (error: any) {
      setError(error.toString());
    }
  }, [onMoreLogprobs, selectedToken]);

  const handleChangeToken = useCallback(async () => {}, []);

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

  const popoverChildren = selectedToken && (
    <Stack
      key={selectedToken.index}
      sx={{ minWidth: { xs: "320px", sm: "400px" } }}
      divider={<Divider />}
    >
      <Stack sx={{ padding: 1 }} direction="row" alignItems="center">
        <IconButton
          aria-label={t("Previous token")}
          disabled={selectedToken.index === 0}
          onClick={() => {
            setSelectedTokenIndex((index) =>
              index !== null && index > 0 ? index - 1 : index
            );
          }}
        >
          <NavigateBeforeIcon fontSize="small" />
        </IconButton>
        <TokenEditor
          token={selectedToken.token}
          previousToken={
            selectedToken.index > 0
              ? tokens!.tokens![selectedToken.index - 1]
              : undefined
          }
          nextToken={
            selectedToken.index < tokens!.tokens.length - 1
              ? tokens!.tokens![selectedToken.index + 1]
              : undefined
          }
          onChange={handleChangeToken}
          sx={{ flexGrow: 1, justifyContent: "center" }}
        />
        <IconButton
          aria-label={t("Next token")}
          disabled={
            tokens === null || selectedToken.index === tokens.tokens.length - 1
          }
          onClick={() => {
            setSelectedTokenIndex((index) =>
              index !== null &&
              tokens !== null &&
              index < tokens.tokens.length - 1
                ? index + 1
                : index
            );
          }}
        >
          <NavigateNextIcon fontSize="small" />
        </IconButton>
      </Stack>

      <AnchorEditor
        anchored={selectedToken.anchored}
        onChange={(value) => {
          const anchor = {
            token_index: selectedToken.index,
            token_id: selectedToken.tokenId,
          };
          onAnchorsChanged?.((anchors) => toggleAnchor(anchors, anchor, value));
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
          selectedToken?.logprob && makeConfidenceMarks(selectedToken.logprob)
        }
      />

      {selectedToken.logprob && (
        <Box sx={{ padding: 1.5 }}>
          <LogprobTable
            logprob={selectedToken.logprob}
            onContinueGeneration={handleContinueGeneration}
            onMoreLogprobs={
              !onMoreLogprobs || selectedToken.logprob.top_logprobs.length >= 20
                ? undefined
                : handleMoreLogprobs
            }
          />
        </Box>
      )}
    </Stack>
  );

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

          {isMobile ? (
            <SwipeableDrawer
              container={document.getElementById("dataset-editor-dialog")}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              onTransitionEnd={() => !anchorEl && setSelectedTokenIndex(null)}
              onOpen={() => {}}
              disableSwipeToOpen
              anchor="bottom"
            >
              {popoverChildren}
            </SwipeableDrawer>
          ) : (
            <Popover
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              onTransitionEnd={() => !anchorEl && setSelectedTokenIndex(null)}
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              {popoverChildren}
            </Popover>
          )}
        </>
      )}
    </>
  );
}

export default CompletionTokensRenderer;
