import { requireAuth, jsonResponse } from '../_shared/auth.js';

const MAX_BYTES = 262144;
const FETCH_TIMEOUT_MS = 8000;

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: '请求格式错误' }, 400); }

    const rawUrl = String(body && body.url || '').trim();
    if (!rawUrl) return jsonResponse({ ok: false, error: 'URL 不能为空' }, 400);

    let parsed;
    try { parsed = new URL(rawUrl); }
    catch { return jsonResponse({ ok: false, error: 'URL 格式无效' }, 400); }

    if (!/^https?:$/i.test(parsed.protocol)) {
        return jsonResponse({ ok: false, error: '仅支持 http 或 https 链接' }, 400);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS);
    try {
        const resp = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'SmartTools Title Fetcher/1.0',
                'Accept': 'text/html,application/xhtml+xml'
            },
            cf: { cacheTtl: 0, cacheEverything: false }
        });
        if (!resp.ok) {
            return jsonResponse({ ok: false, error: '目标页面返回失败：HTTP ' + resp.status }, 502);
        }

        const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
        if (contentType && contentType.indexOf('text/html') < 0 && contentType.indexOf('application/xhtml+xml') < 0) {
            return jsonResponse({ ok: false, error: '该链接不是可解析标题的 HTML 页面' }, 400);
        }

        const html = await readResponsePreview(resp, MAX_BYTES);
        const title = extractPageTitle(html);
        if (!title) {
            return jsonResponse({ ok: false, error: '未能从页面提取标题' }, 404);
        }
        return jsonResponse({ ok: true, title });
    } catch (err) {
        const msg = err && err.name === 'AbortError'
            ? '抓取页面超时'
            : '抓取页面失败';
        return jsonResponse({ ok: false, error: msg }, 502);
    } finally {
        clearTimeout(timer);
    }
}

async function readResponsePreview(resp, limit) {
    if (!resp.body || !resp.body.getReader) {
        const text = await resp.text();
        return text.slice(0, limit);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let result = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        result += decoder.decode(value, { stream: true });
        if (total >= limit) break;
    }
    result += decoder.decode();
    try { reader.cancel(); } catch {}
    return result.slice(0, limit);
}

function extractPageTitle(html) {
    const source = String(html || '');
    const patterns = [
        /<title\b[^>]*>([\s\S]*?)<\/title>/i,
        /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
        /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*>/i,
        /<meta\b[^>]*name=["']twitter:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
        /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*name=["']twitter:title["'][^>]*>/i
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match || !match[1]) continue;
        const value = decodeHtmlEntities(stripTags(match[1])).replace(/\s+/g, ' ').trim();
        if (value) return value;
    }
    return '';
}

function stripTags(value) {
    return String(value || '').replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, function(_, hex) {
            const code = parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCodePoint(code) : _;
        })
        .replace(/&#([0-9]+);/g, function(_, num) {
            const code = parseInt(num, 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : _;
        });
}
