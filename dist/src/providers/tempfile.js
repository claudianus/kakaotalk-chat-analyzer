import { USER_AGENT } from "../version.js";
const DEFAULT_ENDPOINT = "https://tempfile.org/api/upload/local";
export class TempFileProvider {
    fetchImpl;
    endpoint;
    name = "tempfile";
    constructor(fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT) {
        this.fetchImpl = fetchImpl;
        this.endpoint = endpoint;
    }
    async publish(request) {
        const form = new FormData();
        form.append("files", new Blob([request.html], { type: "text/html;charset=utf-8" }), "kakao-chat-report.html");
        form.append("expiryHours", String(Math.max(1, Math.round(request.ttlDays * 24))));
        const response = await this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: {
                "User-Agent": USER_AGENT,
            },
            body: form,
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
            throw new Error(`TempFile upload failed: HTTP ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ""}`);
        }
        const link = parseTempFileLink(body);
        if (!link) {
            throw new Error(`TempFile upload response did not include a file URL: ${text.slice(0, 300)}`);
        }
        return {
            provider: this.name,
            link,
            expiresAt: expiryFromTtl(request.ttlDays),
        };
    }
}
function parseTempFileLink(body) {
    const record = asRecord(body);
    const files = Array.isArray(record?.files) ? record.files : [];
    const firstFile = asRecord(files[0]);
    return stringField(firstFile, "url") ?? stringField(asRecord(record?.file), "url");
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function stringField(record, key) {
    const value = record?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function expiryFromTtl(ttlDays) {
    return new Date(Date.now() + Math.max(1, ttlDays) * 24 * 60 * 60 * 1000).toISOString();
}
//# sourceMappingURL=tempfile.js.map