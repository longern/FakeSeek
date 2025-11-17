import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  alpha,
  Box,
  CircularProgress,
  IconButton,
  Popover,
  SwipeableDrawer,
  Typography,
  useMediaQuery,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DatasetRecord } from "./DatasetRecordEditor";
import { TokenList, TokenListItem } from "./TokenList";
import TokensViewerPopoverContent from "./TokensViewerPopoverContent";
import { toggleAnchor, useRecordSetters, useTokensProps } from "./tokens-hooks";

function DraftViewer({ draft }: { draft: { text: string; prefix: string } }) {
  return (
    <>
      <Typography component="span" whiteSpace="pre-wrap">
        {draft.prefix}
      </Typography>
      <Typography
        component="span"
        whiteSpace="pre-wrap"
        sx={{
          backgroundColor: (theme) => alpha(theme.palette.success.main, 0.12),
          color: "text.secondary",
        }}
      >
        {draft.text}
      </Typography>
    </>
  );
}

function TokensViewerPopover({
  children,
  open,
  onClose,
  anchorEl,
  onTransitionEnd,
}: {
  open: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children?: React.ReactNode;
  onTransitionEnd?: () => void;
}) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  return isMobile ? (
    <SwipeableDrawer
      container={document.getElementById("dataset-editor-dialog")}
      open={open}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      onOpen={() => {}}
      disableSwipeToOpen
      anchor="bottom"
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
          },
        },
      }}
    >
      <Box sx={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <Box
          sx={{
            width: "40px",
            height: "4px",
            backgroundColor: "divider",
            mx: "auto",
            marginTop: 1,
            borderRadius: "2px",
          }}
        />
      </Box>
      {children}
    </SwipeableDrawer>
  ) : (
    <Popover
      open={open}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    >
      {children}
    </Popover>
  );
}

function TokensViewer({
  record,
  model,
  onChange,
  setActions,
}: {
  record: DatasetRecord;
  model: string;
  onChange?: (record: (prev: DatasetRecord) => DatasetRecord) => void;
  setActions: React.Dispatch<
    React.SetStateAction<{
      render: () => React.ReactNode;
    }>
  >;
}) {
  const [error, setError] = useState<Error | undefined>(undefined);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(
    null
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { setCompletion, setAnchors } = useRecordSetters(onChange);
  const {
    tokens,
    tokenIds,
    logprobs,
    draft,
    applyDraft,
    clearDraft,
    changeToken,
    loadMoreLogprobs,
    continueGeneration,
  } = useTokensProps(model, record, setError);

  const { t } = useTranslation("fineTuning");

  const hasDraft = Boolean(draft);

  const convertLogprobToAlpha = (x: number) => (1 - Math.exp(x)) * 0.4;

  const actions = useMemo(
    () => ({
      render: () =>
        hasDraft && (
          <>
            <IconButton
              size="small"
              aria-label={t("Apply draft")}
              onClick={() => applyDraft(setCompletion, setAnchors)}
              color="success"
            >
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={t("Discard draft")}
              onClick={clearDraft}
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

  return (
    <>
      {error && (
        <Alert
          severity="error"
          children={error.message}
          onClose={() => setError(undefined)}
          sx={{ marginBottom: 1 }}
        />
      )}

      {draft ? (
        <DraftViewer draft={draft} />
      ) : tokens === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", paddingY: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TokenList>
          {tokens.map((token, index) => (
            <TokenListItem
              key={index}
              token={token}
              sx={{
                color: record.anchors?.some((p) => p.token_index === index)
                  ? "primary.main"
                  : undefined,
                backgroundColor: (theme) =>
                  logprobs &&
                  alpha(
                    theme.palette.secondary.main,
                    convertLogprobToAlpha(logprobs[index]?.logprob)
                  ),
              }}
              onClick={(event) => {
                setSelectedTokenIndex(index);
                setAnchorEl(event.currentTarget);
              }}
            />
          ))}
        </TokenList>
      )}

      <TokensViewerPopover
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        onTransitionEnd={() => !anchorEl && setSelectedTokenIndex(null)}
      >
        {selectedTokenIndex !== null && (
          <TokensViewerPopoverContent
            key={selectedTokenIndex}
            index={selectedTokenIndex}
            tokens={tokens!}
            anchor={record.anchors?.find(
              (p) => p.token_index === selectedTokenIndex
            )}
            logprob={logprobs?.[selectedTokenIndex]}
            onToggleAnchor={(value) => {
              setAnchors((prev) =>
                toggleAnchor(
                  prev,
                  {
                    token_index: selectedTokenIndex,
                    token_id: tokenIds![selectedTokenIndex],
                  },
                  value
                )
              );
            }}
            onConfidenceChange={(value) => {
              setAnchors((prev) =>
                prev?.map((anc) =>
                  anc.token_index === selectedTokenIndex
                    ? { ...anc, confidence: value }
                    : anc
                )
              );
            }}
            onPreviousToken={
              selectedTokenIndex === 0
                ? undefined
                : () => setSelectedTokenIndex((prev) => prev! - 1)
            }
            onNextToken={
              selectedTokenIndex === tokens!.length - 1
                ? undefined
                : () => setSelectedTokenIndex((prev) => prev! + 1)
            }
            onChangeToken={(token) => {
              changeToken(selectedTokenIndex, token);
              setAnchorEl(null);
            }}
            onContinueGeneration={(tokenId) => {
              continueGeneration(selectedTokenIndex, tokenId);
              setAnchorEl(null);
            }}
            onMoreLogprobs={() => loadMoreLogprobs(selectedTokenIndex)}
          />
        )}
      </TokensViewerPopover>
    </>
  );
}

export default TokensViewer;
