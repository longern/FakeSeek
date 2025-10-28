import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Conversation } from "../app/conversations";

function groupedConversations(conversations: Conversation[]) {
  const groups: Conversation[][] = [];
  const breakpoints = [
    new Date().setHours(0, 0, 0, 0),
    new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000,
    new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000,
    new Date().setHours(0, 0, 0, 0) - 30 * 24 * 60 * 60 * 1000,
  ];
  let group: Conversation[] = [];
  let currentGroup = 0;
  for (const conversation of conversations) {
    while (
      currentGroup < breakpoints.length &&
      conversation.created_at < breakpoints[currentGroup]
    ) {
      groups.push(group);
      group = [];
      currentGroup += 1;
    }
    group.push(conversation);
  }
  groups.push(group);

  return groups;
}

function ConversationGroup({
  group,
  name,
  selectedConversation,
  onSelect,
  menuConversation,
  onContextMenu,
}: {
  group: Conversation[];
  name: string;
  selectedConversation: string | null;
  onSelect: (conversation: Conversation) => void;
  menuConversation: Conversation | null;
  onContextMenu: ({
    anchorEl,
    conversation,
  }: {
    anchorEl: HTMLElement;
    conversation: Conversation;
  }) => void;
}) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  return (
    <>
      <ListSubheader
        sx={{
          background: "#f9fbff",
          color: "#81858c",
          lineHeight: "unset",
          fontWeight: isMobile ? "normal" : undefined,
          marginTop: 1.5,
          paddingY: 0.5,
          fontSize: { xs: undefined, sm: "12px" },
        }}
      >
        {name}
      </ListSubheader>
      {group.map((conversation) => (
        <ListItem
          disablePadding
          key={conversation.id}
          secondaryAction={
            isMobile ? null : (
              <IconButton
                edge="end"
                size="small"
                className={
                  menuConversation === conversation
                    ? "ConversationList-anchor"
                    : undefined
                }
                onClick={(e) => {
                  onContextMenu({
                    anchorEl: e.currentTarget,
                    conversation,
                  });
                }}
              >
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            )
          }
          sx={{
            "&>.MuiListItemSecondaryAction-root": {
              visibility: "hidden",
              right: "8px",
            },
            "&:hover>.MuiListItemSecondaryAction-root": {
              visibility: "visible",
            },
            "&>.Mui-selected+.MuiListItemSecondaryAction-root": {
              visibility: "visible",
            },
            "& .ConversationList-anchor": {
              visibility: "visible",
            },
          }}
        >
          <ListItemButton
            selected={conversation.id === selectedConversation}
            onClick={() => onSelect(conversation)}
            onContextMenu={(e: React.PointerEvent<HTMLDivElement>) => {
              const { nativeEvent } = e;
              if (nativeEvent.pointerType === "mouse") return;
              nativeEvent.preventDefault();
              onContextMenu({
                anchorEl: e.currentTarget,
                conversation,
              });
            }}
            sx={{
              borderRadius: 2,
              paddingY: isMobile ? undefined : 0.5,
              "&.Mui-selected": { backgroundColor: "#dbeafe" },
            }}
          >
            <ListItemText
              primary={
                <Typography
                  noWrap
                  sx={(theme) => ({
                    [theme.breakpoints.up("sm")]: { fontSize: "14px" },
                  })}
                >
                  {conversation.title}
                </Typography>
              }
            />
          </ListItemButton>
        </ListItem>
      ))}
    </>
  );
}

function ConversationList({
  conversations,
  selectedConversation,
  onSelect,
  onRename,
  onDelete,
}: {
  conversations: Record<string, Conversation>;
  selectedConversation: string | null;
  onSelect: (conversation: Conversation) => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuConversation, setMenuConversation] = useState<Conversation | null>(
    null
  );
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const { t } = useTranslation();

  return (
    <>
      <List disablePadding sx={{ overflowY: "auto", paddingX: 1 }}>
        {groupedConversations(Object.values(conversations)).map(
          (group, index) =>
            group.length ? (
              <ConversationGroup
                key={index}
                group={group}
                name={
                  index === 0
                    ? t("Today")
                    : index === 1
                    ? t("Yesterday")
                    : index === 2
                    ? t("In 7 days")
                    : index === 3
                    ? t("In 30 days")
                    : t("Older")
                }
                onContextMenu={({ anchorEl, conversation }) => {
                  setAnchorEl(anchorEl);
                  setMenuConversation(conversation);
                }}
                onSelect={onSelect}
                selectedConversation={selectedConversation}
                menuConversation={menuConversation}
              />
            ) : null
        )}
      </List>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onTransitionEnd={() => {
          if (!anchorEl) setMenuConversation(null);
        }}
        anchorOrigin={
          isMobile
            ? { vertical: "bottom", horizontal: "right" }
            : { vertical: "bottom", horizontal: "left" }
        }
        transformOrigin={
          isMobile ? { vertical: "top", horizontal: "right" } : undefined
        }
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setMenuConversation(null);
            onRename(menuConversation!);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary={t("Rename")}></ListItemText>
        </MenuItem>
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
            primary={t("Delete")}
          ></ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default ConversationList;
