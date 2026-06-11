import type { StudioConfig } from "../types/handler.js";
export type CloudflareAssetsBinding = {
    fetch(request: Request): Promise<Response>;
};
export type CloudflareStudioOptions = {
    assets: CloudflareAssetsBinding;
};
export declare function createCloudflareStudioHandler(config: StudioConfig, options: CloudflareStudioOptions): (request: Request) => Promise<Response>;
