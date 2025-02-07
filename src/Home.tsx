import { useCallback, useState } from "react";
import {
  Box,
  Chip,
  Container,
  GlobalStyles,
  IconButton,
  InputBase,
  Stack,
} from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

function Home({
  onSearch,
  onChat,
}: {
  onSearch: (query: string) => void;
  onChat: (message: string) => void;
}) {
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableResearch, setEnableResearch] = useState(false);
  const [message, setMessage] = useState("");

  const handleSend = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
    <Container
      maxWidth="md"
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      <GlobalStyles
        styles={{
          "html, body, #root": {
            height: "100%",
          },
        }}
      ></GlobalStyles>
      <Stack gap={1} width="100%" component="form" onSubmit={handleSend}>
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
            label="Search"
            color={enableSearch ? "primary" : "default"}
            onClick={() => {
              setEnableSearch(!enableSearch);
              setEnableResearch(false);
            }}
          />
          <Chip
            label="Research"
            color={enableResearch ? "primary" : "default"}
            onClick={() => {
              setEnableResearch(!enableResearch);
              setEnableSearch(false);
            }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            type="submit"
            aria-label="send"
            size="small"
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Container>
  );
}

export default Home;
