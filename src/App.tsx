import { useState } from "react";
import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
} from "@mui/material";

import SearchResults from "./SearchResults";
import Chat from "./Chat";

const theme = createTheme({
  palette: {
    background: {
      default: "#f5f5f5",
      paper: "#fff",
    },
  },
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          "html, body, #root": { height: "100%" },
          body: { overflow: "hidden" },
        }}
      ></GlobalStyles>
      {query ? (
        <SearchResults query={query} onBack={() => setQuery("")} />
      ) : (
        <Chat onSearch={(query) => setQuery(query)} />
      )}
    </ThemeProvider>
  );
}

export default App;
