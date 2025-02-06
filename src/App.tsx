import { useState } from "react";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import SearchResults from "./SearchResults";
import Home from "./Home";

const theme = createTheme();

function App() {
  const [query, setQuery] = useState("");

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {query ? (
        <SearchResults query={query} />
      ) : (
        <Home onSearch={(query) => setQuery(query)} onChat={() => {}} />
      )}
    </ThemeProvider>
  );
}

export default App;
