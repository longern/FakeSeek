import { Box, styled } from "@mui/material";

const MessageHeader = styled(Box)(({ theme }) => ({
  paddingLeft: theme.spacing(1.2),
  paddingRight: theme.spacing(1.2),
  [theme.breakpoints.up("sm")]: { paddingLeft: theme.spacing(2) },
  paddingTop: theme.spacing(0.8),
  paddingBottom: theme.spacing(0.8),
  position: "sticky",
  top: 0,
  borderBottom: `1px solid ${theme.palette.divider}`,
  borderTopLeftRadius: "12px",
  borderTopRightRadius: "12px",
  backgroundColor: theme.palette.background.paper,
  zIndex: 1,
}));

export default MessageHeader;
