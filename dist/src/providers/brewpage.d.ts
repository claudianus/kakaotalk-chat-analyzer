import type { FetchLike, HostName, PublishProvider, PublishRequest, PublishResult } from "./types.js";
export declare class BrewPageProvider implements PublishProvider {
    private readonly fetchImpl;
    private readonly endpoint;
    readonly name: HostName;
    constructor(fetchImpl?: FetchLike, endpoint?: string);
    publish(request: PublishRequest): Promise<PublishResult>;
}
