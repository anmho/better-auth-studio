import { readFile, writeFile } from "node:fs/promises";
import { injectStudioConfig } from "../dist/utils/html-injector.js";

const indexPath = new URL("../public/index.html", import.meta.url);
const html = await readFile(indexPath, "utf8");

const configured = injectStudioConfig(html, {
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
  serviceCredentials: {
    enabled: true,
    request: async () => ({ status: 501 }),
  },
});

await writeFile(indexPath, configured);
