import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import {
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
} from "@mui/material";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Conversation,
  remove as removeConversation,
  update as updateConversation,
} from "../app/conversations";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import ConversationList from "./ConversationList";
import SettingsDialog from "./SettingsDialog";
import { ErrorBoundary } from "./fine-tuning/utils";

const addCommentIcon = (
  <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
);
const FineTuningDialog = lazy(() => import("./fine-tuning/FineTuningDialog"));

function AppDrawer({
  open,
  onClose,
  selectedConversation,
  onConversationChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedConversation: string | null;
  onConversationChange: (conversation: Conversation | null) => void;
}) {
  const conversations = useAppSelector(
    (state) => state.conversations.conversations
  );
  const currentPresetId = useAppSelector((state) => state.presets.current);
  const dispatch = useAppDispatch();
  const [showFineTuningDialog, setShowFineTuningDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  return (
    <>
      <Drawer
        component="nav"
        variant={isMobile ? "temporary" : "permanent"}
        open={open}
        anchor="left"
        sx={{
          [`& .MuiDrawer-paper`]: {
            width: isMobile ? "300px" : "260px",
            position: isMobile ? "fixed" : "relative",
            backgroundColor: "#f9fbff",
            borderRight: "none",
          },
        }}
        onClose={onClose}
      >
        {!isMobile && (
          <Box sx={{ padding: 2 }}>
            <Button
              variant="contained"
              sx={{
                width: "100%",
                height: "40px",
                borderRadius: "9999px",
                backgroundColor: "white",
                color: "black",
              }}
              onClick={() => onConversationChange(null)}
              startIcon={addCommentIcon}
            >
              {t("start-a-new-chat")}
            </Button>
          </Box>
        )}
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelect={onConversationChange}
          onRename={(conversation) => {
            const title = window.prompt(t("Rename"), conversation.title);
            if (!title) return;
            dispatch(
              updateConversation({ id: conversation.id, patch: { title } })
            );
          }}
          onDelete={(conversation) => {
            const message = `${t("delete-chat")}\n${conversation.title}`;
            if (!window.confirm(message)) return;
            dispatch(removeConversation(conversation.id));
            if (conversation.id === selectedConversation)
              onConversationChange(null);
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <Box sx={{ padding: 1 }}>
          <List
            disablePadding
            sx={{
              borderRadius: 1,
              overflow: "hidden",
              "& .MuiListItemButton-root": { borderRadius: 2 },
            }}
          >
            <ListItem disablePadding>
              <ListItemButton
                disabled={!currentPresetId}
                onClick={() => {
                  setShowFineTuningDialog(true);
                  onClose();
                }}
              >
                <ListItemText
                  primary={t("Fine-tuning", { ns: "fineTuning" })}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => setShowSettingsDialog(true)}>
                <ListItemText primary={t("Settings")} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <ErrorBoundary>
        <Suspense>
          <FineTuningDialog
            open={showFineTuningDialog}
            onClose={() => {
              if (!navigator.storage || !navigator.storage.getDirectory) {
                window.alert(t("opfs-not-supported"));
                return;
              }

              setShowFineTuningDialog(false);
            }}
          />
        </Suspense>
      </ErrorBoundary>

      <SettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />
    </>
  );
}

export default AppDrawer;
