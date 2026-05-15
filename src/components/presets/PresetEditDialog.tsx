import CheckIcon from "@mui/icons-material/Check";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  Autocomplete,
  Box,
  Card,
  Collapse,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import OpenAI from "openai";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "../../app/hooks";
import { Preset } from "../../app/presets";
import StyledTextField from "./StyledTextField";

type PresetApiModeOption = "chat-completions" | "responses" | "gemini";

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
  const presets = useAppSelector((state) => state.presets);
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  useEffect(() => {
    if (!open) return;
    if (editingPresetId === null) {
      setPreset({ presetName: "New preset" });
    } else {
      const p = presets.presets[editingPresetId];
      setPreset(p ?? null);
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
          "& .MuiListItem-root": { minHeight: { xs: "60px", sm: "auto" } },
          "& .MuiListItemButton-root": {
            minHeight: { xs: "60px", sm: "auto" },
          },
        }}
      >
        {preset && (
          <PresetEditorForm
            preset={preset}
            setPreset={setPreset}
            editingPresetId={editingPresetId}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PresetEditorForm({
  preset,
  setPreset,
  editingPresetId,
  onDelete,
}: {
  preset: Preset;
  setPreset: Dispatch<SetStateAction<Preset | null>>;
  editingPresetId: string | null;
  onDelete: (presetId: string) => void;
}) {
  const [toolsProviderAnchor, setToolsProviderAnchor] =
    useState<HTMLElement | null>(null);
  const [qualitySelectorAnchor, setQualitySelectorAnchor] =
    useState<HTMLElement | null>(null);
  const [modelCandidates, setModelCandidates] = useState<string[]>([]);
  const [modelHelperText, setModelHelperText] = useState<string>("");
  const [modelInputValue, setModelInputValue] = useState(
    preset.defaultModel ?? "",
  );
  const { t } = useTranslation();
  const [showAPIMode, setShowAPIMode] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [apiModeAnchorEl, setApiModeAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  const loadModelCandidates = useCallback(async () => {
    if (!preset.apiKey) {
      setModelCandidates([]);
      return;
    }

    const client = new OpenAI({
      apiKey: preset.apiKey,
      baseURL: preset.baseURL,
      dangerouslyAllowBrowser: true,
    });

    try {
      setModelCandidates([]);
      setModelHelperText("");
      const models = await client.models.list();
      setModelCandidates(models.data.map((m) => m.id));
    } catch (e) {
      if (e instanceof OpenAI.APIError)
        setModelHelperText(`API Error: ${e.status}`);
      else console.error("Failed to load models", e);
    }
  }, [preset.apiKey, preset.baseURL]);

  useEffect(() => {
    setModelCandidates([]);
    setModelInputValue(preset.defaultModel ?? "");
  }, [editingPresetId, preset.defaultModel]);

  useEffect(() => {
    setShowAdvancedOptions(false);
  }, [editingPresetId]);

  const handleAPIModeChange = useCallback(
    (newValue: PresetApiModeOption) => {
      const newApiMode = newValue === "responses" ? undefined : newValue;
      setPreset((prev) =>
        prev ? { ...prev, apiMode: newApiMode as Preset["apiMode"] } : prev,
      );
      setShowAPIMode(false);
      setApiModeAnchorEl(null);
    },
    [setPreset],
  );

  return (
    <Stack gap={2}>
      <Card elevation={0} sx={{ borderRadius: 3 }}>
        <List disablePadding>
          <ListItem>
            <StyledTextField
              id="preset-name-input"
              label={t("Preset Name")}
              value={preset.presetName}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, presetName: e.target.value } : prev,
                )
              }
              sx={{ "& input": { textAlign: "right" } }}
            />
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              onClick={(event) => {
                setApiModeAnchorEl(event.currentTarget);
                setShowAPIMode(true);
              }}
            >
              <ListItemText primary={t("API Mode")} />
              <Typography variant="body2" color="text.secondary">
                {preset.apiMode === undefined
                  ? "OpenAI Responses API"
                  : preset.apiMode === "chat-completions"
                    ? "OpenAI Chat Completion API"
                    : preset.apiMode === "gemini"
                      ? "Google Gemini API"
                      : preset.apiMode}
              </Typography>
              <UnfoldMoreIcon />
            </ListItemButton>
            <Menu
              open={showAPIMode}
              onClose={() => {
                setShowAPIMode(false);
                setApiModeAnchorEl(null);
              }}
              anchorEl={apiModeAnchorEl}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ backdrop: { invisible: false } }}
            >
              <MenuItem
                selected={preset.apiMode === undefined}
                onClick={() => handleAPIModeChange("responses")}
              >
                <ListItemText>OpenAI Responses API</ListItemText>
              </MenuItem>
              <MenuItem
                selected={preset.apiMode === "chat-completions"}
                onClick={() => handleAPIModeChange("chat-completions")}
              >
                <ListItemText>OpenAI Chat Completion API</ListItemText>
              </MenuItem>
              <MenuItem
                selected={
                  (preset.apiMode as PresetApiModeOption | undefined) ===
                  "gemini"
                }
                onClick={() => handleAPIModeChange("gemini")}
              >
                <ListItemText>Google Gemini API</ListItemText>
              </MenuItem>
            </Menu>
          </ListItem>
          <ListItem>
            <StyledTextField
              type="password"
              id="preset-api-key-input"
              label={t("API Key")}
              value={preset.apiKey ?? ""}
              sx={{ "& input": { textAlign: "right" } }}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, apiKey: e.target.value } : prev,
                )
              }
            />
          </ListItem>
          <ListItem>
            <StyledTextField
              id="preset-base-url-input"
              label={t("Base URL")}
              value={preset.baseURL ?? ""}
              sx={{ "& input": { textAlign: "right" } }}
              onChange={(e) =>
                setPreset((prev) =>
                  prev ? { ...prev, baseURL: e.target.value } : prev,
                )
              }
            />
          </ListItem>
          <ListItem>
            <Autocomplete
              id="preset-default-model-input"
              options={modelCandidates}
              value={preset.defaultModel ?? ""}
              sx={{ "& input": { textAlign: "right" } }}
              onBlur={() => {
                const newValue = modelInputValue.trim() || undefined;
                setPreset((prev) =>
                  prev && preset.defaultModel !== newValue
                    ? { ...prev, defaultModel: newValue }
                    : prev,
                );
              }}
              inputValue={modelInputValue}
              onInputChange={(_e, newInputValue) =>
                setModelInputValue(newInputValue)
              }
              freeSolo
              fullWidth
              renderInput={({
                InputProps,
                inputProps,
                InputLabelProps,
                ...params
              }) => {
                const {
                  onChange,
                  onFocus,
                  onBlur,
                  onMouseDown,
                  ...inputPropsRest
                } = inputProps;
                return (
                  <StyledTextField
                    label={t("Default model")}
                    error={Boolean(modelHelperText)}
                    helperText={modelHelperText}
                    slotProps={{
                      input: {
                        ...InputProps,
                        onChange,
                        onFocus,
                        onBlur,
                        onMouseDown,
                      },
                      inputLabel: InputLabelProps,
                      htmlInput: inputPropsRest,
                    }}
                    inputRef={inputProps.ref}
                    {...params}
                  />
                );
              }}
              onFocus={loadModelCandidates}
            />
          </ListItem>
        </List>
      </Card>

      <Card elevation={0} sx={{ borderRadius: 3 }}>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              aria-expanded={showAdvancedOptions}
              onClick={() => setShowAdvancedOptions((prevShow) => !prevShow)}
            >
              <ListItemText primary={t("Show Advanced Options")} />
              <Switch
                edge="end"
                checked={showAdvancedOptions}
                onClick={(event) => event.stopPropagation()}
                onChange={() =>
                  setShowAdvancedOptions((prevShow) => !prevShow)
                }
                slotProps={{
                  input: { "aria-label": t("Show Advanced Options") },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>

      <Collapse in={showAdvancedOptions} timeout="auto" unmountOnExit>
        <Stack gap={2}>
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
                  slotProps={{ backdrop: { invisible: false } }}
                >
                  {([undefined, "openai-builtin"] as const).map(
                    (toolsProvider) => (
                      <ListItem key={toolsProvider ?? "default"} disablePadding>
                        <ListItemButton
                          selected={preset.toolsProvider === toolsProvider}
                          onClick={() => {
                            setPreset((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    toolsProvider: toolsProvider,
                                  }
                                : prev,
                            );
                            setToolsProviderAnchor(null);
                          }}
                        >
                          <ListItemText
                            primary={t(
                              `tools-provider.${toolsProvider ?? "default"}`,
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
                    ),
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
                    {t(`quality.${preset.imageQuality ?? "auto"}`)}
                  </Typography>
                  <UnfoldMoreIcon />
                </ListItemButton>
                <Menu
                  anchorEl={qualitySelectorAnchor}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                  open={Boolean(qualitySelectorAnchor)}
                  onClose={() => setQualitySelectorAnchor(null)}
                  slotProps={{ backdrop: { invisible: false } }}
                >
                  {(["auto", "low", "medium", "high"] as const).map(
                    (quality) => (
                      <ListItem key={quality} disablePadding>
                        <ListItemButton
                          selected={(preset.imageQuality ?? "auto") === quality}
                          onClick={() => {
                            setPreset(
                              (prev) =>
                                prev && {
                                  ...prev,
                                  imageQuality:
                                    quality === "auto" ? undefined : quality,
                                },
                            );
                            setQualitySelectorAnchor(null);
                          }}
                        >
                          <ListItemText
                            primary={t(`quality.${quality}`)}
                            sx={{ marginRight: 2 }}
                          />
                          {(preset.imageQuality ?? "auto") === quality ? (
                            <CheckIcon
                              color="primary"
                              sx={{ width: 24, height: 24 }}
                            />
                          ) : (
                            <Box sx={{ width: 24, height: 24 }} />
                          )}
                        </ListItemButton>
                      </ListItem>
                    ),
                  )}
                </Menu>
              </ListItem>
            </List>
          </Card>

          <Card elevation={0} sx={{ borderRadius: 3 }}>
            <List disablePadding>
              <ListItem>
                <StyledTextField
                  type="password"
                  id="preset-fine-tuning-api-key-input"
                  label={t("Fine-tuning API Key")}
                  value={preset.fineTuningApiKey ?? ""}
                  sx={{ "& input": { textAlign: "right" } }}
                  onChange={(e) =>
                    setPreset((prev) =>
                      prev
                        ? { ...prev, fineTuningApiKey: e.target.value }
                        : prev,
                    )
                  }
                />
              </ListItem>
              <ListItem>
                <StyledTextField
                  id="preset-fine-tuning-base-url-input"
                  label={t("Fine-tuning Base URL")}
                  value={preset.fineTuningBaseURL ?? ""}
                  sx={{ "& input": { textAlign: "right" } }}
                  onChange={(e) =>
                    setPreset((prev) =>
                      prev
                        ? { ...prev, fineTuningBaseURL: e.target.value }
                        : prev,
                    )
                  }
                />
              </ListItem>
            </List>
          </Card>
        </Stack>
      </Collapse>

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
  );
}

export default PresetEditDialog;
