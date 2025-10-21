import {
  createTheme,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
} from "@mui/material";

import Chat from "./Chat";

const theme = createTheme({
  palette: {
    background: { default: "#f5f5f5", paper: "#fff" },
    action: { hover: "rgba(0, 0, 0, 0.12)" },
  },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none" } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none" } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none" } } },
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitFontSmoothing: "auto" },
        code: {
          fontFamily:
            "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
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
