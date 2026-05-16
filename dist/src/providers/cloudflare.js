export class CloudflareProvider {
    name = "cloudflare";
    async publish(_request) {
        throw new Error("Cloudflare Pages is not a zero-login host. Use --host brewpage for the default no-signup flow, or deploy the local HTML manually with a Cloudflare account.");
    }
}
//# sourceMappingURL=cloudflare.js.map