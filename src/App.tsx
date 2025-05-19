import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
} from "@mui/material";

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
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          "html, body, #root": { height: "100%" },
          body: { overflow: "hidden" },
        }}
      ></GlobalStyles>
      <Chat />
    </ThemeProvider>
  );
}

export default App;
