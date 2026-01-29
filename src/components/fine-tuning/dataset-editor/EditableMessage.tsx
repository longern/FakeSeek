import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, InputBase, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import MessageHeader from "./MessageHeader";

type Content =
  | string
  | Array<{ type: "text"; text: string } | { type: "image"; image: string }>;

function EditableMessage({
  role,
  content,
  readonly,
  stickyHeader,
  onChange,
  onDelete,
}: {
  role: string;
  content: Content;
  readonly?: boolean;
  stickyHeader?: boolean;
  onChange?: (newContent: Content) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const { t } = useTranslation("fineTuning");

  useEffect(() => {
    setValue(content);
  }, [content]);

  return (
    <Box>
      <MessageHeader sx={{ position: stickyHeader ? "sticky" : "static" }}>
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {role}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5}>
            {!readonly && (
              <IconButton
                ref={editButtonRef}
                aria-label={editing ? t("Save") : t("Edit")}
                size="small"
                color={editing ? "primary" : "default"}
                sx={{ marginTop: -1, marginRight: -1 }}
                onClick={() => {
                  if (editing) {
                    setEditing(false);
                    if (value !== content) onChange?.(value);
                  } else {
                    setEditing(true);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                size="small"
                aria-label={t("Delete message")}
                onClick={() => {
                  const confirmed = window.confirm(t("confirm-delete-message"));
                  if (!confirmed) return;
                  onDelete();
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Stack>
      </MessageHeader>

      {typeof content === "string" ? (
        <InputBase
          inputRef={inputRef}
          multiline
          readOnly={!editing}
          minRows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(event) => {
            if (event.relatedTarget === editButtonRef.current) return;
            if (editing && value !== content) onChange?.(value);
            setEditing(false);
          }}
          fullWidth
          sx={{ paddingX: 2, paddingTop: 1, paddingBottom: 2 }}
        />
      ) : (
        <Box sx={{ paddingX: 2, paddingTop: 1, paddingBottom: 2 }}>
          {content.map((part, i) =>
            part.type === "text" ? (
              <Typography
                key={i}
                variant="body1"
                component="div"
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {part.text}
              </Typography>
            ) : part.type === "image" ? (
              <Box
                key={i}
                component="img"
                src={part.image}
                alt=""
                sx={{ maxWidth: "100%" }}
              />
            ) : null
          )}
        </Box>
      )}
    </Box>
  );
}

export default EditableMessage;
