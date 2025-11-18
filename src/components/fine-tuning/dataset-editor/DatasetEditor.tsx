import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import OpenAI from "openai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentPreset } from "../../presets/hooks";
import { getTokenizer } from "../hooks";
import DatasetRecordEditor, { DatasetRecord } from "./DatasetRecordEditor";
import { getDatasetDirectoryHandle, parseDataset, saveDataset } from "./utils";

function DatasetEditor({
  open,
  onClose,
  datasetName,
  autoSave = true,
}: {
  open: boolean;
  onClose: () => void;
  datasetName?: string;
  autoSave?: boolean;
}) {
  const [content, setContent] = useState<Array<DatasetRecord> | null>(null);
  const [selected, setSelected] = useState(0);
  const [modified, setModified] = useState(false);

  const [model, setModel] = useState<string | undefined>(undefined);
  const [showModelWarning, setShowModelWarning] = useState(false);
  const currentPreset = useCurrentPreset();

  const { t } = useTranslation("fineTuning");

  const confirmClose = useCallback(() => {
    if (!modified) return onClose();
    const ok = window.confirm(t("confirm-close-with-unsaved-changes"));
    if (ok) onClose();
  }, [modified, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!datasetName || content === null) return;

    await saveDataset(content, datasetName, model);
    setModified(false);
  }, [content, datasetName, model]);

  useEffect(() => {
    if (autoSave) handleSave();
  }, [autoSave, handleSave]);

  useEffect(() => {
    if (!open) return;

    setModified(false);

    if (!datasetName) {
      setContent([]);
      setModel(currentPreset?.defaultModel);
      return;
    }

    getDatasetDirectoryHandle().then(async (dir) => {
      const fileHandle = await dir.getFileHandle(datasetName, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const { model: modelFromFile, dataset } = text
        ? parseDataset(text)
        : { dataset: [] as DatasetRecord[] };
      setContent(dataset);
      setModel(modelFromFile ?? currentPreset?.defaultModel);

      if (modelFromFile) {
        const client = new OpenAI({
          apiKey: currentPreset?.apiKey,
          baseURL: currentPreset?.baseURL,
          dangerouslyAllowBrowser: true,
        });

        try {
          await client.models.retrieve(modelFromFile);
        } catch (e) {
          if (e instanceof OpenAI.APIError && e.status === 404)
            setShowModelWarning(true);
        }
      }

      // Preload tokenizer
      const model = modelFromFile ?? currentPreset?.defaultModel;
      if (model) getTokenizer(model).catch(() => {});

      setSelected(0);
    });

    const oldTitle = document.title;
    document.title = datasetName + " - FakeSeek";
    return () => {
      document.title = oldTitle;
    };
  }, [open, datasetName]);

  return (
    <Dialog
      id="dataset-editor-dialog"
      open={open}
      onClose={confirmClose}
      fullScreen
    >
      <DialogTitle sx={{ padding: 0, backgroundColor: "background.default" }}>
        <Toolbar disableGutters>
          <IconButton
            aria-label={t("Close")}
            size="large"
            onClick={confirmClose}
          >
            <NavigateBeforeIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
            noWrap
          >
            {datasetName}
          </Typography>
          <IconButton
            aria-label="Save"
            size="large"
            disabled={!modified}
            onClick={handleSave}
          >
            <SaveIcon />
          </IconButton>
        </Toolbar>
      </DialogTitle>

      <DialogContent dividers sx={{ padding: 0 }}>
        <Box sx={{ height: "100%" }}>
          <Snackbar
            open={showModelWarning}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            sx={{ top: "72px" }}
          >
            <Alert
              severity="warning"
              onClose={() => setShowModelWarning(false)}
            >
              {t("model-not-found-warning", {
                presetName: currentPreset?.presetName,
                datasetModel: model,
              })}
            </Alert>
          </Snackbar>

          {content?.[selected] === undefined ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {content === null
                  ? t("Loading...")
                  : content.length === 0
                  ? t("No data")
                  : t("Out of range")}
              </Typography>
            </Box>
          ) : (
            <DatasetRecordEditor
              key={selected}
              record={content[selected]}
              model={model}
              onChange={(newRecord) => {
                setContent((prev) => {
                  if (!prev) return prev;
                  const newContent = [...prev];
                  newContent[selected] = newRecord(prev[selected]);
                  return newContent;
                });

                if (!autoSave) setModified(true);
              }}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Stack
          direction="row"
          spacing={1}
          sx={{ width: "100%", justifyContent: "center", alignItems: "center" }}
        >
          <Box sx={{ width: "266px" }}>
            <Pagination
              count={content?.length}
              page={selected + 1}
              onChange={(_, page) => setSelected(page - 1)}
              showFirstButton={true}
              showLastButton={true}
              hideNextButton={true}
              hidePrevButton={true}
              boundaryCount={0}
              disabled={content === null || content.length === 0}
            />
          </Box>
          <IconButton
            aria-label={t("Delete record")}
            disabled={!content?.length}
            onClick={() => {
              const confirm = window.confirm(t("confirm-delete-record"));
              if (!confirm) return;
              setContent((prev) =>
                prev ? prev.filter((_, i) => i !== selected) : prev
              );
              setSelected((prev) => (prev > 0 ? prev - 1 : 0));
              setModified(true);
            }}
          >
            <DeleteIcon />
          </IconButton>
          <IconButton
            aria-label={t("Add record")}
            size="small"
            onClick={() => {
              setContent(
                (prev) =>
                  prev && [
                    ...prev,
                    { prompt: [{ role: "user", content: "" }] } as any,
                  ]
              );
              setSelected(content ? content.length : 0);
              setModified(true);
            }}
          >
            <AddIcon />
          </IconButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default DatasetEditor;
