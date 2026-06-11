export async function routeApiRequest(ctx) {
    if (ctx.path === "/api/service-credentials" || ctx.path.startsWith("/api/service-credentials/")) {
        const serviceCredentials = ctx.studioConfig?.serviceCredentials;
        if (!serviceCredentials || serviceCredentials.enabled === false) {
            return {
                status: 404,
                data: { error: "service_credentials_not_enabled" },
            };
        }
        const [pathWithPrefix, queryString] = ctx.path.split("?");
        const strippedPath = pathWithPrefix.slice("/api/service-credentials".length) || "/";
        const path = strippedPath + (queryString ? `?${queryString}` : "");
        try {
            const response = await serviceCredentials.request({
                path,
                method: ctx.method,
                headers: ctx.headers,
                ip: ctx.ip,
                body: ctx.body,
            });
            return {
                status: response.status,
                data: response.body ?? null,
            };
        }
        catch (error) {
            console.error("Service credentials routing error:", error);
            return {
                status: 500,
                data: { error: "service_credentials_request_failed" },
            };
        }
    }
    const { handleStudioApiRequest } = await import("../routes.js");
    try {
        return await handleStudioApiRequest(ctx);
    }
    catch (error) {
        console.error("API routing error:", error);
        return {
            status: 500,
            data: { error: "Internal server error" },
        };
    }
}
