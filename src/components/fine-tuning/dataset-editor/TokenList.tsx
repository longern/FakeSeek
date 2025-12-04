import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TypographyProps,
} from "@mui/material";
import React, { useMemo } from "react";

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

export function TokenListItem({
  token,
  ...props
}: {
  token: string;
} & TypographyProps) {
  const interspersed = useMemo(() => {
    return intersperse(
      [token],
      [
        ["\n", <code className="TokenListItem-newline">{"\n"}</code>],
        [" ", <code className="TokenListItem-space">&nbsp;</code>],
        ["\t", <code className="TokenListItem-tab">{"\t"}</code>],
      ]
    );
  }, [token]);

  return (
    <Typography component="span" className="TokenListItem-root" {...props}>
      {interspersed.map((part, i) => (
        <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </Typography>
  );
}

export function TokenList({ children }: { children?: React.ReactNode }) {
  return (
    <Box
      sx={{
        whiteSpace: "pre-wrap",
        "& .TokenListItem-newline, & .TokenListItem-space, & .TokenListItem-tab":
          { position: "relative" },
        "& .TokenListItem-newline:after": {
          content: '"↵"',
          position: "absolute",
          left: 0,
          top: "-0.2em",
          opacity: 0.15,
        },
        "& .TokenListItem-space:after": {
          content: '"·"',
          position: "absolute",
          left: 0,
          top: "-0.1em",
          opacity: 0.15,
        },
        "& .TokenListItem-tab:after": {
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
      {children}
    </Box>
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

export function LogprobTable({
  logprob,
  onContinueGeneration,
  onMoreLogprobs,
}: {
  logprob: TokenLogprobs;
  onContinueGeneration?: (tokenId: number) => void;
  onMoreLogprobs?: () => void;
}) {
  const [loadingMore, setLoadingMore] = React.useState(false);

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ maxHeight: "400px" }}
    >
      <Table size="small" stickyHeader>
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
                  ).map((part, i) => (
                    <React.Fragment key={i}>{part}</React.Fragment>
                  ))}
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
                    }}
                  >
                    <PlayArrowIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}

          {onMoreLogprobs && (
            <TableRow>
              <TableCell colSpan={3} align="center">
                <IconButton
                  aria-label={"More"}
                  size="small"
                  onClick={() => {
                    onMoreLogprobs();
                    setLoadingMore(true);
                  }}
                  loading={loadingMore}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
