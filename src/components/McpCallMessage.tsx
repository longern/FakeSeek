import CloseIcon from "@mui/icons-material/Close";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "./Markdown";

function formatMcpError(
  error:
    | string
    | { type: string; content: Array<{ type: string; text: string }> }
) {
  if (typeof error === "string") return error;
  return error.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function SearchGoogleContent({
  message,
}: {
  message: ResponseInputItem.McpCall;
}) {
  const [showResults, setShowResults] = useState(false);

  const { t } = useTranslation();

  const query = useMemo(() => {
    try {
      const args = JSON.parse(message.arguments);
      return (args.query as string) ?? null;
    } catch (e) {
      return null;
    }
  }, [message.arguments]);

  return (
    <Box key={message.id} sx={{ marginY: 1 }}>
      <Stack
        component="span"
        direction="row"
        gap={0.5}
        sx={{ alignItems: "center" }}
      >
        <SearchIcon sx={{ color: "text.secondary" }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          <Box component="span" sx={{ userSelect: "none" }}>
            {message.output
              ? t("Search completed")
              : message.error
              ? formatMcpError(message.error)
              : t("Searching...")}
            {query ? `: ` : null}
          </Box>
          {query}
        </Typography>
        {message.output && (
          <IconButton size="small" onClick={() => setShowResults(true)}>
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Dialog
        open={showResults}
        onClose={() => setShowResults(false)}
        maxWidth="md"
        fullWidth
      >
        <Toolbar>
          <SearchIcon />
          <Box sx={{ minWidth: 0, flexGrow: 1, marginLeft: 1 }}>
            <DialogTitle noWrap sx={{ padding: 0 }}>
              {query}
            </DialogTitle>
          </Box>
          <IconButton
            aria-label="Close"
            size="large"
            edge="end"
            onClick={() => setShowResults(false)}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
        <DialogContent
          dividers
          sx={{ paddingY: 0, "& ul": { listStyle: "none", padding: 0 } }}
        >
          {message.output ? <Markdown children={message.output} /> : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export function McpCallContent({
  message,
}: {
  message: ResponseInputItem.McpCall;
}) {
  switch (message.name) {
    case "search_google":
      return <SearchGoogleContent message={message} />;

    default:
      return (
        <Box key={message.id} sx={{ marginY: 1 }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", userSelect: "none" }}
          >
            {message.name}
          </Typography>
        </Box>
      );
  }
}
