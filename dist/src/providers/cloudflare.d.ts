import type { HostName, PublishProvider, PublishRequest, PublishResult } from "./types.js";
export declare class CloudflareProvider implements PublishProvider {
    readonly name: HostName;
    publish(_request: PublishRequest): Promise<PublishResult>;
}
