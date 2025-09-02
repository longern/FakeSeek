import {
  AutoAwesome as AutoAwesomeIcon,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PresetsDialog from "./PresetsDialog";

function SearchModeChip({
  value,
  onChange,
  onMenuClose,
}: {
  value: "auto" | "webpage" | "image" | "deep-research" | undefined;
  onChange: (
    value: "auto" | "webpage" | "image" | "deep-research" | undefined
  ) => void;
  onMenuClose?: () => void;
}) {
  const [showPresets, setShowPresets] = useState(false);
  const [savedValue, setSavedValue] = useState<
    "auto" | "webpage" | "image" | "deep-research"
  >("auto");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    onMenuClose?.();
  }, [onMenuClose]);

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
            : savedValue === "webpage"
            ? t("Webpage Search")
            : t("Auto Search")
        }
        icon={
          savedValue === "image" ? (
            <ImageSearchIcon fontSize="small" />
          ) : savedValue === "deep-research" ? (
            <QueryStatsIcon fontSize="small" />
          ) : savedValue === "webpage" ? (
            <SearchIcon fontSize="small" />
          ) : (
            <AutoAwesomeIcon fontSize="small" />
          )
        }
        color={value ? "primary" : "default"}
        onClick={() => onChange(value === undefined ? savedValue : undefined)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") setAnchorEl(ref.current!);
        }}
        onDelete={() => setAnchorEl(ref.current!)}
        deleteIcon={<ExpandLessIcon />}
        sx={{
          "&>.MuiChip-deleteIcon": {
            fontSize: "32px",
            padding: "5px",
            marginRight: 0,
            borderLeft: "1px solid rgba(0, 0, 0, 0.12)",
            borderTopRightRadius: "9999px",
            borderBottomRightRadius: "9999px",
          },
        }}
      />

      <Menu
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorEl={anchorEl}
      >
        <MenuItem
          selected={value === "auto"}
          onClick={() => {
            onChange("auto");
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <AutoAwesomeIcon />
          </ListItemIcon>
          <ListItemText primary={t("Auto Search")}></ListItemText>
        </MenuItem>
        <MenuItem
          selected={value === "webpage"}
          onClick={() => {
            onChange("webpage");
            handleMenuClose();
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
            handleMenuClose();
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
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <QueryStatsIcon />
          </ListItemIcon>
          <ListItemText primary={t("Deep Research")}></ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setShowPresets(true);
            handleMenuClose();
          }}
        >
          <ListItemIcon></ListItemIcon>
          <ListItemText primary={t("More presets...")}></ListItemText>
        </MenuItem>
      </Menu>

      <PresetsDialog open={showPresets} onClose={() => setShowPresets(false)} />
    </>
  );
}

export default SearchModeChip;
