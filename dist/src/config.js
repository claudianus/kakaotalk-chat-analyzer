import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
export function getConfigPath() {
    const explicit = process.env.KCA_CONFIG_HOME;
    if (explicit)
        return join(explicit, "config.json");
    if (process.platform === "win32" && process.env.APPDATA) {
        return join(process.env.APPDATA, "kakaotalk-chat-analyzer", "config.json");
    }
    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg)
        return join(xdg, "kakaotalk-chat-analyzer", "config.json");
    return join(homedir(), ".config", "kakaotalk-chat-analyzer", "config.json");
}
export async function loadConfig(path = getConfigPath()) {
    try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return {};
        }
        throw error;
    }
}
export async function saveOwnerToken(token, path = getConfigPath()) {
    const config = await loadConfig(path);
    const key = tokenKey(token.provider, token.namespace);
    config.ownerTokens = {
        ...(config.ownerTokens ?? {}),
        [key]: {
            ...token,
            savedAt: new Date().toISOString(),
        },
    };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
export async function getOwnerToken(provider, namespace, path = getConfigPath()) {
    const config = await loadConfig(path);
    return config.ownerTokens?.[tokenKey(provider, namespace)] ?? null;
}
export async function clearOwnerToken(provider, namespace, path = getConfigPath()) {
    const config = await loadConfig(path);
    const key = tokenKey(provider, namespace);
    if (!config.ownerTokens?.[key])
        return false;
    delete config.ownerTokens[key];
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return true;
}
function tokenKey(provider, namespace) {
    return `${provider}:${namespace}`;
}
//# sourceMappingURL=config.js.map