import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import {
  Box,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";

import { ChatMessage } from "../app/messages";
import MessageList from "./MessageList";

function CoachingDialog({
  open,
  onClose,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  messages: Record<string, ChatMessage> | null;
}) {
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const { t } = useTranslation();

  const UserMessageActions = useMemo(
    () =>
      ({
        message,
      }: {
        message: ResponseInputItem.Message & {
          id: string;
          object: "message";
          timestamp: number;
        };
      }) =>
        (
          <Stack
            direction="row"
            gap="4px"
            sx={{ marginTop: 1, alignItems: "center" }}
          >
            <IconButton
              aria-label="Edit"
              sx={{ width: "28px", height: "28px", borderRadius: 1 }}
              onClick={() => setEditingMessage(message)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
    []
  );

  if (!messages) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "background.default",
            overflow: "hidden", // KaTeX overflow?
          },
        },
      }}
    >
      <DialogTitle sx={{ padding: 0 }}>
        <Toolbar disableGutters>
          <IconButton aria-label="Close" size="large" onClick={onClose}>
            <NavigateBeforeIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
          >
            {t("Coach")}
          </Typography>
          <Box sx={{ width: 48 }} />
        </Toolbar>
      </DialogTitle>
      <DialogContent sx={{ paddingX: 2, paddingBottom: 2 }}>
        <Container sx={{ padding: 0 }}>
          <Card variant="outlined">
            <CardContent sx={{ "&:last-child": { paddingBottom: 2 } }}>
              <MessageList
                messages={Object.values(messages)}
                slots={{ messageActions: UserMessageActions }}
              />
            </CardContent>
          </Card>
        </Container>
      </DialogContent>
    </Dialog>
  );
}

export default CoachingDialog;
