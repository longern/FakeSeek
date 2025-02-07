import { useState } from "react";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

import SearchResults from "./SearchResults";
import Home from "./Home";
import Chat from "./Chat";

const theme = createTheme();

function App() {
  const [query, setQuery] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {query ? (
        <SearchResults query={query} onBack={() => setQuery("")} />
      ) : defaultMessage ? (
        <Chat
          defaultMessage={defaultMessage}
          onBack={() => setDefaultMessage("")}
        />
      ) : (
        <Home
          onSearch={(query) => setQuery(query)}
          onChat={setDefaultMessage}
        />
      )}
    </ThemeProvider>
  );
}

export default App;
