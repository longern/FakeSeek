import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PushPinIcon from "@mui/icons-material/PushPin";
import {
  Box,
  Card,
  Collapse,
  Divider,
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function SpanTypography(props: TypographyProps) {
  return <Typography component="span" {...props} />;
}

function intersperse(
  segments: Array<React.ReactNode>,
  replacements: Array<[string, React.ReactNode]>
) {
  for (const [from, to] of replacements)
    segments = segments.flatMap((segment) =>
      typeof segment !== "string"
        ? [segment]
        : segment
            .split(from)
            .flatMap((part, index) => (index === 0 ? [part] : [to, part]))
    );
  return segments;
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

  const interspersed = useMemo(() => {
    return tokens.map((token) =>
      intersperse(
        [token],
        [
          ["\n", <code className="newline">{"\u21B5\n"}</code>],
          [" ", <code className="space">{"\u00B7"}</code>],
          ["\t", <code className="tab">{"\u2192"}</code>],
        ]
      )
    );
  }, [tokens]);

  const handleClose = useCallback(() => setAnchorEl(null), []);

  return (
    <>
      <Box
        sx={{
          whiteSpace: "pre-wrap",
          "& .newline, & .space, & .tab": { opacity: 0.3 },
          "& .tab": {
            width: "1em",
            display: "inline-block",
            textAlign: "center",
          },
        }}
      >
        {interspersed.map((nodes, i) => (
          <TypographySlot
            key={i}
            onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
              setSelected(i);
              setAnchorEl(event.currentTarget);
            }}
            children={nodes}
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

  const { t } = useTranslation();

  useEffect(() => {
    setUncontrolledConfidence(confidence ?? 1.0);
  }, [confidence]);

  return (
    <Card variant="outlined">
      <Box sx={{ paddingX: 2, paddingY: 1.5 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography id="anchor-button">{t("Anchor")}</Typography>
          <IconButton
            aria-labelledby="anchor-button"
            size="small"
            {...(anchored
              ? { color: "primary", onClick: () => onChange?.(false) }
              : { onClick: () => onChange?.(true) })}
          >
            <PushPinIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <Collapse in={anchored}>
        <Divider />
        <Box sx={{ paddingX: 2, paddingY: 1.5 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography id="confidence-slider">{t("Confidence")}</Typography>
            <Typography
              variant="body2"
              sx={{ flexShrink: 0, width: "32px", textAlign: "right" }}
            >
              {uncontrolledConfidence.toFixed(2)}
            </Typography>
          </Stack>
          <Slider
            value={uncontrolledConfidence}
            min={0}
            max={1}
            step={0.01}
            marks={marks}
            onChangeCommitted={(_, value) => onConfidenceChange?.(value)}
            onChange={(_, value) => setUncontrolledConfidence(value)}
            aria-labelledby="confidence-slider"
            sx={{ flexGrow: 1 }}
          />
        </Box>
      </Collapse>
    </Card>
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
    <Stack spacing={2} sx={{ padding: 2 }}>
      {slotProps?.anchorEditor && <AnchorEditor {...slotProps?.anchorEditor} />}

      <Card variant="outlined">
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
                    {intersperse(
                      [topLogprob.token],
                      [
                        ["\n", <code className="newline">{"\u21B5"}</code>],
                        [" ", <code className="space">{"\u00B7"}</code>],
                        ["\t", <code className="tab">{"\u2192"}</code>],
                      ]
                    )}
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
    </Stack>
  );
}
