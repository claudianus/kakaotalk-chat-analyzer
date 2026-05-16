import type { HostName, PublishProvider } from "./types.js";
export declare function createProvider(host: HostName): PublishProvider;
export declare function parseHostName(value: string): HostName;
