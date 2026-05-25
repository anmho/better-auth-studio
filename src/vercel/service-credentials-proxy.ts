type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  send(body: unknown): void;
};

const jsonContentType = "application/json";
const defaultAllowedHost = "auth-studio.anmho.com";

export async function handleServiceCredentialsProxy(req: VercelRequest, res: VercelResponse) {
  if (!isAllowedStudioHost(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const baseUrl = process.env.AUTH_INTERNAL_BASE_URL;
  const accessClientId = process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_ID;
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_SECRET;

  if (!baseUrl || !accessClientId || !accessClientSecret) {
    res.status(500).json({ error: "service_credentials_proxy_not_configured" });
    return;
  }

  const targetUrl = new URL(getInternalPath(req.url || "/api/service-credentials"), baseUrl);
  const method = req.method || "GET";
  const headers: Record<string, string> = {
    Accept: jsonContentType,
    "CF-Access-Client-Id": accessClientId,
    "CF-Access-Client-Secret": accessClientSecret,
  };

  const body = serializeBody(req.body, method, headers);
  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
  });

  res.status(upstream.status);
  res.setHeader("Content-Type", upstream.headers.get("content-type") || jsonContentType);
  res.send(await upstream.text());
}

export function isAllowedStudioHost(req: VercelRequest): boolean {
  const allowedHost = process.env.STUDIO_ALLOWED_HOST || defaultAllowedHost;
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  return host?.toLowerCase() === allowedHost.toLowerCase();
}

function getHeader(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getInternalPath(url: string): string {
  const parsed = new URL(url, "https://auth-studio.local");
  const prefix = "/api/service-credentials";
  const path = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) || "/" : "/";
  return `${path}${parsed.search}`;
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
