const encoder = new TextEncoder();

export function nsDataMetaKey(ns) {
    return `${ns}:data_meta`;
}

export async function sha256HexText(text) {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(String(text || '')));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function makeDataEtag(hash, scope = 'full') {
    return `"${scope}-${hash}"`;
}

export async function buildDataMeta(content) {
    const hash = await sha256HexText(content || '');
    return {
        version: new Date().toISOString(),
        hash,
        etag: makeDataEtag(hash, 'full'),
        size: String(content || '').length
    };
}

export async function readDataMeta(env, ns) {
    if (!env.FAV_KV) return null;
    try {
        const raw = await env.FAV_KV.get(nsDataMetaKey(ns));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function writeDataMeta(env, ns, content) {
    if (!env.FAV_KV) return null;
    const meta = await buildDataMeta(content);
    await env.FAV_KV.put(nsDataMetaKey(ns), JSON.stringify(meta));
    return meta;
}

export async function ensureDataMeta(env, ns, content) {
    const existing = await readDataMeta(env, ns);
    const hash = await sha256HexText(content || '');
    if (existing && existing.hash === hash && existing.version) {
        return {
            ...existing,
            hash,
            etag: existing.etag || makeDataEtag(hash, 'full'),
            size: existing.size != null ? existing.size : String(content || '').length
        };
    }
    return await writeDataMeta(env, ns, content);
}
