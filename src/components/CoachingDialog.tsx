import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import {
  Dialog,
  Toolbar,
  IconButton,
  Box,
  DialogContent,
  Typography,
  DialogTitle,
  Card,
  CardContent,
  Container,
} from "@mui/material";

import { ChatMessage } from "../app/messages";
import { useTranslation } from "react-i18next";
import { MessageItem } from "./MessageList";

function CoachingDialog({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}) {
  const { t } = useTranslation();

  if (!message) return null;

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
            <CardContent>
              <MessageItem message={message} />
            </CardContent>
          </Card>
        </Container>
      </DialogContent>
    </Dialog>
  );
}

export default CoachingDialog;
