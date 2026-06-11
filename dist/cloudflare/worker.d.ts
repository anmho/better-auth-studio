type Env = {
    ASSETS: {
        fetch(request: Request): Promise<Response>;
    };
    AUTH_INTERNAL_BASE_URL?: string;
    CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_ID?: string;
    CLOUDFLARE_ACCESS_SERVICE_TOKEN_CLIENT_SECRET?: string;
    STUDIO_ALLOWED_HOST?: string;
};
declare const _default: {
    fetch(request: Request, env: Env): Promise<Response> | Response;
};
export default _default;
export declare function buildTargetUrl(baseUrl: string, internalPath: string): URL;
