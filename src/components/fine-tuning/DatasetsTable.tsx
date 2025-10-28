import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { DatasetFile } from "./DatasetsPanel";
import { formatBytes } from "./utils";

function DatasetsTable({
  datasets,
  selected,
  setSelected,
}: {
  datasets: DatasetFile[] | null;
  selected: string | null;
  setSelected: (name: string) => void;
}) {
  const { t } = useTranslation("fineTuning");

  return (
    <Table>
      <TableHead
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: "background.paper",
          zIndex: 1,
        }}
      >
        <TableRow>
          <TableCell>{t("Name")}</TableCell>
          <TableCell>{t("Size")}</TableCell>
          <TableCell>{t("Last modified")}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {datasets?.map((dataset) => (
          <TableRow
            key={dataset.name}
            hover
            selected={selected === dataset.name}
            onClick={() => setSelected(dataset.name)}
            sx={{ cursor: "pointer" }}
          >
            <TableCell>{dataset.name}</TableCell>
            <TableCell>{formatBytes(dataset.size)}</TableCell>
            <TableCell>
              {new Date(dataset.lastModified).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default DatasetsTable;
