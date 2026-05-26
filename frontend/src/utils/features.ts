export type StudioFeatureKey =
  | "dashboard"
  | "users"
  | "organizations"
  | "teams"
  | "sessions"
  | "events"
  | "database"
  | "emails"
  | "tools"
  | "settings"
  | "serviceCredentials";

type StudioFeatureFlags = Partial<Record<StudioFeatureKey, boolean>>;

function getStudioConfig() {
  return (window as any).__STUDIO_CONFIG__ || {};
}

export function getStudioFeatureFlags(): StudioFeatureFlags {
  const config = getStudioConfig();
  return {
    ...(config.metadata?.features || {}),
    ...(config.features || {}),
  };
}

export function isStudioFeatureEnabled(feature: StudioFeatureKey): boolean {
  const config = getStudioConfig();
  const flags = getStudioFeatureFlags();

  if (typeof flags[feature] === "boolean") {
    return flags[feature] === true;
  }

  if (feature === "serviceCredentials") {
    return config.serviceCredentials?.enabled === true;
  }

  return true;
}
