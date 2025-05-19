import {
  ExpandLess as ExpandLessIcon,
  ImageSearch as ImageSearchIcon,
  QueryStats as QueryStatsIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import {
  Chip,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function SearchModeChip({
  value,
  onChange,
}: {
  value: "webpage" | "image" | "deep-research" | undefined;
  onChange: (value: "webpage" | "image" | "deep-research" | undefined) => void;
}) {
  const [savedValue, setSavedValue] = useState<
    "webpage" | "image" | "deep-research"
  >("webpage");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (value) {
      setSavedValue(value);
    }
  }, [value]);

  return (
    <>
      <Chip
        ref={ref}
        label={
          savedValue === "image"
            ? t("Image Search")
            : savedValue === "deep-research"
            ? t("Deep Research")
            : t("Webpage Search")
        }
        icon={
          savedValue === "image" ? (
            <ImageSearchIcon fontSize="small" />
          ) : savedValue === "deep-research" ? (
            <QueryStatsIcon fontSize="small" />
          ) : (
            <SearchIcon fontSize="small" />
          )
        }
        color={value ? "primary" : "default"}
        onClick={() => onChange(value === undefined ? savedValue : undefined)}
        onDelete={() => setAnchorEl(ref.current!)}
        deleteIcon={<ExpandLessIcon />}
      />

      <Menu
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
      >
        <MenuItem
          selected={value === "webpage"}
          onClick={() => {
            onChange("webpage");
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <SearchIcon />
          </ListItemIcon>
          <ListItemText primary={t("Webpage Search")}></ListItemText>
        </MenuItem>
        <MenuItem
          selected={value === "image"}
          onClick={() => {
            onChange("image");
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <ImageSearchIcon />
          </ListItemIcon>
          <ListItemText primary={t("Image Search")}></ListItemText>
        </MenuItem>
        <MenuItem
          selected={value === "deep-research"}
          onClick={() => {
            onChange("deep-research");
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <QueryStatsIcon />
          </ListItemIcon>
          <ListItemText primary={t("Deep Research")}></ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default SearchModeChip;
