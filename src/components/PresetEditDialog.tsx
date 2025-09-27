import {
  Autocomplete,
  Box,
  Card,
  Dialog,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";

import { useAppSelector } from "../app/hooks";
import { Preset } from "../app/presets";
import OpenAI from "openai";

function PresetEditDialog({
  open,
  onClose,
  onSave,
  onDelete,
  editingPresetId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (preset: Preset) => void;
  onDelete: (presetId: string) => void;
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
          padding: 2,
          "& .MuiListItemButton-root": { minHeight: "60px" },
        }}
      >
        {preset && (
          <Stack gap={2}>
            <Card elevation={0} sx={{ borderRadius: 3, padding: 2.5 }}>
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
                <FormControl fullWidth>
                  <InputLabel id="api-mode-select-label">
                    {t("API Mode")}
                  </InputLabel>
                  <Select
                    labelId="api-mode-select-label"
                    value={preset.apiMode ?? "responses"}
                    label={t("API Mode")}
                    onChange={(event) => {
                      const newApiMode =
                        event.target.value === "responses"
                          ? undefined
                          : event.target.value;
                      setPreset((prev) =>
                        prev ? { ...prev, apiMode: newApiMode } : prev
                      );
                    }}
                  >
                    <MenuItem value="responses">OpenAI Responses API</MenuItem>
                    <MenuItem value="chat-completions">
                      OpenAI Chat Completion API
                    </MenuItem>
                    <MenuItem value="gemini">Google Gemini API</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  type="password"
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
                      prev
                        ? { ...prev, defaultModel: newValue ?? undefined }
                        : prev
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
              </Stack>
            </Card>

            <Card elevation={0} sx={{ borderRadius: 3, padding: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body1" sx={{ alignSelf: "center" }}>
                    {t("Temperature")}
                  </Typography>
                  <Tooltip title={t("temperature-help")}>
                    <IconButton size="small">
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body1" sx={{ alignSelf: "center" }}>
                  {(preset.temperature ?? 1).toFixed(2)}
                </Typography>
              </Box>
              <Slider
                value={preset.temperature ?? 1}
                onChange={(_e, newValue) => {
                  const temperature = newValue !== 1 ? newValue : undefined;
                  setPreset((prev) => (prev ? { ...prev, temperature } : prev));
                }}
                min={0}
                max={2}
                step={0.01}
                aria-label={t("Temperature")}
              />
            </Card>

            <Card elevation={0} sx={{ borderRadius: 3 }}>
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
                              <CheckIcon
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

            <Card elevation={0} sx={{ borderRadius: 3 }}>
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
                            <CheckIcon
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
              <Card elevation={0} sx={{ borderRadius: 3 }}>
                <List disablePadding>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => {
                        if (window.confirm(t("delete-preset-confirm")))
                          onDelete(editingPresetId);
                      }}
                    >
                      <ListItemText
                        primary={t("Delete Preset")}
                        slotProps={{ primary: { color: "error" } }}
                      />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Card>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PresetEditDialog;
