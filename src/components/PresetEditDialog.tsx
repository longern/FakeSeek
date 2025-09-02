import {
  Autocomplete,
  Box,
  Button,
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
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";

import { useAppSelector } from "../app/hooks";
import { Check } from "@mui/icons-material";
import { Preset } from "../app/presets";
import OpenAI from "openai";

function PresetEditDialog({
  open,
  onClose,
  onSave,
  editingPresetId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (preset: Preset) => void;
  editingPresetId: string | null;
}) {
  const [preset, setPreset] = useState<Preset | null>(null);
  const [toolsProviderAnchor, setToolsProviderAnchor] =
    useState<HTMLElement | null>(null);
  const [qualitySelectorAnchor, setQualitySelectorAnchor] =
    useState<HTMLElement | null>(null);
  const presets = useAppSelector((state) => state.presets);
  const [modelCandidates, setModelCandidates] = useState<string[]>([]);
  const [modelInputValue, setModelInputValue] = useState("");
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const loadModelCandidates = useCallback(async () => {
    if (!preset?.apiKey) {
      setModelCandidates([]);
      return;
    }

    const client = new OpenAI({
      apiKey: preset?.apiKey,
      baseURL: preset?.baseURL,
      dangerouslyAllowBrowser: true,
    });

    try {
      const models = await client.models.list();
      setModelCandidates(models.data.map((m) => m.id));
    } catch (e) {
      console.error("Failed to load models", e);
      setModelCandidates([]);
    }
  }, [preset?.apiKey, preset?.baseURL]);

  useEffect(() => {
    if (!open) return;
    setModelCandidates([]);
    if (editingPresetId === null) {
      setPreset({ presetName: "New preset" });
      setModelInputValue("");
    } else {
      const p = presets.presets[editingPresetId];
      setPreset(p ?? null);
      setModelInputValue(p?.defaultModel ?? "");
    }
  }, [open, editingPresetId, presets.presets]);

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
        <IconButton aria-label={t("Close")} size="large" onClick={onClose}>
          <NavigateBeforeIcon />
        </IconButton>
        <Typography
          variant="subtitle1"
          component="div"
          sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
        >
          {t("Settings")}
        </Typography>
        <IconButton
          aria-label={t("Save")}
          size="large"
          onClick={() => onSave(preset!)}
        >
          <SaveIcon />
        </IconButton>
      </Toolbar>
      <DialogContent
        sx={{
          padding: 2.5,
          backgroundColor: (theme) => theme.palette.background.paper,
          "& .MuiListItemButton-root": { minHeight: "60px" },
        }}
      >
        {preset && (
          <Stack gap={3}>
            <TextField
              label={t("Preset Name")}
              variant="outlined"
              fullWidth
              value={preset.presetName}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, presetName: e.target.value } : prev
                )
              }
            />
            <TextField
              label={t("API Key")}
              variant="outlined"
              fullWidth
              value={preset.apiKey ?? ""}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, apiKey: e.target.value } : prev
                )
              }
            />
            <TextField
              label={t("Base URL")}
              variant="outlined"
              fullWidth
              value={preset.baseURL ?? ""}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, baseURL: e.target.value } : prev
                )
              }
            />
            <Autocomplete
              options={modelCandidates}
              value={preset.defaultModel ?? ""}
              onChange={(_e, newValue) =>
                setPreset((prev) =>
                  prev ? { ...prev, defaultModel: newValue ?? undefined } : prev
                )
              }
              inputValue={modelInputValue}
              onInputChange={(_e, newInputValue) =>
                setModelInputValue(newInputValue)
              }
              freeSolo
              fullWidth
              renderInput={(params) => (
                <TextField label={t("Default model")} {...params} />
              )}
              onFocus={loadModelCandidates}
            />
            <Card elevation={0} sx={{ borderRadius: 3, marginTop: 2 }}>
              <List disablePadding>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={(event) =>
                      setToolsProviderAnchor(event.currentTarget)
                    }
                  >
                    <ListItemText primary={t("Tools Provider")} />
                    <Typography variant="body2" color="text.secondary">
                      {t(`tools-provider.${preset.toolsProvider ?? "default"}`)}
                    </Typography>
                    <UnfoldMoreIcon />
                  </ListItemButton>
                  <Menu
                    anchorEl={toolsProviderAnchor}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    open={Boolean(toolsProviderAnchor)}
                    onClose={() => setToolsProviderAnchor(null)}
                    slotProps={{
                      list: { disablePadding: true },
                      backdrop: { invisible: false },
                    }}
                  >
                    {([undefined, "openai-builtin"] as const).map(
                      (toolsProvider) => (
                        <ListItem
                          key={toolsProvider ?? "default"}
                          disablePadding
                        >
                          <ListItemButton
                            selected={preset.toolsProvider === toolsProvider}
                            onClick={() => {
                              setToolsProviderAnchor(null);
                            }}
                          >
                            <ListItemText
                              primary={t(
                                `tools-provider.${toolsProvider ?? "default"}`
                              )}
                              sx={{ marginRight: 2 }}
                            />
                            {preset.toolsProvider === toolsProvider ? (
                              <Check
                                color="primary"
                                sx={{ width: 24, height: 24 }}
                              />
                            ) : (
                              <Box sx={{ width: 24, height: 24 }} />
                            )}
                          </ListItemButton>
                        </ListItem>
                      )
                    )}
                  </Menu>
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
                      {t(`quality.${preset.imageQuality}`)}
                    </Typography>
                    <UnfoldMoreIcon />
                  </ListItemButton>
                  <Menu
                    anchorEl={qualitySelectorAnchor}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    open={Boolean(qualitySelectorAnchor)}
                    onClose={() => setQualitySelectorAnchor(null)}
                    slotProps={{
                      list: { disablePadding: true, sx: { minWidth: "160px" } },
                      backdrop: { invisible: false },
                    }}
                  >
                    {(["low", "medium", "high"] as const).map((quality) => (
                      <ListItem key={quality} disablePadding>
                        <ListItemButton
                          selected={preset.imageQuality === quality}
                          onClick={() => {
                            setQualitySelectorAnchor(null);
                          }}
                        >
                          <ListItemText
                            primary={t(`quality.${quality}`)}
                            sx={{ marginRight: 2 }}
                          />
                          {preset.imageQuality === quality ? (
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
            {editingPresetId && (
              <Box>
                <Button variant="outlined" color="error">
                  {t("Delete preset")}
                </Button>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PresetEditDialog;
