import {
  Ban,
  Copy,
  KeyRound,
  Loader,
  Plus,
  RefreshCw,
  RotateCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { apiFetch } from "../utils/api";

type Stage = "prod" | "staging" | "dev";

type ResourceServer = {
  resource_server_id: string;
  stage: Stage;
  audience: string;
  scopes: Array<{ name: string; description?: string }>;
  disabled: boolean;
  created_at?: string;
  updated_at?: string;
};

type OAuthClient = {
  client_id: string;
  client_app_id: string;
  client_identity: string;
  resource_server_id: string;
  stage: Stage;
  audience?: string;
  scopes: string[];
  recommended_vault_path: string;
  revoked: boolean;
  created_at?: string;
  updated_at?: string;
};

type SecretResult = {
  client_id: string;
  client_secret: string;
  recommended_vault_path?: string;
};

const stages: Stage[] = ["prod", "staging", "dev"];

function parseScopes(value: string): Array<{ name: string; description?: string }> {
  return value
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...descriptionParts] = line.split("=");
      const description = descriptionParts.join("=").trim();
      return {
        name: name.trim(),
        ...(description ? { description } : {}),
      };
    });
}

function parseClientScopes(value: string): string[] {
  return value
    .split(/[\s,\n]/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with ${response.status}`);
  }
  return data;
}

function copyToClipboard(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Failed to copy ${label.toLowerCase()}`));
}

export default function ServiceCredentials() {
  const [activeTab, setActiveTab] = useState<"resource-servers" | "clients">("resource-servers");
  const [resourceServers, setResourceServers] = useState<ResourceServer[]>([]);
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingResource, setSavingResource] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [secretResult, setSecretResult] = useState<SecretResult | null>(null);
  const [resourceForm, setResourceForm] = useState({
    resource_server_id: "",
    stage: "prod" as Stage,
    audience: "",
    scopes: "read=Read access\nwrite=Write access",
  });
  const [clientForm, setClientForm] = useState({
    client_app_id: "",
    client_identity: "worker",
    resource_server_id: "",
    stage: "prod" as Stage,
    audience: "",
    scopes: "read",
  });

  const vaultCommand = useMemo(() => {
    if (!secretResult?.client_secret || !secretResult.recommended_vault_path) return "";
    return `vault kv put secret/${secretResult.recommended_vault_path} CLIENT_ID=${secretResult.client_id} CLIENT_SECRET=${secretResult.client_secret}`;
  }, [secretResult]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resourceData, clientData] = await Promise.all([
        apiFetch("/api/service-credentials/resource-servers?include_disabled=true").then(readJson),
        apiFetch("/api/service-credentials/oauth2/clients").then(readJson),
      ]);
      setResourceServers(resourceData.resource_servers || []);
      setClients(clientData.clients || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load service credentials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upsertResourceServer = async () => {
    const scopes = parseScopes(resourceForm.scopes);
    if (!resourceForm.resource_server_id || scopes.length === 0) {
      toast.error("Resource server ID and at least one scope are required");
      return;
    }

    setSavingResource(true);
    try {
      await readJson(
        await apiFetch(
          `/api/service-credentials/resource-servers/${resourceForm.resource_server_id}/${resourceForm.stage}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_server_id: resourceForm.resource_server_id,
              stage: resourceForm.stage,
              audience: resourceForm.audience || undefined,
              scopes,
            }),
          },
        ),
      );
      toast.success("Resource server saved");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save resource server");
    } finally {
      setSavingResource(false);
    }
  };

  const disableResourceServer = async (server: ResourceServer, force = false) => {
    try {
      await readJson(
        await apiFetch(
          `/api/service-credentials/resource-servers/${server.resource_server_id}/${server.stage}${
            force ? "?force=true" : ""
          }`,
          { method: "DELETE" },
        ),
      );
      toast.success(force ? "Resource server force-disabled" : "Resource server disabled");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disable resource server";
      if (!force && message === "has_dependents") {
        const confirmed = window.confirm(
          "This resource server has dependent clients. Force-disable it anyway?",
        );
        if (confirmed) await disableResourceServer(server, true);
        return;
      }
      toast.error(message);
    }
  };

  const createClient = async () => {
    const scopes = parseClientScopes(clientForm.scopes);
    if (
      !clientForm.client_app_id ||
      !clientForm.client_identity ||
      !clientForm.resource_server_id
    ) {
      toast.error("Client app, identity, and resource server are required");
      return;
    }
    if (scopes.length === 0) {
      toast.error("At least one scope is required");
      return;
    }

    setSavingClient(true);
    try {
      const client = await readJson(
        await apiFetch("/api/service-credentials/oauth2/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_app_id: clientForm.client_app_id,
            client_identity: clientForm.client_identity,
            resource_server_id: clientForm.resource_server_id,
            stage: clientForm.stage,
            audience: clientForm.audience || undefined,
            scopes,
          }),
        }),
      );
      if (client.client_secret) {
        setSecretResult({
          client_id: client.client_id,
          client_secret: client.client_secret,
          recommended_vault_path: client.recommended_vault_path,
        });
      }
      toast.success("Client created");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setSavingClient(false);
    }
  };

  const rotateClient = async (client: OAuthClient) => {
    try {
      const rotated = await readJson(
        await apiFetch(`/api/service-credentials/oauth2/clients/${client.client_id}/rotate`, {
          method: "POST",
        }),
      );
      if (rotated.client_secret) {
        setSecretResult({
          client_id: client.client_id,
          client_secret: rotated.client_secret,
          recommended_vault_path: client.recommended_vault_path,
        });
      }
      toast.success("Client secret rotated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate client");
    }
  };

  const revokeClient = async (client: OAuthClient) => {
    try {
      await readJson(
        await apiFetch(`/api/service-credentials/oauth2/clients/${client.client_id}/revoke`, {
          method: "POST",
        }),
      );
      toast.success("Client revoked");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke client");
    }
  };

  return (
    <div className="px-4 pb-10 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-dashed border-white/15 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-white/70" />
              <h2 className="font-mono text-lg font-light uppercase tracking-normal text-white">
                Service Credentials
              </h2>
            </div>
            <p className="mt-2 max-w-2xl font-mono text-xs uppercase leading-5 text-white/45">
              Resource servers and client credentials for machine-to-machine access.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            className="gap-2 rounded-none border-dashed font-mono uppercase"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {secretResult && (
          <Card className="rounded-none border-emerald-400/35 bg-emerald-500/5">
            <CardHeader className="flex flex-col gap-3 space-y-0 p-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 font-mono text-xs font-light uppercase text-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                  Secret available once
                </CardTitle>
                <p className="font-mono text-xs leading-5 text-white/50">
                  Store it now. It will not be returned again.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSecretResult(null)}
                className="rounded-none font-mono text-xs uppercase"
              >
                Dismiss
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                <SecretField label="Client ID" value={secretResult.client_id} />
                <SecretField label="Client Secret" value={secretResult.client_secret} />
              </div>
              {vaultCommand && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(vaultCommand, "Vault command")}
                  className="h-auto w-full justify-start rounded-none border-dashed bg-black p-3 text-left font-mono text-xs text-white/70 hover:border-white/50 hover:text-white"
                >
                  <span className="block min-w-0">
                    <span className="mb-2 block uppercase text-white/40">
                      Recommended Vault command
                    </span>
                    <span className="block break-all">{vaultCommand}</span>
                  </span>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex border border-dashed border-white/15">
          <TabButton
            active={activeTab === "resource-servers"}
            onClick={() => setActiveTab("resource-servers")}
            icon={<Server className="h-4 w-4" />}
          >
            Resource Servers
          </TabButton>
          <TabButton
            active={activeTab === "clients"}
            onClick={() => setActiveTab("clients")}
            icon={<KeyRound className="h-4 w-4" />}
          >
            Client Credentials
          </TabButton>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center border border-dashed border-white/15">
            <Loader className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : activeTab === "resource-servers" ? (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <FormPanel title="Create or Upsert Resource Server">
              <Field label="Resource Server ID">
                <Input
                  value={resourceForm.resource_server_id}
                  onChange={(event) =>
                    setResourceForm((prev) => ({
                      ...prev,
                      resource_server_id: event.target.value,
                    }))
                  }
                  placeholder="billing-api"
                  className="rounded-none font-mono"
                />
              </Field>
              <StageField
                value={resourceForm.stage}
                onChange={(stage) => setResourceForm((prev) => ({ ...prev, stage }))}
              />
              <Field label="Audience">
                <Input
                  value={resourceForm.audience}
                  onChange={(event) =>
                    setResourceForm((prev) => ({ ...prev, audience: event.target.value }))
                  }
                  placeholder="api://billing-api"
                  className="rounded-none font-mono"
                />
              </Field>
              <Field label="Scopes">
                <Textarea
                  value={resourceForm.scopes}
                  onChange={(event) =>
                    setResourceForm((prev) => ({ ...prev, scopes: event.target.value }))
                  }
                  className="min-h-28 bg-black font-mono"
                />
              </Field>
              <Button
                type="button"
                onClick={upsertResourceServer}
                disabled={savingResource}
                className="w-full gap-2 rounded-none font-mono uppercase"
              >
                {savingResource ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Save Resource Server
              </Button>
            </FormPanel>
            <ResourceServersTable
              resourceServers={resourceServers}
              onEdit={(server) =>
                setResourceForm({
                  resource_server_id: server.resource_server_id,
                  stage: server.stage,
                  audience: server.audience,
                  scopes: server.scopes
                    .map((scope) =>
                      scope.description ? `${scope.name}=${scope.description}` : scope.name,
                    )
                    .join("\n"),
                })
              }
              onDisable={disableResourceServer}
            />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <FormPanel title="Create Client Credential">
              <Field label="Client App ID">
                <Input
                  value={clientForm.client_app_id}
                  onChange={(event) =>
                    setClientForm((prev) => ({ ...prev, client_app_id: event.target.value }))
                  }
                  placeholder="billing"
                  className="rounded-none font-mono"
                />
              </Field>
              <Field label="Client Identity">
                <Input
                  value={clientForm.client_identity}
                  onChange={(event) =>
                    setClientForm((prev) => ({ ...prev, client_identity: event.target.value }))
                  }
                  placeholder="worker"
                  className="rounded-none font-mono"
                />
              </Field>
              <Field label="Resource Server ID">
                <Input
                  value={clientForm.resource_server_id}
                  onChange={(event) =>
                    setClientForm((prev) => ({ ...prev, resource_server_id: event.target.value }))
                  }
                  placeholder="billing-api"
                  className="rounded-none font-mono"
                />
              </Field>
              <StageField
                value={clientForm.stage}
                onChange={(stage) => setClientForm((prev) => ({ ...prev, stage }))}
              />
              <Field label="Audience">
                <Input
                  value={clientForm.audience}
                  onChange={(event) =>
                    setClientForm((prev) => ({ ...prev, audience: event.target.value }))
                  }
                  placeholder="api://billing-api"
                  className="rounded-none font-mono"
                />
              </Field>
              <Field label="Scopes">
                <Input
                  value={clientForm.scopes}
                  onChange={(event) =>
                    setClientForm((prev) => ({ ...prev, scopes: event.target.value }))
                  }
                  placeholder="read write"
                  className="rounded-none font-mono"
                />
              </Field>
              <Button
                type="button"
                onClick={createClient}
                disabled={savingClient}
                className="w-full gap-2 rounded-none font-mono uppercase"
              >
                {savingClient ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Client
              </Button>
            </FormPanel>
            <ClientsTable clients={clients} onRotate={rotateClient} onRevoke={revokeClient} />
          </div>
        )}
      </div>
    </div>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => copyToClipboard(value, label)}
      className="h-auto justify-start rounded-none border-dashed bg-black p-3 text-left hover:border-white/50"
    >
      <span className="block min-w-0 flex-1">
        <span className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase text-white/40">
          {label}
          <Copy className="h-3.5 w-3.5" />
        </span>
        <span className="block truncate font-mono text-xs text-white/80">{value}</span>
      </span>
    </Button>
  );
}

function TabButton({
  active,
  children,
  icon,
  onClick,
}: {
  active: boolean;
  children: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
      className={cn(
        "h-12 flex-1 rounded-none font-mono text-xs uppercase shadow-none",
        active
          ? "bg-white text-black hover:bg-white/90"
          : "text-white/55 hover:bg-white/5 hover:text-white",
      )}
    >
      {icon}
      {children}
    </Button>
  );
}

function FormPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="h-fit rounded-none border-white/15 bg-black">
      <CardHeader className="p-4 pb-0">
        <CardTitle className="font-mono text-xs font-light uppercase text-white/70">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase text-white/45">{label}</Label>
      {children}
    </div>
  );
}

function StageField({ value, onChange }: { value: Stage; onChange: (stage: Stage) => void }) {
  return (
    <Field label="Stage">
      <Select value={value} onValueChange={(stage) => onChange(stage as Stage)}>
        <SelectTrigger className="border-dashed border-white/20 bg-black font-mono text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-dashed border-white/20 bg-black font-mono uppercase text-[11px]">
          {stages.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {stage}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ResourceServersTable({
  resourceServers,
  onEdit,
  onDisable,
}: {
  resourceServers: ResourceServer[];
  onEdit: (server: ResourceServer) => void;
  onDisable: (server: ResourceServer) => void;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-dashed border-white/20 bg-black/30">
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-dashed border-white/10">
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Resource Server
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Audience
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Scopes
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Status
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {resourceServers.map((server) => (
              <tr
                key={`${server.resource_server_id}:${server.stage}`}
                className="border-b border-dashed border-white/5 font-mono text-xs transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-3 text-white">
                  {server.resource_server_id}
                  <span className="ml-2 text-white/35">[{server.stage}]</span>
                </td>
                <td className="px-3 py-3 text-white/60">{server.audience}</td>
                <td className="px-3 py-3 text-white/60">
                  {server.scopes.map((scope) => scope.name).join(", ")}
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={server.disabled ? "error" : "success"}
                    className="rounded-none border border-dashed font-mono text-[10px] font-light uppercase"
                  >
                    {server.disabled ? "Disabled" : "Active"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onEdit(server)}
                      className="h-8 rounded-none border-dashed px-2 font-mono text-[10px] uppercase"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onDisable(server)}
                      disabled={server.disabled}
                      className="h-8 gap-1 rounded-none border-dashed px-2 font-mono text-[10px] uppercase"
                    >
                      <Ban className="h-3 w-3" />
                      Disable
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {resourceServers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center font-mono text-xs uppercase text-white/35"
                >
                  No resource servers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsTable({
  clients,
  onRotate,
  onRevoke,
}: {
  clients: OAuthClient[];
  onRotate: (client: OAuthClient) => void;
  onRevoke: (client: OAuthClient) => void;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-dashed border-white/20 bg-black/30">
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-dashed border-white/10">
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Client
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Resource
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Scopes
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Vault Path
              </th>
              <th className="px-3 py-3 font-mono text-xs font-normal uppercase text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.client_id}
                className="border-b border-dashed border-white/5 font-mono text-xs transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-3 text-white">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(client.client_id, "Client ID")}
                    className="inline-flex max-w-64 items-center gap-2 truncate hover:text-white/70"
                  >
                    <span className="truncate">{client.client_id}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                  {client.revoked && (
                    <Badge
                      variant="error"
                      className="ml-2 rounded-none border border-dashed font-mono text-[10px] font-light uppercase"
                    >
                      Revoked
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-white/60">
                  {client.resource_server_id}
                  <span className="ml-2 text-white/35">[{client.stage}]</span>
                </td>
                <td className="px-3 py-3 text-white/60">{client.scopes.join(", ")}</td>
                <td className="px-3 py-3 text-white/45">{client.recommended_vault_path}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRotate(client)}
                      disabled={client.revoked}
                      className="h-8 gap-1 rounded-none border-dashed px-2 font-mono text-[10px] uppercase"
                    >
                      <RotateCw className="h-3 w-3" />
                      Rotate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRevoke(client)}
                      disabled={client.revoked}
                      className="h-8 rounded-none border-dashed px-2 font-mono text-[10px] uppercase"
                    >
                      Revoke
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center font-mono text-xs uppercase text-white/35"
                >
                  No client credentials
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
