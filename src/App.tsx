import { useState } from "react";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

import SearchResults from "./SearchResults";
import Home from "./Home";
import Chat from "./Chat";
import InputArea from "./InputArea";

const theme = createTheme();

function App() {
  const [query, setQuery] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");

  const inputArea = (
    <InputArea onSearch={setQuery} onChat={setDefaultMessage} />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {query ? (
        <SearchResults query={query} onBack={() => setQuery("")} />
      ) : defaultMessage ? (
        <Chat
          defaultMessage={defaultMessage}
          onBack={() => setDefaultMessage("")}
          inputArea={inputArea}
        />
      ) : (
        <Home inputArea={inputArea} />
      )}
    </ThemeProvider>
  );
}

export default App;
