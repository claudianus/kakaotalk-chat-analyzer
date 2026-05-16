import { USER_AGENT } from "../version.js";
const DEFAULT_ENDPOINT = "https://brewpage.app/api/html";
export class BrewPageProvider {
    fetchImpl;
    endpoint;
    name = "brewpage";
    constructor(fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT) {
        this.fetchImpl = fetchImpl;
        this.endpoint = endpoint;
    }
    async publish(request) {
        const ttlDays = clampTtl(request.ttlDays);
        const url = new URL(this.endpoint);
        url.searchParams.set("ns", request.namespace);
        url.searchParams.set("ttl", String(ttlDays));
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        };
        if (request.ownerToken) {
            headers["X-Owner-Token"] = request.ownerToken;
        }
        const response = await this.fetchImpl(url.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify({
                content: request.html,
                filename: request.title,
                showTopBar: true,
            }),
        });
        const text = await response.text();
        let body = null;
        try {
            body = text ? JSON.parse(text) : null;
        }
        catch {
            body = null;
        }
        if (!response.ok) {
            throw new Error(`BrewPage upload failed: HTTP ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ""}`);
        }
        const parsed = parseBrewPageResponse(body);
        if (!parsed.link) {
            throw new Error(`BrewPage upload response did not include a share URL: ${text.slice(0, 300)}`);
        }
        return {
            provider: this.name,
            link: parsed.link,
            id: parsed.id ?? idFromLink(parsed.link),
            ownerToken: parsed.ownerToken,
            ownerLink: parsed.ownerLink,
            expiresAt: parsed.expiresAt ?? expiryFromTtl(ttlDays),
        };
    }
}
function parseBrewPageResponse(body) {
    const record = asRecord(body);
    const data = asRecord(record?.data);
    return {
        link: stringField(record, "link") ?? stringField(record, "url") ?? stringField(data, "link") ?? stringField(data, "url"),
        id: stringField(record, "id") ?? stringField(record, "siteId") ?? stringField(data, "id") ?? stringField(data, "siteId"),
        ownerToken: stringField(record, "ownerToken") ??
            stringField(record, "deleteToken") ??
            stringField(data, "ownerToken") ??
            stringField(data, "deleteToken"),
        ownerLink: stringField(record, "ownerLink") ?? stringField(data, "ownerLink"),
        expiresAt: stringField(record, "expiresAt") ?? stringField(data, "expiresAt"),
    };
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function stringField(record, key) {
    const value = record?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function idFromLink(link) {
    try {
        const url = new URL(link);
        const parts = url.pathname.split("/").filter(Boolean);
        return parts.at(-1);
    }
    catch {
        return undefined;
    }
}
function expiryFromTtl(ttlDays) {
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}
function clampTtl(ttlDays) {
    if (!Number.isFinite(ttlDays))
        return 30;
    return Math.max(1, Math.min(30, Math.round(ttlDays)));
}
//# sourceMappingURL=brewpage.js.map