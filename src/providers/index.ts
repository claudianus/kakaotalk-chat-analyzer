import { BrewPageProvider } from "./brewpage.js";
import { CloudflareProvider } from "./cloudflare.js";
import { TempFileProvider } from "./tempfile.js";
import type { HostName, PublishProvider } from "./types.js";

export function createProvider(host: HostName): PublishProvider {
  switch (host) {
    case "brewpage":
      return new BrewPageProvider();
    case "tempfile":
      return new TempFileProvider();
    case "cloudflare":
      return new CloudflareProvider();
  }
}

export function parseHostName(value: string): HostName {
  if (value === "brewpage" || value === "tempfile" || value === "cloudflare") {
    return value;
  }
  throw new Error(`Unsupported host "${value}". Expected brewpage, tempfile, or cloudflare.`);
}
