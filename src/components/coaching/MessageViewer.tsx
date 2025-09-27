import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PushPinIcon from "@mui/icons-material/PushPin";
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
import React, { useCallback, useEffect, useState } from "react";

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
      children: ({
        selected,
        onClose,
      }: {
        selected: number;
        onClose: () => void;
      }) => React.ReactNode;
    };
  };
}) {
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const TypographySlot: React.ComponentType<TypographyProps> =
    slots?.typography ?? SpanTypography;

  const handleClose = useCallback(() => setAnchorEl(null), []);

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
          onClose={handleClose}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          {slotProps.popover.children({ selected, onClose: handleClose })}
        </Popover>
      )}
    </>
  );
}

type AnchorEditorProps = {
  anchored: boolean;
  onChange: (value: boolean) => void;
  confidence?: number;
  onConfidenceChange?: (value: number) => void;
  marks?: Array<{ value: number; label: string }>;
};

function AnchorEditor({
  anchored,
  onChange,
  confidence,
  onConfidenceChange,
  marks,
}: AnchorEditorProps) {
  const [uncontrolledConfidence, setUncontrolledConfidence] = useState(
    confidence ?? 1.0
  );

  useEffect(() => {
    setUncontrolledConfidence(confidence ?? 1.0);
  }, [confidence]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ paddingBottom: marks?.length ? 2.5 : 0 }}
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
        value={uncontrolledConfidence}
        min={0}
        max={1}
        step={0.01}
        marks={marks}
        onChangeCommitted={(_, value) => onConfidenceChange?.(value)}
        onChange={(_, value) => setUncontrolledConfidence(value)}
        aria-label="Confidence"
        sx={{ flexGrow: 1 }}
      />
      <Typography
        variant="body2"
        sx={{ flexShrink: 0, width: "32px", textAlign: "right" }}
      >
        {anchored ? uncontrolledConfidence.toFixed(2) : "-"}
      </Typography>
    </Stack>
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

export function LogprobPopover({
  logprob,
  slotProps,
  onClose,
  onContinueGeneration,
}: {
  logprob: TokenLogprobs;
  slotProps?: { anchorEditor?: AnchorEditorProps };
  onClose?: () => void;
  onContinueGeneration?: (tokenId: number) => void;
}) {
  return (
    <Box sx={{ padding: 2 }}>
      {slotProps?.anchorEditor && <AnchorEditor {...slotProps?.anchorEditor} />}

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
            {logprob.top_logprobs.map((topLogprob, index) => (
              <TableRow
                key={topLogprob.token_id}
                sx={{
                  backgroundColor:
                    index % 2 === 0 ? "action.hover" : "background.paper",
                  "&>.MuiTableCell-root": {
                    color:
                      topLogprob.token === logprob.token
                        ? "primary.main"
                        : undefined,
                  },
                }}
              >
                <TableCell sx={{ minWidth: "120px" }}>
                  <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
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
                        onContinueGeneration?.(topLogprob.token_id);
                        onClose?.();
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
  );
}
