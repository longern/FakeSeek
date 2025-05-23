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
  Menu,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { useAppDispatch, useAppSelector } from "./app/hooks";
import { setApiKey, setBaseURL, setImageQuality } from "./app/provider";
import { Check } from "@mui/icons-material";

function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [showQualitySelector, setQualitySelectorAnchor] =
    useState<HTMLElement | null>(null);
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
      <DialogContent
        sx={{
          padding: 2.5,
          "& .MuiListItemButton-root": { minHeight: "60px" },
        }}
      >
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
          <Card elevation={0} sx={{ borderRadius: 3, marginTop: 2 }}>
            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={(event) =>
                    setQualitySelectorAnchor(event.currentTarget)
                  }
                >
                  <ListItemText primary={t("Image Quality")} />
                  <Typography variant="body2" color="text.secondary">
                    {t(`quality.${provider.imageQuality}`)}
                  </Typography>
                  <UnfoldMoreIcon />
                </ListItemButton>
                <Menu
                  anchorEl={showQualitySelector}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                  open={Boolean(showQualitySelector)}
                  onClose={() => setQualitySelectorAnchor(null)}
                  slotProps={{
                    list: { disablePadding: true },
                    backdrop: { invisible: false },
                  }}
                >
                  {(["low", "medium", "high"] as const).map((quality) => (
                    <ListItem key={quality} disablePadding>
                      <ListItemButton
                        selected={provider.imageQuality === quality}
                        onClick={() => {
                          dispatch(setImageQuality(quality));
                          setQualitySelectorAnchor(null);
                        }}
                      >
                        <ListItemText
                          primary={t(`quality.${quality}`)}
                          sx={{ marginRight: 2 }}
                        />
                        {provider.imageQuality === quality ? (
                          <Check
                            color="primary"
                            sx={{ width: 24, height: 24 }}
                          />
                        ) : (
                          <Box sx={{ width: 24, height: 24 }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </Menu>
              </ListItem>
            </List>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
