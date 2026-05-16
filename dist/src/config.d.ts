export interface StoredOwnerToken {
    provider: string;
    namespace: string;
    ownerToken: string;
    ownerLink?: string;
    id?: string;
    link?: string;
    expiresAt?: string;
    savedAt: string;
}
interface KcaConfig {
    ownerTokens?: Record<string, StoredOwnerToken>;
}
export declare function getConfigPath(): string;
export declare function loadConfig(path?: string): Promise<KcaConfig>;
export declare function saveOwnerToken(token: Omit<StoredOwnerToken, "savedAt">, path?: string): Promise<void>;
export declare function getOwnerToken(provider: string, namespace: string, path?: string): Promise<StoredOwnerToken | null>;
export declare function clearOwnerToken(provider: string, namespace: string, path?: string): Promise<boolean>;
export {};
