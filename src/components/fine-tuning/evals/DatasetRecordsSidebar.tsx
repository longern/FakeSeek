import {
  Box,
  Fade,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Slide,
} from "@mui/material";
import type { DatasetRecord } from "../dataset-editor/DatasetRecordEditor";

function DatasetRecordsSidebar({
  in: open,
  onClose,
  absolute,
  records,
  selectedRecordIndex,
  setSelectedRecordIndex,
}: {
  in: boolean;
  onClose?: () => void;
  absolute: boolean;
  records: DatasetRecord[] | null;
  selectedRecordIndex: number;
  setSelectedRecordIndex: (index: number) => void;
}) {
  return (
    <>
      <Slide in={open} appear={false} direction="right" timeout={300}>
        <Box
          sx={{
            width: "240px",
            flexShrink: 0,
            overflowY: "auto",
            position: absolute ? "absolute" : "static",
            backgroundColor: "background.paper",
            height: "100%",
            top: 0,
            left: 0,
            zIndex: 3,
          }}
        >
          <List disablePadding>
            {records?.map((_, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  selected={index === selectedRecordIndex}
                  onClick={() => {
                    setSelectedRecordIndex(index);
                    onClose?.();
                  }}
                >
                  <ListItemText primary={`#${index + 1}`} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Slide>

      <Fade in={open && absolute} appear={false} timeout={300}>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 2,
          }}
          onClick={onClose}
        />
      </Fade>
    </>
  );
}

export default DatasetRecordsSidebar;
