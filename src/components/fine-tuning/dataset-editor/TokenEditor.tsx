import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import { Box, IconButton, InputBase, Stack, SxProps } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function TokenEditor({
  token,
  onChange,
  previousToken,
  nextToken,
  sx,
}: {
  token: string;
  onChange: (newToken: string) => void;
  previousToken?: string;
  nextToken?: string;
  sx?: SxProps;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    setEditing(false);
  }, [token]);

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      {editing ? (
        <InputBase
          name="token-editor-input"
          placeholder={token}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <Box>
          <Box component="span" sx={{ opacity: 0.2 }}>
            {previousToken}
          </Box>
          <Box component="span">{token}</Box>
          <Box component="span" sx={{ opacity: 0.2 }}>
            {nextToken}
          </Box>
        </Box>
      )}
      <IconButton
        size="small"
        aria-label={editing ? t("Save token") : t("Edit token")}
        onClick={() => {
          if (editing) value && onChange(value);
          else setValue("");
          setEditing(!editing);
        }}
      >
        {editing ? (
          <SaveIcon fontSize="small" />
        ) : (
          <EditIcon fontSize="small" />
        )}
      </IconButton>
    </Stack>
  );
}

export default TokenEditor;
