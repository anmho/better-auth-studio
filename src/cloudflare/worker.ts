import { createCloudflareStudioHandler } from "../adapters/cloudflare-workers.js";
import type { ServiceCredentialsProxyRequest, StudioConfig } from "../types/handler.js";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AUTH_INTERNAL_BASE_URL?: string;
  CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_ID?: string;
  CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_SECRET?: string;
  STUDIO_ALLOWED_HOST?: string;
};

const jsonContentType = "application/json";

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const allowedHost = env.STUDIO_ALLOWED_HOST;
    if (allowedHost && new URL(request.url).host.toLowerCase() !== allowedHost.toLowerCase()) {
      return jsonResponse(403, { error: "forbidden" });
    }

    return createCloudflareStudioHandler(createStudioConfig(env), { assets: env.ASSETS })(request);
  },
};

function createStudioConfig(env: Env): StudioConfig {
  return {
    auth: undefined,
    basePath: "",
    authMode: "access",
    metadata: {
      title: "ANMHO Auth Studio",
      company: {
        name: "ANMHO",
        website: "https://anmho.com",
      },
      theme: "dark",
    },
    features: {
      dashboard: false,
      users: false,
      organizations: false,
      teams: false,
      sessions: false,
      events: false,
      database: false,
      emails: false,
      tools: false,
      settings: false,
      serviceCredentials: true,
    },
    serviceCredentials: {
      enabled: true,
      request: (request) => proxyServiceCredentialsRequest(request, env),
    },
  };
}

async function proxyServiceCredentialsRequest(
  request: ServiceCredentialsProxyRequest,
  env: Env,
) {
  const baseUrl = env.AUTH_INTERNAL_BASE_URL;
  const accessClientId = env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_ID;
  const accessClientSecret = env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_SECRET;

  if (!baseUrl || !accessClientId || !accessClientSecret) {
    return {
      status: 500,
      body: { error: "service_credentials_proxy_not_configured" },
    };
  }

  const targetUrl = buildTargetUrl(baseUrl, request.path);
  const headers: Record<string, string> = {
    Accept: jsonContentType,
    "CF-Access-Client-Id": accessClientId,
    "CF-Access-Client-Secret": accessClientSecret,
  };

  const body = serializeBody(request.body, request.method, headers);
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  return {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || jsonContentType },
    body: await parseUpstreamBody(upstream),
  };
}

export function buildTargetUrl(baseUrl: string, internalPath: string): URL {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const path = internalPath.replace(/^\/+/, "");
  return new URL(path, base);
}

function serializeBody(
  body: unknown,
  method: string,
  headers: Record<string, string>,
): string | undefined {
  if (method === "GET" || method === "HEAD" || body === undefined || body === null) {
    return undefined;
  }

  headers["Content-Type"] = jsonContentType;
  return typeof body === "string" ? body : JSON.stringify(body);
}

async function parseUpstreamBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes(jsonContentType)) return text;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": jsonContentType },
  });
}
