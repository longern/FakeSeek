import { Box, Card, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTranslation } from "react-i18next";

function EvaluationPanel() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const { t } = useTranslation();
  return (
    <Card elevation={0} sx={{ height: "100%", borderRadius: 0 }}>
      <Stack sx={{ height: "100%" }}>
        <Box sx={{ padding: 2 }}>
          {!isMobile && (
            <Typography variant="h6" gutterBottom>
              {t("Evaluation")}
            </Typography>
          )}
        </Box>

        <Box sx={{ flexGrow: 1 }}></Box>
      </Stack>
    </Card>
  );
}

export default EvaluationPanel;
