import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { createContext, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import yaml from "yaml";

import { useCurrentPreset } from "../presets/hooks";
import DatasetRecordEditor, { DatasetRecord } from "./DatasetRecordEditor";
import { convertFromHarmony, convertToHarmony } from "./utils";

export const OpenDatasetEditorContext = createContext<
  (datasetName: string | undefined, onClose?: () => void) => void
>(() => {});

export async function getDatasetDirectoryHandle() {
  const root = await navigator.storage.getDirectory();
  const fineTuningDirHandle = await root.getDirectoryHandle(".coaching", {
    create: true,
  });
  const datasetDirectoryHandle = await fineTuningDirHandle.getDirectoryHandle(
    "datasets",
    { create: true }
  );
  return datasetDirectoryHandle;
}

export function parseDataset(content: string) {
  const parsed = yaml.parseDocument(content);
  const match = parsed.commentBefore?.match(/Model:\s*(\S+)/);
  const model = match ? match[1] : undefined;
  let dataset = parsed.toJS() as Array<DatasetRecord>;
  if (model)
    dataset = dataset.map((record) => ({
      ...record,
      prompt: convertToHarmony(model, record.prompt),
      completion: convertToHarmony(model, record.completion),
    }));
  return { model, dataset };
}

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

  const currentPreset = useCurrentPreset();
  const [model, setModel] = useState(currentPreset?.defaultModel);

  const { t } = useTranslation("fineTuning");

  const confirmClose = useCallback(() => {
    if (!modified) return onClose();
    const ok = window.confirm(t("confirm-close-with-unsaved-changes"));
    if (ok) onClose();
  }, [modified, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!datasetName || content === null) return;

    const dataset = model
      ? content.map((record) => ({
          ...record,
          prompt: convertFromHarmony(model, record.prompt),
          completion: convertFromHarmony(model, record.completion),
        }))
      : content;
    const document = new yaml.Document(dataset);
    if (model) document.commentBefore = ` Model: ${model}`;
    const documentString = document.toString({ lineWidth: 0 });

    const dir = await getDatasetDirectoryHandle();
    const fileHandle = await dir.getFileHandle(datasetName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(documentString);
    await writable.close();
    setModified(false);
  }, [content, datasetName]);

  useEffect(() => {
    if (!open) return;

    if (!datasetName) {
      setContent([]);
      return;
    }

    getDatasetDirectoryHandle().then(async (dir) => {
      const fileHandle = await dir.getFileHandle(datasetName, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const { model, dataset } = text
        ? parseDataset(text)
        : { dataset: [] as DatasetRecord[] };
      setContent(dataset);
      if (model) setModel(model);
      setSelected(0);
      setModified(false);
    });

    const oldTitle = document.title;
    document.title = datasetName + " - FakeSeek";
    return () => {
      document.title = oldTitle;
    };
  }, [open, datasetName]);

  return (
    <Dialog open={open} onClose={confirmClose} fullScreen>
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
                  newContent[selected] = newRecord;
                  return newContent;
                });

                if (autoSave) handleSave();
                else setModified(true);
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
