import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Box,
  Card,
  Divider,
  IconButton,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TypographyProps,
} from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";

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
          ["\n", <code className="newline">{"\n"}</code>],
          [" ", <code className="space">&nbsp;</code>],
          ["\t", <code className="tab">{"\t"}</code>],
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
          "& .newline, & .space, & .tab": { position: "relative" },
          "& .newline:after": {
            content: '"↵"',
            position: "absolute",
            left: 0,
            top: "-0.2em",
            opacity: 0.15,
          },
          "& .space:after": {
            content: '"·"',
            position: "absolute",
            left: 0,
            top: "-0.1em",
            opacity: 0.15,
          },
          "& .tab:after": {
            content: '"→"',
            position: "absolute",
            left: 0,
            top: "-0.1em",
            width: "100%",
            opacity: 0.15,
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
  anchorEditor,
  onClose,
  onContinueGeneration,
  onMoreLogprobs,
}: {
  logprob: TokenLogprobs;
  anchorEditor?: React.ReactNode;
  onClose?: () => void;
  onContinueGeneration?: (tokenId: number) => void;
  onMoreLogprobs?: () => void;
}) {
  return (
    <Stack
      sx={{ minWidth: { xs: "320px", sm: "400px" } }}
      divider={<Divider />}
    >
      {anchorEditor}

      <Box sx={{ padding: 2 }}>
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
                    <TableCell sx={{ width: 0 }}>
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
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <IconButton
                    aria-label={"More"}
                    size="small"
                    onClick={onMoreLogprobs}
                  >
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Stack>
  );
}
