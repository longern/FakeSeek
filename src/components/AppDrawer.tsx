import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import {
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  useMediaQuery,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Conversation,
  remove as removeConversation,
  update as updateConversation,
} from "../app/conversations";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import ConversationList from "./ConversationList";
import SettingsDialog from "./SettingsDialog";

const addCommentIcon = (
  <AddCommentOutlinedIcon sx={{ transform: "scaleX(-1)" }} />
);

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
  const dispatch = useAppDispatch();
  const [showMenu, setShowMenu] = useState(false);

  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  return (
    <>
      <Drawer
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
          <Box>
            <Button
              size="large"
              sx={{
                margin: 2,
                borderRadius: "12px",
                backgroundColor: "#dbeafe",
                "&:hover": { backgroundColor: "#c6dcf8" },
              }}
              onClick={() => onConversationChange(null)}
              startIcon={addCommentIcon}
            >
              {t("New Chat")}
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
            if (!window.confirm("Delete this chat?")) return;
            dispatch(removeConversation(conversation.id));
            if (conversation.id === selectedConversation)
              onConversationChange(null);
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ padding: 1 }}>
          <List disablePadding sx={{ borderRadius: 1, overflow: "hidden" }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => setShowMenu(true)}>
                {t("Settings")}
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <SettingsDialog open={showMenu} onClose={() => setShowMenu(false)} />
    </>
  );
}

export default AppDrawer;
