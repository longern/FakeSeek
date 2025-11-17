import EditIcon from "@mui/icons-material/Edit";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Divider,
  IconButton,
  InputBase,
  Stack,
  SxProps,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import AnchorEditor from "./AnchorEditor";
import { LogprobTable, TokenLogprobs } from "./TokenList";

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
  onChange?: (newToken: string) => void;
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
      {onChange && (
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
      )}
    </Stack>
  );
}

function TokensViewerPopoverContent({
  index,
  anchor,
  tokens,
  onToggleAnchor,
  onConfidenceChange,
  logprob,
  onPreviousToken,
  onNextToken,
  onChangeToken,
  onContinueGeneration,
  onMoreLogprobs,
}: {
  index: number;
  anchor?: { token_id: number; confidence?: number };
  tokens: Array<string>;
  onToggleAnchor: (value: boolean) => void;
  onConfidenceChange: (value: number) => void;
  logprob?: TokenLogprobs;
  onPreviousToken?: () => void;
  onNextToken?: () => void;
  onChangeToken?: (token: string) => void;
  onContinueGeneration?: (tokenId: number) => void;
  onMoreLogprobs?: () => void;
}) {
  const { t } = useTranslation("fineTuning");

  return (
    <Stack
      sx={{ minWidth: { xs: "320px", sm: "400px" } }}
      divider={<Divider />}
    >
      <Stack sx={{ padding: 1 }} direction="row" alignItems="center">
        <IconButton
          aria-label={t("Previous token")}
          disabled={onPreviousToken === undefined}
          onClick={onPreviousToken}
        >
          <NavigateBeforeIcon fontSize="small" />
        </IconButton>
        <TokenEditor
          token={tokens[index]}
          previousToken={index > 0 ? tokens[index - 1] : undefined}
          nextToken={index < tokens.length - 1 ? tokens[index + 1] : undefined}
          onChange={onChangeToken}
          sx={{ flexGrow: 1, justifyContent: "center" }}
        />
        <IconButton
          aria-label={t("Next token")}
          disabled={onNextToken === undefined}
          onClick={onNextToken}
        >
          <NavigateNextIcon fontSize="small" />
        </IconButton>
      </Stack>

      <AnchorEditor
        anchored={anchor !== undefined}
        onChange={onToggleAnchor}
        confidence={anchor?.confidence}
        onConfidenceChange={onConfidenceChange}
        marks={logprob && makeConfidenceMarks(logprob)}
      />

      {logprob && (
        <Box sx={{ padding: 1.5 }}>
          <LogprobTable
            logprob={logprob}
            onContinueGeneration={onContinueGeneration}
            onMoreLogprobs={
              logprob.top_logprobs.length >= 20 ? undefined : onMoreLogprobs
            }
          />
        </Box>
      )}
    </Stack>
  );
}

export default TokensViewerPopoverContent;
