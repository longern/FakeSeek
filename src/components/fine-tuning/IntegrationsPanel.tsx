import {
  Card,
  Container,
  List,
  ListItem,
  Paper,
  Typography,
} from "@mui/material";
import StyledTextField from "../presets/StyledTextField";
import { useState } from "react";

function IntegrationsPanel() {
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareApiKey, setCloudflareApiKey] = useState("");

  return (
    <Paper elevation={0} sx={{ height: "100%", borderRadius: 0 }}>
      <Container maxWidth="md" sx={{ paddingY: 2 }}>
        <Typography variant="body2" gutterBottom>
          Cloudflare AI Gateway
        </Typography>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <List disablePadding>
            <ListItem>
              <StyledTextField
                id="cloudflare-account-id"
                label="Account ID"
                value={cloudflareAccountId}
                onChange={(e) => setCloudflareAccountId(e.target.value)}
              />
            </ListItem>
            <ListItem>
              <StyledTextField
                id="cloudflare-api-key"
                label="API Key"
                value={cloudflareApiKey}
                onChange={(e) => setCloudflareApiKey(e.target.value)}
              />
            </ListItem>
          </List>
        </Card>
      </Container>
    </Paper>
  );
}

export default IntegrationsPanel;
