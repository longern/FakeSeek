import {
  Box,
  Card,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { setApiKey, setBaseURL } from "./app/provider";

function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const provider = useAppSelector((state) => state.provider);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { backgroundColor: "background.default" } } }}
    >
      <Toolbar
        disableGutters
        sx={{
          position: "sticky",
          top: 0,
          borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
          zIndex: 1,
        }}
      >
        <IconButton aria-label="Close" size="large" onClick={onClose}>
          <NavigateBeforeIcon />
        </IconButton>
        <Typography
          variant="subtitle1"
          component="div"
          sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
        >
          {t("Settings")}
        </Typography>
        <Box sx={{ width: 48 }} />
      </Toolbar>
      <DialogContent sx={{ padding: 2.5 }}>
        <Stack>
          <Card
            elevation={0}
            sx={{ borderRadius: 3, backgroundColor: "background.paper" }}
          >
            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    const newAPIKey = window.prompt(t("Enter new API key"));
                    if (!newAPIKey) return;
                    dispatch(setApiKey(newAPIKey));
                  }}
                >
                  <ListItemText
                    primary={t("API Key")}
                    secondary={provider.apiKey ? "********" : "-"}
                  />
                  <IconButton edge="end">
                    <NavigateNextIcon />
                  </IconButton>
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    const newBaseURL = window.prompt(
                      t("Enter new base URL"),
                      provider.baseURL
                    );
                    if (!newBaseURL) return;
                    dispatch(setBaseURL(newBaseURL));
                  }}
                >
                  <ListItemText
                    primary={t("Base URL")}
                    secondary={provider.baseURL || "-"}
                  />
                  <IconButton edge="end">
                    <NavigateNextIcon />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            </List>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
