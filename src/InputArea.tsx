import {
  ArrowUpward as ArrowUpwardIcon,
  Search as SearchIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { Box, Chip, IconButton, InputBase, Stack } from "@mui/material";
import { useCallback, useState } from "react";

function InputArea({
  stopController,
  onSearch,
  onChat,
}: {
  stopController?: AbortController;
  onSearch: (query: string) => void;
  onChat: (message: string) => void;
}) {
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableResearch, setEnableResearch] = useState(false);
  const [message, setMessage] = useState("");

  const handleSend = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage("");
      if (enableSearch) {
        onSearch(message);
      } else if (enableResearch) {
        console.log("Researching...");
      } else {
        onChat(message);
      }
    },
    [enableSearch, enableResearch, message]
  );

  return (
    <Stack
      gap={1}
      component="form"
      onSubmit={handleSend}
      sx={{ width: "100%", padding: 1 }}
    >
      <InputBase
        multiline
        placeholder="Send message..."
        value={message}
        sx={{
          minHeight: "48px",
          borderRadius: "24px",
          backgroundColor: "whitesmoke",
          padding: "0.5rem 1rem",
        }}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form!.requestSubmit();
          }
        }}
      />
      <Stack direction="row" gap={1} alignItems="center">
        <Chip
          label="Research"
          color={enableResearch ? "primary" : "default"}
          onClick={() => {
            setEnableResearch(!enableResearch);
            setEnableSearch(false);
          }}
        />
        <Chip
          label="Search"
          color={enableSearch ? "primary" : "default"}
          icon={<SearchIcon />}
          onClick={() => {
            setEnableSearch(!enableSearch);
            setEnableResearch(false);
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        {stopController ? (
          <IconButton
            aria-label="Stop"
            size="small"
            sx={{
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
            }}
            onClick={() => stopController.abort("User manually stopped")}
          >
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            type="submit"
            aria-label="send"
            size="small"
            color="primary"
            disabled={!message}
            sx={{
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
              "&:disabled": {
                backgroundColor: "action.disabled",
                color: "primary.contrastText",
              },
            }}
          >
            <ArrowUpwardIcon />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
}

export default InputArea;
