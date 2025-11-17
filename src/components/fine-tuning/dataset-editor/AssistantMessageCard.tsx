import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Card,
  IconButton,
  Stack,
  ToggleButton,
  Typography,
} from "@mui/material";
import React, { Activity, useState } from "react";
import { useTranslation } from "react-i18next";

import MessageHeader from "./MessageHeader";
import TextToggleButtonGroup from "./TextToggleButtonGroup";

type ViewerProps = ({
  setActions,
}: {
  open: boolean;
  setActions: React.Dispatch<
    React.SetStateAction<{ render: () => React.ReactNode }>
  >;
}) => React.ReactNode;

function AssistantMessageCard({
  viewers,
  viewersDisabled,
  role,
  onDelete,
}: {
  viewers: {
    markdown?: ViewerProps;
    raw?: ViewerProps;
    tokens?: ViewerProps;
  };
  viewersDisabled?: Array<"markdown" | "raw" | "tokens">;
  role?: string;
  onDelete?: () => void;
}) {
  const [viewer, setViewer] = useState<"markdown" | "raw" | "tokens">(
    "markdown"
  );
  const [actions, setActions] = useState<{ render: () => React.ReactNode }>({
    render: () => null,
  });

  const { t } = useTranslation("fineTuning");

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "visible" }}>
      <MessageHeader>
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
            {role || "assistant"}
          </Typography>
          <TextToggleButtonGroup
            size="small"
            value={viewer}
            exclusive
            onChange={(_, v) => {
              if (v) setViewer(v);
            }}
            sx={{ marginLeft: 1.5 }}
          >
            <ToggleButton value="markdown">MD</ToggleButton>
            <ToggleButton value="raw">Raw</ToggleButton>
            <ToggleButton
              value="tokens"
              disabled={viewersDisabled?.includes("tokens")}
            >
              Tok
            </ToggleButton>
          </TextToggleButtonGroup>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            {actions.render()}

            <IconButton
              size="small"
              aria-label={t("Delete assistant message")}
              onClick={() => {
                const confirmed = window.confirm(
                  t("confirm-delete-assistant-message")
                );
                if (!confirmed) return;
                onDelete?.();
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </MessageHeader>

      <Box
        sx={{
          paddingX: 2,
          paddingTop: 1,
          paddingBottom: 2,
          overflowWrap: "break-word",
        }}
      >
        <Activity mode={viewer === "raw" ? "visible" : "hidden"}>
          {viewers.raw?.({ open: viewer === "raw", setActions })}
        </Activity>

        <Activity mode={viewer === "tokens" ? "visible" : "hidden"}>
          {viewers.tokens?.({ open: viewer === "raw", setActions })}
        </Activity>

        <Activity mode={viewer === "markdown" ? "visible" : "hidden"}>
          {viewers.markdown?.({ open: viewer === "raw", setActions })}
        </Activity>
      </Box>
    </Card>
  );
}

export default AssistantMessageCard;
