import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RampLeftIcon from "@mui/icons-material/RampLeft";
import {
  Box,
  Card,
  IconButton,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";

export function LogprobsViewer({
  logprobs,
  decoder,
  convertToAlpha,
  onContinueGeneration,
}: {
  logprobs?: Array<TokenLogprobs>;
  decoder: (token: string) => string;
  convertToAlpha?: (x: number) => number;
  onContinueGeneration?: (tokenIndex: number, tokenId: number) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<number | undefined>(undefined);

  convertToAlpha = convertToAlpha ?? ((x) => (1 - x) * 0.4);

  const selectedLogprob =
    selected === undefined ? undefined : logprobs?.[selected];

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
        <Box sx={{ padding: 2 }}>
          {selectedLogprob === undefined ? null : (
            <>
              <Card>
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
                            index % 2 === 0
                              ? "action.hover"
                              : "background.paper",
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
                          <code>{Math.exp(topLogprob.logprob).toFixed(4)}</code>
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
            </>
          )}
        </Box>
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
                        <code>{Math.exp(logprob.logprob).toFixed(4)}</code>
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
