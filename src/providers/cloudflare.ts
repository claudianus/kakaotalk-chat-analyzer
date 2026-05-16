import type { HostName, PublishProvider, PublishRequest, PublishResult } from "./types.js";

export class CloudflareProvider implements PublishProvider {
  readonly name: HostName = "cloudflare";

  async publish(_request: PublishRequest): Promise<PublishResult> {
    throw new Error(
      "Cloudflare Pages is not a zero-login host. Use --host brewpage for the default no-signup flow, or deploy the local HTML manually with a Cloudflare account.",
    );
  }
}
