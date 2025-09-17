import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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

function KLViewer({
  klDiversity,
  decoder,
  convertToAlpha,
  onContinue,
}: {
  klDiversity?: Array<TokenKLDiversity>;
  decoder?: (token: string) => string;
  convertToAlpha?: (x: number) => number;
  onContinue?: (tokenId: number) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedKL, setSelectedKL] = useState<TokenKLDiversity | undefined>(
    undefined
  );

  decoder = decoder ?? ((x) => x);
  convertToAlpha = convertToAlpha ?? ((x) => Math.max(Math.tanh(x) * 0.4, 0));

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
            setSelectedKL(kl);
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
                    <code>{Math.exp(selectedKL.logprob).toFixed(3)}</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>LPR</TableCell>
                  <TableCell align="right">
                    <code>{selectedKL.lpr.toFixed(3)}</code>
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
                    {!onContinue ? null : <TableCell />}
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
                      {!onContinue ? null : (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => onContinue?.(logprob.token_id)}
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
        </Popover>
      )}
    </>
  );
}

export default KLViewer;
