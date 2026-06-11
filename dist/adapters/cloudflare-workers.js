import { injectStudioConfig } from "../utils/cloudflare-html-injector.js";
export function createCloudflareStudioHandler(config, options) {
    return async (request) => {
        const path = normalizePath(new URL(request.url), config.basePath);
        if (path === "/api/service-credentials" || path.startsWith("/api/service-credentials/")) {
            return handleServiceCredentialsRequest(request, path, config);
        }
        if (path === "/api/config") {
            return jsonResponse(200, {
                studio: { version: "1.1.3-anmho.0" },
                serviceCredentials: { enabled: config.serviceCredentials?.enabled !== false },
            });
        }
        if (path.startsWith("/api/")) {
            return jsonResponse(404, { error: "not_found" });
        }
        return serveAsset(request, path, config, options.assets);
    };
}
async function handleServiceCredentialsRequest(request, pathWithQuery, config) {
    const serviceCredentials = config.serviceCredentials;
    if (!serviceCredentials || serviceCredentials.enabled === false) {
        return jsonResponse(404, { error: "service_credentials_not_enabled" });
    }
    let body;
    if (request.method !== "GET" && request.method !== "HEAD") {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            body = await request.json().catch(() => undefined);
        }
        else if (contentType.includes("application/x-www-form-urlencoded")) {
            body = Object.fromEntries(await request.formData().catch(() => new FormData()));
        }
    }
    const headers = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });
    const [pathWithoutQuery, queryString] = pathWithQuery.split("?");
    const strippedPath = pathWithoutQuery.slice("/api/service-credentials".length) || "/";
    const proxyResponse = await serviceCredentials.request({
        path: strippedPath + (queryString ? `?${queryString}` : ""),
        method: request.method,
        headers,
        body,
    });
    return jsonResponse(proxyResponse.status, proxyResponse.body ?? null, proxyResponse.headers);
}
function jsonResponse(status, body, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
    });
}
function normalizePath(url, basePath) {
    if (!basePath)
        return url.pathname + url.search;
    const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    if (url.pathname === normalizedBasePath || url.pathname === `${normalizedBasePath}/`) {
        return "/" + url.search;
    }
    if (url.pathname.startsWith(`${normalizedBasePath}/`)) {
        return url.pathname.slice(normalizedBasePath.length) + url.search;
    }
    return url.pathname + url.search;
}
async function serveAsset(originalRequest, pathWithQuery, config, assets) {
    const [pathname] = pathWithQuery.split("?");
    const assetPath = pathname === "/" || pathname === "" ? "/index.html" : pathname;
    const assetRequest = new Request(rewriteAssetUrl(originalRequest.url, assetPath), originalRequest);
    const assetResponse = await assets.fetch(assetRequest);
    if (assetPath === "/index.html" || assetResponse.headers.get("content-type")?.includes("text/html")) {
        const html = await assetResponse.text();
        return new Response(injectStudioConfig(html, config), {
            status: assetResponse.status,
            headers: {
                "Content-Type": "text/html",
                "Cache-Control": "no-cache",
            },
        });
    }
    if (assetResponse.status === 404) {
        const indexRequest = new Request(rewriteAssetUrl(originalRequest.url, "/index.html"), originalRequest);
        const indexResponse = await assets.fetch(indexRequest);
        const html = await indexResponse.text();
        return new Response(injectStudioConfig(html, config), {
            headers: {
                "Content-Type": "text/html",
                "Cache-Control": "no-cache",
            },
        });
    }
    return assetResponse;
}
function rewriteAssetUrl(originalUrl, pathname) {
    const url = new URL(originalUrl);
    url.pathname = pathname;
    url.search = "";
    return url.toString();
}
