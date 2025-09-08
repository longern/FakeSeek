import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Box,
  Card,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ElementType, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Transition } from "react-transition-group";

import DatasetsPanel from "./DatasetsPanel";

function EvalsPanel() {
  return null;
}

function DesktopLayout({
  TabsComponent,
  panel,
  onClose,
}: {
  TabsComponent: ElementType<{ onTabClick?: () => void }>;
  panel: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Stack direction="row" sx={{ height: "100%" }}>
      <Stack
        sx={{
          width: "260px",
          flexShrink: 0,
          padding: 1,
          backgroundColor: "#f9fbff",
        }}
      >
        <Box sx={{ paddingBottom: 1 }}>
          <IconButton aria-label="Close" size="small" onClick={onClose}>
            <NavigateBeforeIcon />
          </IconButton>
        </Box>
        <TabsComponent />
      </Stack>
      {panel}
    </Stack>
  );
}

function MobileLayout({
  TabsComponent,
  panel,
  panelTitle,
  onClose,
}: {
  TabsComponent: ElementType<{ onTabClick?: () => void }>;
  panel: React.ReactNode;
  panelTitle?: string;
  onClose: () => void;
}) {
  const [showPanel, setShowPanel] = useState(false);
  const nodeRef = useRef(null);
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Transition
        nodeRef={nodeRef}
        in={showPanel}
        timeout={theme.transitions.duration.enteringScreen}
      >
        {(state) => (
          <Box
            ref={nodeRef}
            sx={{
              display: "flex",
              width: "200%",
              height: "100%",
              position: "relative",
              left: state === "entering" || state === "entered" ? "-100%" : 0,
              transition: `left ${theme.transitions.duration.enteringScreen}ms ease-in-out`,
            }}
          >
            <Stack
              sx={{
                flex: 1,
                height: "100%",
                backgroundColor: "background.default",
              }}
            >
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
              <Divider />
              <DialogContent sx={{ padding: 2 }}>
                <TabsComponent onTabClick={() => setShowPanel(true)} />
              </DialogContent>
            </Stack>
            <Stack
              sx={{
                flex: 1,
                height: "100%",
                backgroundColor: "background.default",
              }}
            >
              <Toolbar disableGutters>
                <IconButton
                  aria-label="Back"
                  size="large"
                  onClick={() => setShowPanel(false)}
                >
                  <NavigateBeforeIcon />
                </IconButton>
                <Typography
                  variant="subtitle1"
                  component="div"
                  sx={{ flexGrow: 1, textAlign: "center", userSelect: "none" }}
                >
                  {panelTitle}
                </Typography>
                <Box sx={{ width: 48 }} />
              </Toolbar>
              <Divider />
              {panel}
            </Stack>
          </Box>
        )}
      </Transition>
    </Box>
  );
}

function CoachingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  const tabsMapping = {
    "coaching-datasets": t("Coaching datasets"),
    "fine-tuning": t("Fine-tuning"),
    serving: t("Serving"),
    evals: t("Evals"),
  };

  const [currentTab, setCurrentTab] = useState(
    Object.keys(tabsMapping)[0] as keyof typeof tabsMapping
  );

  const TabsComponent = useMemo(
    () =>
      ({ onTabClick }: { onTabClick?: () => void }) =>
        (
          <Card elevation={0} sx={{ borderRadius: 3 }}>
            <List
              disablePadding
              sx={{
                "& .MuiListItemButton-root": {
                  minHeight: isMobile ? "60px" : undefined,
                },
                "& .MuiListItemButton-root.Mui-selected": {
                  backgroundColor: "#dbeafe",
                },
              }}
            >
              {Object.entries(tabsMapping).map(([slug, verbose]) => (
                <ListItem key={slug} disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setCurrentTab(slug as keyof typeof tabsMapping);
                      onTabClick?.();
                    }}
                    selected={isMobile ? false : currentTab === slug}
                  >
                    <ListItemText primary={verbose} />
                    <NavigateNextIcon />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Card>
        ),
    [currentTab, tabsMapping]
  );

  const panel = !open ? null : currentTab === "coaching-datasets" ? (
    <DatasetsPanel />
  ) : currentTab === "evals" ? (
    <EvalsPanel />
  ) : null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      {isMobile ? (
        <MobileLayout
          TabsComponent={TabsComponent}
          panel={panel}
          panelTitle={tabsMapping[currentTab]}
          onClose={onClose}
        />
      ) : (
        <DesktopLayout
          TabsComponent={TabsComponent}
          panel={panel}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

export default CoachingDialog;
