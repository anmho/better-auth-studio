import { isAllowedStudioHost } from "../src/vercel/service-credentials-proxy.js";

export default function handler(_req: unknown, res: any) {
  if (!isAllowedStudioHost(_req as any)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  res.status(200).json({
    studio: { version: "1.1.3-anmho.0" },
    baseURL: "https://auth.anmho.com",
    serviceCredentials: { enabled: true },
  });
}
