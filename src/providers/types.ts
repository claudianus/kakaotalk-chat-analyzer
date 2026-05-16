export type HostName = "brewpage" | "tempfile" | "cloudflare";

export interface PublishRequest {
  html: string;
  ttlDays: number;
  namespace: string;
  title: string;
  ownerToken?: string;
}

export interface PublishResult {
  provider: HostName;
  link: string;
  id?: string;
  ownerToken?: string;
  ownerLink?: string;
  expiresAt?: string;
}

export interface PublishProvider {
  readonly name: HostName;
  publish(request: PublishRequest): Promise<PublishResult>;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (url: string, init: { method: string; headers?: Record<string, string>; body?: unknown }) => Promise<FetchResponseLike>;
