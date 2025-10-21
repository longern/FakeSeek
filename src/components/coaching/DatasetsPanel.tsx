import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OutputIcon from "@mui/icons-material/Output";
import {
  Box,
  Card,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SyntaxHighlighter from "react-syntax-highlighter";
import yaml from "yaml";

import {
  getDatasetDirectoryHandle,
  OpenDatasetEditorContext,
} from "./DatasetEditor";

export interface DatasetFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export async function listDatasets() {
  const datasetDirHandle = await getDatasetDirectoryHandle();

  const datasets = [];
  for await (const key of datasetDirHandle.keys()) {
    const handle = await datasetDirHandle.getFileHandle(key);
    const file = await handle.getFile();
    datasets.push({
      name: handle.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    } as DatasetFile);
  }

  return datasets;
}

export async function readDataset(name: string) {
  const datasetDirHandle = await getDatasetDirectoryHandle();
  const fileHandle = await datasetDirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file;
}

export async function readDatasetText(name: string) {
  const file = await readDataset(name);
  return file.text();
}

async function copyDataset(srcName: string, destName: string) {
  const datasetDirHandle = await getDatasetDirectoryHandle();
  const srcHandle = await datasetDirHandle.getFileHandle(srcName);
  const srcFile = await srcHandle.getFile();
  const destHandle = await datasetDirHandle.getFileHandle(destName, {
    create: true,
  });
  const writable = await destHandle.createWritable();
  await writable.write(await srcFile.text());
  await writable.close();
}

async function exportDataset(name: string) {
  const datasetDirHandle = await getDatasetDirectoryHandle();
  const fileHandle = await datasetDirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteDataset(name: string) {
  const datasetDirHandle = await getDatasetDirectoryHandle();
  await datasetDirHandle.removeEntry(name);
}

async function convertToYaml(file: File) {
  const text = await file.text();
  let records;
  if (file.name.endsWith(".jsonl")) {
    records = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } else if (file.name.endsWith(".json")) {
    records = JSON.parse(text);
  } else if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
    records = yaml.parse(text);
  } else throw new Error("Unsupported file format");

  return yaml.stringify(records);
}

function DatasetsPanel() {
  const [datasets, setDatasets] = useState<DatasetFile[] | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<
    DatasetFile | undefined
  >(undefined);
  const [selectedDatasetContent, setSelectedDatasetContent] = useState<
    string | null
  >(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openDatasetEditor = useContext(OpenDatasetEditorContext);

  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const handleCreateClick = useCallback(() => {
    const name = window.prompt(t("Enter dataset name (without .yml suffix)"));
    if (!name) return;
    if (!name.match(/^[a-zA-Z0-9_\-]+$/)) {
      window.alert(t("Invalid dataset name"));
      return;
    }
    if (datasets?.find((file) => file.name === `${name}.yml`)) {
      window.alert(t("Dataset already exists"));
      return;
    }
    openDatasetEditor(`${name}.yml`, () => listDatasets().then(setDatasets));
  }, [datasets, openDatasetEditor, t]);

  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.jsonl,.yaml,.yml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const importName = file.name.replace(/\.(jsonl|json|yaml|yml)$/, ".yml");
      try {
        const importContent = await convertToYaml(file);

        const datasetDirHandle = await getDatasetDirectoryHandle();
        const destHandle = await datasetDirHandle.getFileHandle(importName, {
          create: true,
        });
        const writable = await destHandle.createWritable();
        await writable.write(importContent);
        await writable.close();
      } catch (e) {
        window.alert(`Failed to import dataset: ${(e as Error).message}`);
        return;
      }

      const newDatasets = await listDatasets();
      setDatasets(newDatasets);
    };
    input.click();
  }, []);

  const handleCopyClick = useCallback(async () => {
    setAnchorEl(null);
    if (!selectedDataset) return;
    const newName = window.prompt(
      t("Enter new dataset name (without .yml suffix)")
    );
    if (!newName) return;
    await copyDataset(selectedDataset.name, `${newName}.yml`);
    const newDatasets = await listDatasets();
    setDatasets(newDatasets);
    setSelectedDataset(undefined);
    setSelectedDatasetContent(null);
  }, [selectedDataset, t]);

  const handleDeleteClick = useCallback(async () => {
    setAnchorEl(null);
    if (!selectedDataset) return;
    const confirmed = window.confirm(
      t("confirm-delete-dataset", { name: selectedDataset })
    );
    if (!confirmed) return;
    await deleteDataset(selectedDataset.name);
    setDatasets((prev) => prev?.filter((d) => d !== selectedDataset) ?? null);
    setSelectedDataset(undefined);
    setSelectedDatasetContent(null);
  }, [selectedDataset, t]);

  useEffect(() => {
    listDatasets().then(setDatasets);
  }, []);

  const datasetList = (
    <Stack gap={1.5}>
      <Card elevation={0} sx={{ borderRadius: 3, minWidth: "260px" }}>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton onClick={handleCreateClick}>
              <ListItemText
                primary={t("Create dataset")}
                slotProps={{ primary: { color: "primary.main" } }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleImportClick}>
              <ListItemText
                primary={t("Import dataset")}
                slotProps={{ primary: { color: "primary.main" } }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>
      <Card
        elevation={0}
        sx={{ borderRadius: isMobile ? 3 : undefined, minWidth: "260px" }}
      >
        <List disablePadding>
          {datasets === null
            ? null
            : datasets.map((dataset) => (
                <ListItem key={dataset.name} disablePadding>
                  <ListItemButton
                    selected={dataset === selectedDataset}
                    sx={{ borderRadius: isMobile ? undefined : 2 }}
                    onClick={() => {
                      setSelectedDataset(dataset);
                      readDatasetText(dataset.name).then(
                        setSelectedDatasetContent
                      );
                    }}
                    onDoubleClick={
                      isMobile
                        ? undefined
                        : () =>
                            openDatasetEditor(dataset.name, async () => {
                              if (!selectedDataset) return;
                              const datasetContent = await readDatasetText(
                                dataset.name
                              );
                              setSelectedDatasetContent(datasetContent);
                            })
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedDataset(dataset);
                      setAnchorEl(event.currentTarget);
                    }}
                  >
                    <ListItemText
                      primary={dataset.name}
                      slotProps={{ primary: { noWrap: true } }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
        </List>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ list: { sx: { minWidth: "160px" } } }}
      >
        <MenuItem
          onClick={async () => {
            if (!selectedDataset) return;
            openDatasetEditor(selectedDataset.name);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("Edit")} />
        </MenuItem>
        <MenuItem onClick={handleCopyClick}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("Copy")} />
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (!selectedDataset) return;
            await exportDataset(selectedDataset.name);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <OutputIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("Export")} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary={t("Delete")}
            slotProps={{ primary: { color: "error" } }}
          />
        </MenuItem>
      </Menu>
    </Stack>
  );

  const highlightedYaml =
    selectedDatasetContent === null ? null : (
      <SyntaxHighlighter
        children={selectedDatasetContent}
        language="yaml"
        wrapLongLines={true}
        customStyle={{ margin: 0, backgroundColor: "inherit" }}
      />
    );

  return (
    <>
      {isMobile ? (
        highlightedYaml ? (
          <Stack sx={{ backgroundColor: "background.paper", minHeight: 0 }}>
            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    setSelectedDataset(undefined);
                    setSelectedDatasetContent(null);
                  }}
                  disableTouchRipple
                  disableRipple
                >
                  <ListItemText primary={selectedDataset?.name} />
                  <ExpandLessIcon />
                </ListItemButton>
              </ListItem>
            </List>
            <Divider />
            {highlightedYaml}
          </Stack>
        ) : (
          <Box sx={{ padding: 2 }}>{datasetList}</Box>
        )
      ) : (
        <Stack
          sx={{
            flexDirection: { xs: "column", sm: "row" },
            width: "100%",
            height: "100%",
          }}
          divider={<Divider orientation="vertical" />}
        >
          <Box sx={{ paddingX: 2, paddingY: 1 }}>{datasetList}</Box>

          <Box sx={{ padding: 2, flexGrow: 1 }}>
            {highlightedYaml && selectedDataset && (
              <Stack spacing={2} sx={{ height: "100%" }}>
                <Card
                  variant="outlined"
                  sx={{ flexGrow: 1, padding: 1, overflowY: "auto" }}
                >
                  {highlightedYaml}
                </Card>
                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                  {selectedDataset.name}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    rowGap: 1,
                    columnGap: 4,
                    "&>*": { minHeight: "32px", alignContent: "center" },
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t("Size")}
                  </Typography>
                  <Typography variant="body2">
                    {selectedDataset.size.toLocaleString()} bytes
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {t("Last Modified")}
                  </Typography>
                  <Typography variant="body2">
                    {new Date(selectedDataset.lastModified).toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </>
  );
}

export default DatasetsPanel;
