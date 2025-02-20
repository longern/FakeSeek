import DeleteIcon from "@mui/icons-material/Delete";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { useState } from "react";

import { ChatMessage } from "./MessageList";

export interface Conversation {
  id: string;
  title: string;
  create_time: number;
  messages: ChatMessage[];
}

function ConversationList({
  conversations,
  selectedConversation,
  onSelect,
  onDelete,
}: {
  conversations: Record<string, Conversation>;
  selectedConversation: string | null;
  onSelect: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuConversation, setMenuConversation] = useState<Conversation | null>(
    null
  );

  return (
    <>
      <List>
        {Object.values(conversations).map((conversation) => (
          <ListItem
            disablePadding
            key={conversation.id}
            secondaryAction={
              <IconButton
                onClick={(e) => {
                  setAnchorEl(e.currentTarget);
                  setMenuConversation(conversation);
                }}
              >
                <MoreHorizIcon />
              </IconButton>
            }
          >
            <ListItemButton
              selected={conversation.id === selectedConversation}
              sx={{ minHeight: "48px" }}
              onClick={() => onSelect(conversation)}
            >
              {conversation.title}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setMenuConversation(null);
        }}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setMenuConversation(null);
            onDelete(menuConversation!);
          }}
        >
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText
            sx={{ color: "error.main" }}
            primary="Delete"
          ></ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default ConversationList;
