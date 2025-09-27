import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PushPinIcon from "@mui/icons-material/PushPin";
import RampLeftIcon from "@mui/icons-material/RampLeft";
import {
  Box,
  Card,
  IconButton,
  Popover,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TypographyProps,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useMemo, useState } from "react";

function SpanTypography(props: TypographyProps) {
  return <Typography component="span" {...props} />;
}

export function TokensViewer({
  tokens,
  slots,
  slotProps,
}: {
  tokens: Array<string>;
  slots?: { typography?: React.ComponentType<TypographyProps> };
  slotProps?: {
    typography?: ({ index }: { index: number }) => TypographyProps;
    popover?: {
      children: ({ selected }: { selected: number }) => React.ReactNode;
    };
  };
}) {
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const TypographySlot: React.ComponentType<TypographyProps> =
    slots?.typography ?? SpanTypography;

  return (
    <>
      <Box sx={{ whiteSpace: "pre-wrap" }}>
        {tokens.map((token, i) => (
          <TypographySlot
            key={i}
            onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
              setSelected(i);
              setAnchorEl(event.currentTarget);
            }}
            children={token}
            {...slotProps?.typography?.({ index: i })}
          />
        ))}
      </Box>

      {slotProps?.popover?.children && selected && (
        <Popover
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          {slotProps.popover.children({ selected })}
        </Popover>
      )}
    </>
  );
}

function AnchorEditor({
  anchored,
  onChange,
  confidence,
  onConfidenceChange,
  marks,
}: {
  anchored: boolean;
  onChange: (value: boolean) => void;
  confidence?: number;
  onConfidenceChange?: (value: number) => void;
  marks?: Array<{ value: number; label: string }>;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ paddingBottom: marks ? 2.5 : 0 }}
    >
      <IconButton
        size="small"
        {...(anchored
          ? { color: "primary", onClick: () => onChange?.(false) }
          : { onClick: () => onChange?.(true) })}
      >
        <PushPinIcon fontSize="small" />
      </IconButton>
      <Slider
        disabled={anchored === false}
        value={confidence ?? 1.0}
        min={0}
        max={1}
        step={0.01}
        marks={marks}
        onChange={(_, value) => {
          onConfidenceChange?.(value);
        }}
        aria-label="Confidence"
        sx={{ flexGrow: 1 }}
      />
      <Typography
        variant="body2"
        sx={{ flexShrink: 0, width: "32px", textAlign: "right" }}
      >
        {anchored ? (confidence ?? 1.0).toFixed(2) : "-"}
      </Typography>
    </Stack>
  );
}

export function LogprobsViewer({
  logprobs,
  pinned,
  decoder,
  convertToAlpha,
  onPin,
  onAnchorConfidenceChange,
  onContinueGeneration,
}: {
  logprobs?: Array<TokenLogprobs>;
  pinned?: Array<{ token_index: number; confidence?: number }>;
  decoder: (token: string) => string;
  convertToAlpha?: (x: number) => number;
  onPin?: (token: { index: number; id: number }, value: boolean) => void;
  onAnchorConfidenceChange?: (tokenIndex: number, confidence?: number) => void;
  onContinueGeneration?: (tokenIndex: number, tokenId: number) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<number | undefined>(undefined);

  convertToAlpha = convertToAlpha ?? ((x) => (1 - x) * 0.4);

  const selectedLogprob =
    selected === undefined ? undefined : logprobs?.[selected];

  const confidenceMarks = useMemo(() => {
    if (!selectedLogprob) return undefined;

    const selectedProb = Math.exp(selectedLogprob.logprob);
    const topLogprobs = [...selectedLogprob.top_logprobs].sort(
      (a, b) => a.rank - b.rank
    );

    const minConfidenceDelta = 0.2;

    let prevConfidence = undefined;
    const marks = [] as Array<{ value: number; label: string }>;

    for (const logp of topLogprobs) {
      if (logp.logprob < selectedLogprob.logprob) break;

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
  }, [selectedLogprob]);

  if (!logprobs) return null;

  return (
    <>
      {logprobs.map((logprob, i) => (
        <Box
          key={i}
          component="span"
          sx={{
            whiteSpace: "pre-wrap",
            backgroundColor: (theme) =>
              alpha(
                theme.palette.secondary.main,
                convertToAlpha(Math.exp(logprob.logprob))
              ),
            color: pinned?.some((p) => p.token_index === i)
              ? "primary.main"
              : undefined,
          }}
          onClick={(event) => {
            setSelected(i);
            setAnchorEl(event.currentTarget);
          }}
        >
          {decoder(logprob.token)}
        </Box>
      ))}

      <Popover
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {selectedLogprob === undefined ? null : (
          <Box sx={{ padding: 2 }}>
            <AnchorEditor
              anchored={Boolean(
                pinned?.some((p) => p.token_index === selected)
              )}
              onChange={(value) => {
                if (selected === undefined || !selectedLogprob) return;
                const anchor = {
                  index: selected,
                  id: selectedLogprob.token_id,
                };
                onPin?.(anchor, value);
              }}
              confidence={
                pinned?.find((p) => p.token_index === selected)?.confidence
              }
              onConfidenceChange={(value) => {
                if (selected === undefined || !selectedLogprob) return;
                onAnchorConfidenceChange?.(selected, value);
              }}
              marks={confidenceMarks}
            />
            <Card sx={{ marginTop: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Token</TableCell>
                    <TableCell align="right">Prob</TableCell>
                    {!onContinueGeneration ? null : <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedLogprob.top_logprobs.map((topLogprob, index) => (
                    <TableRow
                      key={topLogprob.token_id}
                      sx={{
                        backgroundColor:
                          index % 2 === 0 ? "action.hover" : "background.paper",
                        "&>.MuiTableCell-root": {
                          color:
                            topLogprob.token === selectedLogprob.token
                              ? "primary.main"
                              : undefined,
                        },
                      }}
                    >
                      <TableCell>
                        <Box
                          component="span"
                          sx={{ whiteSpace: "pre-wrap", marginRight: 2 }}
                        >
                          {topLogprob.token}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <code title={Math.exp(topLogprob.logprob).toString()}>
                          {Math.exp(topLogprob.logprob).toFixed(4)}
                        </code>
                      </TableCell>
                      {!onContinueGeneration ? null : (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              onContinueGeneration?.(
                                selected!,
                                topLogprob.token_id
                              );
                              setAnchorEl(null);
                            }}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Box>
        )}
      </Popover>
    </>
  );
}

export type TokenLogprobs = {
  token: string;
  token_id: number;
  logprob: number;
  top_logprobs: Array<{
    token: string;
    token_id: number;
    logprob: number;
    rank: number;
  }>;
};

export type TokenKLDiversity = {
  token: string;
  lpr: number;
  logprob: number;
  teacherTopLogprobs: TokenLogprobs["top_logprobs"];
};

export function KLViewer({
  klDiversity,
  decoder,
  convertToAlpha,
  onContinueGeneration,
}: {
  klDiversity?: Array<TokenKLDiversity>;
  decoder?: (token: string) => string;
  convertToAlpha?: (x: number) => number;
  onContinueGeneration?: (
    tokenIndex: number,
    tokenId: number,
    merge?: boolean
  ) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<number | undefined>(undefined);

  decoder = decoder ?? ((x) => x);
  convertToAlpha = convertToAlpha ?? ((x) => Math.max(Math.tanh(x) * 0.4, 0));

  const selectedKL =
    selected === undefined ? undefined : klDiversity?.[selected];

  if (!klDiversity) return null;

  return (
    <>
      {klDiversity.map((kl, i) => (
        <Box
          key={i}
          component="span"
          sx={{
            whiteSpace: "pre-wrap",
            backgroundColor: (theme) =>
              alpha(theme.palette.secondary.main, convertToAlpha(kl.lpr)),
          }}
          onClick={(event) => {
            setSelected(i);
            setAnchorEl(event.currentTarget);
          }}
        >
          {decoder(kl.token)}
        </Box>
      ))}

      {selectedKL && (
        <Popover
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box sx={{ paddingX: 2 }}>
            <Table size="small" sx={{ marginTop: 1 }}>
              <TableBody>
                <TableRow>
                  <TableCell>Token</TableCell>
                  <TableCell align="right">
                    {decoder(selectedKL.token)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Prob</TableCell>
                  <TableCell align="right">
                    <code>{Math.exp(selectedKL.logprob).toFixed(4)}</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>LPR</TableCell>
                  <TableCell align="right">
                    <code>{selectedKL.lpr.toFixed(4)}</code>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography
              variant="subtitle2"
              sx={{ marginTop: 2, marginBottom: 1 }}
            >
              Teacher top prob tokens
            </Typography>
            <Card sx={{ marginTop: 1, marginBottom: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Token</TableCell>
                    <TableCell align="right">Prob</TableCell>
                    {!onContinueGeneration ? null : <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedKL.teacherTopLogprobs.map((logprob, index) => (
                    <TableRow
                      key={logprob.token_id}
                      sx={{
                        backgroundColor:
                          index % 2 === 0 ? "action.hover" : "background.paper",
                      }}
                    >
                      <TableCell>
                        <Box
                          component="span"
                          sx={{ whiteSpace: "pre-wrap", marginRight: 2 }}
                        >
                          {decoder(logprob.token)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <code title={Math.exp(logprob.logprob).toString()}>
                          {Math.exp(logprob.logprob).toFixed(4)}
                        </code>
                      </TableCell>
                      {!onContinueGeneration ? null : (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              onContinueGeneration?.(
                                selected!,
                                logprob.token_id
                              );
                              setAnchorEl(null);
                            }}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              onContinueGeneration?.(
                                selected!,
                                logprob.token_id,
                                true
                              );
                              setAnchorEl(null);
                            }}
                            sx={{ marginLeft: 1 }}
                          >
                            <RampLeftIcon
                              sx={{ transform: "scaleY(-1)" }}
                              fontSize="small"
                            />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Box>
        </Popover>
      )}
    </>
  );
}
