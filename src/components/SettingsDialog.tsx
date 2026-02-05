import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { patch as patchSettings } from "@/app/settings";
import { useShowPresetsDialog } from "./presets/contexts";

function languageDisplayName(languageCode: string) {
  const nameGenerator = new Intl.DisplayNames(languageCode, {
    type: "language",
  });
  const displayName = nameGenerator.of(languageCode);
  return displayName ?? languageCode;
}

function LanguageSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent dividers sx={{ paddingX: 2, paddingY: 1 }}>
        <FormControl>
          <RadioGroup
            aria-label={t("Language")}
            defaultValue={settings.language ?? i18n.language}
            name="language-options"
            onChange={(_, value) => {
              i18n.changeLanguage(value);
              dispatch(patchSettings({ settings: { language: value } }));
            }}
          >
            {["zh-CN", "en"].map((lang) => (
              <FormControlLabel
                key={lang}
                value={lang}
                control={<Radio />}
                label={languageDisplayName(lang)}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ padding: 0 }}>
        <Button size="large" fullWidth onClick={onClose}>
          {t("Confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
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
          "& .MuiListItemButton-root": {
            minHeight: { xs: "60px", sm: "auto" },
          },
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
              <ListItemButton onClick={() => setShowLanguageDialog(true)}>
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

        <LanguageSettingsDialog
          open={showLanguageDialog}
          onClose={() => setShowLanguageDialog(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
