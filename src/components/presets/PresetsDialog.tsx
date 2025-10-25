import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  patch as patchPreset,
  remove as removePreset,
  setCurrent as setCurrentPreset,
} from "../../app/presets";
import PresetEditDialog from "./PresetEditDialog";

function PresetsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const presets = useAppSelector((state) => state.presets);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  return (
    <>
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
            {t("Presets")}
          </Typography>
          <Box sx={{ width: 48 }} />
        </Toolbar>
        <DialogContent
          sx={{
            padding: 2.5,
            "& .MuiListItemButton-root": { minHeight: "60px" },
          }}
        >
          {Object.keys(presets.presets).length === 0 ? (
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ textAlign: "center", padding: 4, userSelect: "none" }}
            >
              {t("No data")}
            </Typography>
          ) : (
            <Card elevation={0} sx={{ borderRadius: 3 }}>
              <List disablePadding>
                {Object.entries(presets.presets).map(([presetId, preset]) => (
                  <ListItem key={presetId} disablePadding>
                    <ListItemButton
                      selected={presets.current === presetId}
                      onClick={() => {
                        dispatch(setCurrentPreset(presetId));
                      }}
                    >
                      <ListItemText primary={preset.presetName} />
                      <IconButton
                        edge="end"
                        onClick={() => {
                          setShowPresetEditor(true);
                          setEditingPresetId(presetId);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Card>
          )}
        </DialogContent>

        <DialogActions>
          <Box
            sx={{ display: "flex", justifyContent: "center", width: "100%" }}
          >
            <Button
              size="large"
              onClick={() => {
                setShowPresetEditor(true);
                setEditingPresetId(null);
              }}
            >
              <AddIcon />
              {t("Create")}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <PresetEditDialog
        open={showPresetEditor}
        onClose={() => {
          setShowPresetEditor(false);
          setEditingPresetId(null);
        }}
        onSave={(preset) => {
          const id =
            editingPresetId ??
            `preset-${Date.now().toString(16)}-${Math.random()
              .toString(16)
              .slice(2)}`;
          dispatch(patchPreset({ presetId: id, preset }));
          dispatch(setCurrentPreset(id));
          setShowPresetEditor(false);
          setEditingPresetId(null);
        }}
        onDelete={(presetId) => {
          dispatch(removePreset({ presetId }));
          if (presets.current === presetId) dispatch(setCurrentPreset(null));
          setShowPresetEditor(false);
          setEditingPresetId(null);
        }}
        editingPresetId={editingPresetId}
      />
    </>
  );
}

export default PresetsDialog;
