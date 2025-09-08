import {
  Box,
  Card,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  useMediaQuery,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SyntaxHighlighter from "react-syntax-highlighter";
import yaml from "yaml";

async function getDatasetDirectoryHandle() {
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

async function listDatasets() {
  const datasetDirHandle = await getDatasetDirectoryHandle();

  const datasets = [];
  for await (const key of datasetDirHandle.keys()) datasets.push(key);

  return datasets;
}

async function readDataset(name: string) {
  const datasetDirHandle = await getDatasetDirectoryHandle();
  const fileHandle = await datasetDirHandle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
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

export function parseDataset(content: string): {
  messages: Array<{ role: string; content: string }>;
  teacher_messages: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  output: Array<{ role: string; content: string }>;
} {
  return yaml.parse(content);
}

function DatasetsPanel() {
  const [datasets, setDatasets] = useState<string[] | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [selectedDatasetContent, setSelectedDatasetContent] = useState<
    string | null
  >(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.jsonl,.yaml,.yml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

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
      } else return;

      const importName = file.name.replace(/\.(jsonl|json|yaml|yml)$/, ".yml");

      const datasetDirHandle = await getDatasetDirectoryHandle();
      const destHandle = await datasetDirHandle.getFileHandle(importName, {
        create: true,
      });
      const writable = await destHandle.createWritable();
      await writable.write(yaml.stringify(records));
      await writable.close();
    };
    input.click();
  }, []);

  useEffect(() => {
    listDatasets().then(setDatasets);
  }, []);

  useEffect(() => {
    if (!selectedDataset) {
      setSelectedDatasetContent(null);
      return;
    }
    readDataset(selectedDataset).then(setSelectedDatasetContent);
  }, [selectedDataset]);

  const datasetList = (
    <Stack gap={1.5}>
      <Card elevation={0} sx={{ borderRadius: 3, minWidth: "260px" }}>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton onClick={handleImportClick}>
              <ListItemText
                primary={t("Import datasets")}
                slotProps={{ primary: { color: "primary.main" } }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>
      <Card elevation={0} sx={{ borderRadius: 3, minWidth: "260px" }}>
        <List disablePadding dense>
          {datasets === null
            ? null
            : datasets.map((dataset) => (
                <ListItem key={dataset} disablePadding>
                  <ListItemButton
                    selected={dataset === selectedDataset}
                    onClick={() => setSelectedDataset(dataset)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedDataset(dataset);
                      setAnchorEl(event.currentTarget);
                    }}
                  >
                    <ListItemText primary={dataset} />
                  </ListItemButton>
                </ListItem>
              ))}
        </List>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem>
          <ListItemText
            primary={t("Export")}
            onClick={async () => {
              if (!selectedDataset) return;
              await exportDataset(selectedDataset);
              setAnchorEl(null);
            }}
          />
        </MenuItem>
        <MenuItem>
          <ListItemText
            primary={t("Delete")}
            slotProps={{ primary: { color: "error.main" } }}
            onClick={async () => {
              if (!selectedDataset) return;
              if (
                !window.confirm(
                  t("confirm-delete-dataset", { name: selectedDataset })
                )
              )
                return;
              await deleteDataset(selectedDataset);
              setDatasets(
                (prev) => prev?.filter((d) => d !== selectedDataset) ?? null
              );
              setSelectedDataset(null);
              setAnchorEl(null);
            }}
          />
        </MenuItem>
      </Menu>
    </Stack>
  );

  const highlightedYaml = selectedDatasetContent && (
    <SyntaxHighlighter
      children={selectedDatasetContent}
      language="yaml"
      customStyle={{ margin: 0, backgroundColor: "inherit" }}
    />
  );

  return isMobile ? (
    selectedDatasetContent ? (
      <Stack sx={{ backgroundColor: "background.paper", height: "100%" }}>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => setSelectedDataset(null)}
              disableTouchRipple
              disableRipple
            >
              <ListItemText primary={selectedDataset} />
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
      }}
    >
      <Box sx={{ paddingX: 2, paddingY: 1 }}>{datasetList}</Box>

      <Box sx={{ padding: 2, flexGrow: 1 }}>
        {highlightedYaml && (
          <Card variant="outlined" sx={{ height: "100%", padding: 1 }}>
            {highlightedYaml}
          </Card>
        )}
      </Box>
    </Stack>
  );
}

export default DatasetsPanel;
