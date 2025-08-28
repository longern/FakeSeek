import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import {
  Dialog,
  Toolbar,
  IconButton,
  Box,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  useMediaQuery,
} from "@mui/material";

import { ChatMessage } from "../app/messages";
import { useTranslation } from "react-i18next";

function CoachingDialog({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();

  if (!message) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { backgroundColor: "background.default" } } }}
    >
      <Toolbar
        disableGutters
        sx={{
          position: "sticky",
          top: 0,
          borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
          zIndex: 1,
        }}
      >
        <IconButton aria-label="Close" size="large" onClick={onClose}>
          <NavigateBeforeIcon />
        </IconButton>
        <Typography
          variant="subtitle1"
          component="div"
          sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
        >
          {t("Coaching Feedback")}
        </Typography>
        <Box sx={{ width: 48 }} />
      </Toolbar>
      <DialogContent dividers>
        <Typography></Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CoachingDialog;
