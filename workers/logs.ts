import { Hono } from "hono";

const logsApp = new Hono();

logsApp.get("/:log_id/request", (c) => {
  const logId = c.req.param("log_id");
  const accountId = c.req.query("accountId");
  const gatewayId = c.req.query("gatewayId");
  const authHeader = c.req.header("Authorization");

  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs/${logId}/request`,
    { headers: { Authorization: authHeader as string } }
  );
});

logsApp.get("/:log_id/response", (c) => {
  const logId = c.req.param("log_id");
  const accountId = c.req.query("accountId");
  const gatewayId = c.req.query("gatewayId");
  const authHeader = c.req.header("Authorization");

  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs/${logId}/response`,
    { headers: { Authorization: authHeader as string } }
  );
});

export default logsApp;
