import type { StudioConfig } from "../types/handler.js";

export function injectStudioConfig(html: string, config: StudioConfig): string {
  const configuredMetadata = config.metadata || {};
  const metadata = {
    title: "Better Auth Studio",
    logo: "",
    favicon: "",
    theme: "dark",
    customStyles: "",
    ...configuredMetadata,
    company: {
      name: "",
      website: "",
      ...configuredMetadata.company,
    },
  };
  const frontendConfig = {
    basePath: config.basePath || "",
    authMode: config.authMode,
    metadata,
    features: config.features,
    serviceCredentials: config.serviceCredentials
      ? { enabled: config.serviceCredentials.enabled !== false }
      : undefined,
  };
  const safeJson = JSON.stringify(frontendConfig)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const escapedTitle = metadata.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const script = `
    <script>
      const __BAS_THEME_KEY__ = "better-auth-studio-theme";
      window.__STUDIO_CONFIG__ = ${safeJson};
      Object.freeze(window.__STUDIO_CONFIG__);
      try {
        const configuredTheme = window.__STUDIO_CONFIG__?.metadata?.theme === "light" ? "light" : "dark";
        const storedTheme = window.localStorage.getItem(__BAS_THEME_KEY__);
        const activeTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : configuredTheme;
        document.documentElement.dataset.theme = activeTheme;
        document.documentElement.style.colorScheme = activeTheme;
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(activeTheme);
      } catch {
        document.documentElement.dataset.theme = window.__STUDIO_CONFIG__?.metadata?.theme === "light" ? "light" : "dark";
        document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(document.documentElement.dataset.theme);
      }
      if (window.__STUDIO_CONFIG__?.metadata?.title) {
        document.title = window.__STUDIO_CONFIG__.metadata.title;
      }
    </script>
  `;

  return html
    .replace(/<title>.*?<\/title>/i, `<title>${escapedTitle}</title>`)
    .replace("</head>", `${script}</head>`);
}
