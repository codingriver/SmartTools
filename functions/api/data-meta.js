// GET /api/data-meta → 返回当前数据的轻量版本信息,用于浏览器缓存校验。

import { jsonResponse, getPayload } from '../_shared/auth.js';
import { isValidSlug, getUserBySlug, lookupOldSlugRedirect } from '../_shared/slug.js';
import { ensureDataMeta, makeDataEtag, sha256HexText } from '../_shared/data-meta.js';

const OLD_DATA_KEY = 'data_js';
const OLD_SOURCE_KEY = 'data_source';
const ADMIN_DATA_KEY = 'admin:data_js';
const ADMIN_SOURCE_KEY = 'admin:data_source';

const EMPTY_STUB = `/* data.js 尚未初始化 */
var usbDriveData = [];
var teachingData = [];
var onlineAIData = [];
var videoData = [];
var emailData = [];
var contactData = [];
var customSections = [];
`;

function userDataKey(uid) { return 'user:' + uid + ':data_js'; }
function userSourceKey(uid) { return 'user:' + uid + ':data_source'; }

function findMatchingBracket(src, openIdx, openChar, closeChar) {
    let depth = 0, quote = null, escape = false, lineComment = false, blockComment = false;
    for (let i = openIdx; i < src.length; i++) {
        const ch = src[i], next = src[i + 1];
        if (lineComment) { if (ch === '\n') lineComment = false; continue; }
        if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
        if (quote) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === openChar) depth++;
        else if (ch === closeChar && --depth === 0) return i;
    }
    return -1;
}

function splitTopLevelItems(src) {
    const items = [];
    let start = 0, depthBrace = 0, depthBracket = 0, depthParen = 0;
    let quote = null, escape = false, lineComment = false, blockComment = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i], next = src[i + 1];
        if (lineComment) { if (ch === '\n') lineComment = false; continue; }
        if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
        if (quote) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '{') depthBrace++;
        else if (ch === '}') depthBrace--;
        else if (ch === '[') depthBracket++;
        else if (ch === ']') depthBracket--;
        else if (ch === '(') depthParen++;
        else if (ch === ')') depthParen--;
        else if (ch === ',' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) {
            items.push(src.slice(start, i));
            start = i + 1;
        }
    }
    const tail = src.slice(start);
    if (tail.trim()) items.push(tail);
    return items;
}

function stripPrivateSections(content) {
    if (!content || typeof content !== 'string') return content;
    const m = /var\s+sections\s*=\s*\[/.exec(content);
    if (!m) return content;
    const arrayStart = m.index + m[0].lastIndexOf('[');
    const arrayEnd = findMatchingBracket(content, arrayStart, '[', ']');
    if (arrayEnd < 0) return content;
    const body = content.slice(arrayStart + 1, arrayEnd);
    const publicItems = splitTopLevelItems(body).filter(item => !/\b(?:private|encrypted)\s*:\s*true\b/.test(item));
    return content.slice(0, arrayStart + 1) + (publicItems.length ? '\n' + publicItems.join(',') + '\n' : '\n') + content.slice(arrayEnd);
}

async function resolvePublicSlug(env, slug) {
    if (!slug || !isValidSlug(slug)) return null;
    let found = await getUserBySlug(env, slug);
    if (found) return { slug, uid: found.uid, role: found.role || 'user' };
    const newSlug = await lookupOldSlugRedirect(env, slug);
    if (newSlug && newSlug !== slug) {
        found = await getUserBySlug(env, newSlug);
        if (found) return { slug: newSlug, oldSlug: slug, uid: found.uid, role: found.role || 'user' };
    }
    return null;
}

async function readDataContext(request, env) {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get('u');
    const publicHit = await resolvePublicSlug(env, slugParam);
    let ns, uid, isLoggedIn = false, isPublicSlugMode = false;

    if (publicHit) {
        uid = publicHit.uid;
        ns = publicHit.role === 'admin' ? 'admin' : 'user';
        isPublicSlugMode = true;
    } else {
        const payload = await getPayload(request, env);
        isLoggedIn = !!payload;
        const role = isLoggedIn ? (payload.role || 'user') : null;
        uid = isLoggedIn ? (payload.uid != null ? payload.uid : payload.u) : null;
        ns = role === 'user' ? 'user' : 'admin';
    }

    const dataKey = ns === 'admin' ? ADMIN_DATA_KEY : userDataKey(uid);
    const sourceKey = ns === 'admin' ? ADMIN_SOURCE_KEY : userSourceKey(uid);
    let source = 'static';
    let content = null;

    if (env.FAV_KV) {
        const [saved, dataResult] = await Promise.all([
            env.FAV_KV.get(sourceKey),
            env.FAV_KV.get(dataKey)
        ]);
        if (saved === 'kv' || saved === 'static') source = saved;
        content = dataResult || null;
        if (ns === 'admin' && content == null) {
            const legacy = await env.FAV_KV.get(OLD_DATA_KEY);
            if (legacy != null) content = legacy;
            if (source !== 'kv' && source !== 'static') {
                const legacySrc = await env.FAV_KV.get(OLD_SOURCE_KEY);
                if (legacySrc === 'kv' || legacySrc === 'static') source = legacySrc;
            }
        }
    }

    let actualSource = source;
    if (source !== 'kv') content = null;

    if (!content && ns === 'admin') {
        const fallbackUrl = new URL('/data.js', request.url);
        try {
            if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
                const r = await env.ASSETS.fetch(fallbackUrl.toString());
                if (r.ok) content = await r.text();
            }
        } catch {}
        actualSource = content ? 'static' : actualSource;
    }

    if (!content) {
        content = EMPTY_STUB;
        actualSource = ns === 'user' ? 'user-empty' : 'empty';
    }

    return { ns, uid, isLoggedIn, isPublicSlugMode, publicHit, actualSource, content };
}

export async function onRequestGet({ request, env }) {
    const ctx = await readDataContext(request, env);
    const canViewPrivateSections = ctx.isLoggedIn && !ctx.isPublicSlugMode;
    const dataMetaNs = ctx.ns === 'admin' ? 'admin' : `user:${ctx.uid}`;
    let fullMeta;

    if (ctx.actualSource === 'kv' && env.FAV_KV) {
        fullMeta = await ensureDataMeta(env, dataMetaNs, ctx.content);
    } else {
        const hash = await sha256HexText(ctx.content);
        fullMeta = {
            version: hash,
            hash,
            etag: makeDataEtag(hash, 'full'),
            size: String(ctx.content || '').length
        };
    }

    const responseContent = canViewPrivateSections ? ctx.content : stripPrivateSections(ctx.content);
    const responseHash = canViewPrivateSections ? fullMeta.hash : await sha256HexText(responseContent);
    const responseEtag = canViewPrivateSections ? (fullMeta.etag || makeDataEtag(responseHash, 'full')) : makeDataEtag(responseHash, 'public');

    return jsonResponse({
        ok: true,
        loggedIn: ctx.isLoggedIn,
        namespace: ctx.ns,
        uid: ctx.uid,
        source: ctx.actualSource,
        dataVersion: fullMeta.version,
        dataEtag: responseEtag,
        dataHash: responseHash,
        privateFiltered: !canViewPrivateSections,
        publicSlug: ctx.publicHit ? ctx.publicHit.slug : null,
        publicOldSlug: ctx.publicHit ? (ctx.publicHit.oldSlug || null) : null
    }, 200, {
        'Cache-Control': ctx.isLoggedIn && !ctx.isPublicSlugMode
            ? 'private, no-store'
            : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        'ETag': responseEtag,
        'X-Data-Version': fullMeta.version,
        'X-Data-ETag': responseEtag
    });
}
