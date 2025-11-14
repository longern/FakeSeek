import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
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
import { useTranslation } from "react-i18next";

import { useShowPresetsDialog } from "./presets/contexts";

function SettingsBlock({
  subheader,
  children,
}: {
  subheader?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      {subheader && (
        <Typography
          variant="body2"
          gutterBottom
          sx={{ marginLeft: 1.5, color: "text.secondary" }}
        >
          {subheader}
        </Typography>
      )}
      <Card elevation={0} sx={{ borderRadius: 3 }}>
        <List disablePadding>{children}</List>
      </Card>
    </Box>
  );
}

function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const showPresetsDialog = useShowPresetsDialog();
  const { t } = useTranslation();
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
        <Stack spacing={2}>
          <SettingsBlock subheader={t("Account")}>
            <ListItem disablePadding>
              <ListItemButton onClick={showPresetsDialog}>
                <ListItemText primary={t("Presets")} />
                <NavigateNextIcon color="disabled" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {}}>
                <ListItemText primary={t("Data controls")} />
                <NavigateNextIcon color="disabled" />
              </ListItemButton>
            </ListItem>
          </SettingsBlock>

          <SettingsBlock subheader={t("App")}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {}}>
                <ListItemText primary={t("Language")} />
                <NavigateNextIcon color="disabled" />
              </ListItemButton>
            </ListItem>
          </SettingsBlock>

          <SettingsBlock subheader={t("Connections")}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={async () => {
                  const remoteHost = window.prompt("Enter new remote host");
                  if (remoteHost === null) return;
                  const { env } = await import("@huggingface/transformers");
                  env.remoteHost = remoteHost;
                }}
              >
                <ListItemText primary={t("HuggingFace remote host")} />
                <NavigateNextIcon color="disabled" />
              </ListItemButton>
            </ListItem>
          </SettingsBlock>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
