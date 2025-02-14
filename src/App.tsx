import { useRef, useState } from "react";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

import SearchResults from "./SearchResults";
import Home from "./Home";
import Chat from "./Chat";
import InputArea from "./InputArea";

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});

function App() {
  const [query, setQuery] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [stopController, setStopController] = useState<
    AbortController | undefined
  >(undefined);
  const chatRef = useRef<{
    sendMessage: (message: string) => void;
    createResearch: (task: string) => void;
  } | null>(null);

  const inputArea = (
    <InputArea
      stopController={stopController}
      onSearch={setQuery}
      onChat={(message) => {
        setShowChat(true);
        setTimeout(() => {
          chatRef.current!.sendMessage(message);
        }, 0);
      }}
      onResearch={(task) => {
        setShowChat(true);
        setTimeout(() => {
          chatRef.current!.createResearch(task);
        }, 0);
      }}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {query ? (
        <SearchResults query={query} onBack={() => setQuery("")} />
      ) : showChat ? (
        <Chat
          ref={chatRef}
          onBack={() => setShowChat(false)}
          onControllerChange={(controller) => setStopController(controller)}
          inputArea={inputArea}
        />
      ) : (
        <Home inputArea={inputArea} />
      )}
    </ThemeProvider>
  );
}

export default App;
