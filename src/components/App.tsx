import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

import Chat from "./Chat";
import { useCallback, useState } from "react";
import { PresetsDialogContext } from "./presets/contexts";
import PresetsDialog from "./presets/PresetsDialog";

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
        "html, body, #root": { height: "100%" },
        html: { WebkitFontSmoothing: "auto" },
        body: { overflow: "hidden", scrollbarColor: "#d4d4d4 transparent" },
        code: {
          fontFamily:
            "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: "12px" },
        list: ({ theme }) => ({
          minWidth: "160px",
          "&>.MuiMenuItem-root": {
            minHeight: "48px",
            [theme.breakpoints.up("sm")]: { minHeight: "40px" },
          },
          "& .MuiListItemText-primary": {
            fontSize: "1rem",
            [theme.breakpoints.up("sm")]: {
              fontSize: "0.875rem",
            },
          },
        }),
      },
      defaultProps: {
        slotProps: { list: { disablePadding: true } },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          "&:not(.MuiDialog-paperFullScreen)": { borderRadius: "12px" },
        },
      },
    },
  },
});

function App() {
  const [isPresetsDialogOpen, setIsPresetsDialogOpen] = useState(false);

  const showPresetsDialog = useCallback(() => setIsPresetsDialogOpen(true), []);

  return (
    <ThemeProvider theme={theme}>
      <PresetsDialogContext.Provider value={showPresetsDialog}>
        <CssBaseline />
        <Chat />
        <PresetsDialog
          open={isPresetsDialogOpen}
          onClose={() => setIsPresetsDialogOpen(false)}
        />
      </PresetsDialogContext.Provider>
    </ThemeProvider>
  );
}

export default App;
