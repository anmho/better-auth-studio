import { describe, expect, it, vi } from "vitest";
import { handleStudioApiRequest } from "../src/routes";

describe("service credentials routes", () => {
  it("proxies service credential requests through the configured handler", async () => {
    const handler = vi.fn(async (request) => ({
      status: 200,
      body: {
        resource_servers: [
          {
            resource_server_id: "billing-api",
            stage: "prod",
            audience: "api://billing-api",
            scopes: [{ name: "read" }],
            disabled: false,
          },
        ],
        proxiedPath: request.path,
      },
    }));

    const response = await handleStudioApiRequest({
      path: "/api/service-credentials/resource-servers?include_disabled=true",
      method: "GET",
      headers: {},
      auth: {
        options: {},
      },
      studioConfig: {
        auth: {},
        authMode: "access",
        basePath: "/studio",
        serviceCredentials: {
          request: handler,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.data.resource_servers).toHaveLength(1);
    expect(response.data.proxiedPath).toBe("/resource-servers?include_disabled=true");
    expect(handler).toHaveBeenCalledWith({
      path: "/resource-servers?include_disabled=true",
      method: "GET",
      headers: {},
      ip: undefined,
      body: undefined,
    });
  });

  it("returns 404 when service credentials are not enabled", async () => {
    const response = await handleStudioApiRequest({
      path: "/api/service-credentials/resource-servers",
      method: "GET",
      headers: {},
      auth: {
        options: {},
      },
      studioConfig: {
        auth: {},
        basePath: "/studio",
      },
    });

    expect(response.status).toBe(404);
    expect(response.data.error).toBe("service_credentials_not_enabled");
  });
});
