import { handleStudioRequest } from "../core/handler.js";
import { injectStudioConfig } from "../utils/html-injector.js";
export function createCloudflareStudioHandler(config, options) {
    return async (request) => {
        const path = normalizePath(new URL(request.url), config.basePath);
        const wantsJson = (request.headers.get("accept") || "").includes("application/json");
        if (path.startsWith("/api/") || wantsJson) {
            const universalRes = await handleStudioRequest(await convertRequest(request), config);
            return toResponse(universalRes);
        }
        return serveAsset(request, path, config, options.assets);
    };
}
async function convertRequest(request) {
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
    const url = new URL(request.url);
    return {
        url: url.pathname + url.search,
        method: request.method,
        headers,
        body,
    };
}
function toResponse(universal) {
    const headers = new Headers(universal.headers);
    universal.setCookies?.forEach((cookie) => headers.append("Set-Cookie", cookie));
    return new Response(universal.body, {
        status: universal.status,
        headers,
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
