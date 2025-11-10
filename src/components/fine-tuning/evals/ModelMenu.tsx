import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  SxProps,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function ModelMenu({
  models,
  onChange,
  sx,
}: {
  models: string[] | null;
  onChange: (model: string) => void;
  sx?: SxProps;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { t } = useTranslation("fineTuning");

  return (
    <>
      <IconButton
        size="small"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={sx}
      >
        <ArrowDropDownIcon />
      </IconButton>

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {models === null ? (
          <MenuItem
            disabled
            sx={{ minWidth: "120px", justifyContent: "center" }}
          >
            <CircularProgress size={24} />
          </MenuItem>
        ) : models.length === 0 ? (
          <MenuItem disabled>{t("No data")}</MenuItem>
        ) : (
          models.map((model) => (
            <MenuItem
              key={model}
              value={model}
              onClick={() => {
                onChange(model);
                setAnchorEl(null);
              }}
            >
              {model}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

export default ModelMenu;
