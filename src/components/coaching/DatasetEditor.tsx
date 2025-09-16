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
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import yaml from "yaml";

import { useAppSelector } from "../../app/hooks";
import DatasetRecordEditor, { DatasetRecord } from "./DatasetRecordEditor";

export async function getDatasetDirectoryHandle() {
  const root = await navigator.storage.getDirectory();
  const coachingDirHandle = await root.getDirectoryHandle(".coaching", {
    create: true,
  });
  const datasetDirectoryHandle = await coachingDirHandle.getDirectoryHandle(
    "datasets",
    { create: true }
  );
  return datasetDirectoryHandle;
}

function parseDataset(content: string): Array<DatasetRecord> {
  return yaml.parseDocument(content).toJS();
}

function DatasetEditor({
  open,
  onClose,
  datasetName,
}: {
  open: boolean;
  onClose: () => void;
  datasetName?: string;
}) {
  const [content, setContent] = useState<Array<DatasetRecord> | null>(null);
  const [selected, setSelected] = useState(0);
  const [modified, setModified] = useState(false);

  const currentPreset = useAppSelector((state) =>
    state.presets.current === null
      ? null
      : state.presets.presets[state.presets.current] ?? null
  );

  const { t } = useTranslation();

  const confirmClose = useCallback(() => {
    if (!modified) return onClose();
    const ok = window.confirm(t("confirm-close-with-unsaved-changes"));
    if (ok) onClose();
  }, [modified, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!datasetName || content === null) return;

    const document = new yaml.Document(content);
    document.commentBefore = ` Model: ${currentPreset?.defaultModel}`;
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
      const content = text ? parseDataset(text) : [];
      setContent(content);
      setSelected(0);
      setModified(false);
    });
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
        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
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
                  ? t("No records")
                  : t("Out of range")}
              </Typography>
            </Box>
          ) : (
            <DatasetRecordEditor
              key={selected}
              record={content[selected]}
              onChange={(newRecord) => {
                setContent((prev) => {
                  if (!prev) return prev;
                  const newContent = [...prev];
                  newContent[selected] = newRecord;
                  return newContent;
                });
                setModified(true);
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
