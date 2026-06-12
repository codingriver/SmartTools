// GET  /api/site-config  → 读取网站基础配置（标题/页眉/页脚/主题/后台设置），公开访问
// POST /api/site-config  → 保存网站配置（需登录）
//
// 配置结构：
//   { title: string, header: string, footer: string, defaultTheme: string, autoBackupEnabled: boolean, backupRetention: number, deleteConfirmEnabled: boolean }
// 空字符串表示使用主题默认。

import { requireAuth, jsonResponse } from '../_shared/auth.js';

const ADMIN_SITE_CONFIG_KEY = 'admin:site_config';

// 默认配置（主题内置的默认值）
const DEFAULT_CONFIG = {
    title: '',
    header: '',
    footer: '',
    defaultTheme: 'notion',
    autoBackupEnabled: false,
    backupRetention: 30,
    deleteConfirmEnabled: true
};

const ALLOWED_THEMES = new Set(['nebula', 'notion', 'stripe', 'dark', 'mint']);

function normalizeTheme(value, fallback = DEFAULT_CONFIG.defaultTheme) {
    const theme = String(value || '').trim().toLowerCase();
    return ALLOWED_THEMES.has(theme) ? theme : fallback;
}

function normalizeBackupRetention(value, fallback = DEFAULT_CONFIG.backupRetention) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    if (rounded === 0) return 0;
    return Math.max(1, Math.min(500, rounded));
}

export async function onRequestGet({ request, env }) {
    const result = { ...DEFAULT_CONFIG };

    if (env.FAV_KV) {
        try {
            const saved = await env.FAV_KV.get(ADMIN_SITE_CONFIG_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.title != null) result.title = parsed.title;
                if (parsed.header != null) result.header = parsed.header;
                if (parsed.footer != null) result.footer = parsed.footer;
                if (parsed.defaultTheme != null) result.defaultTheme = normalizeTheme(parsed.defaultTheme);
                if (parsed.autoBackupEnabled != null) result.autoBackupEnabled = parsed.autoBackupEnabled === true;
                if (parsed.backupRetention != null) result.backupRetention = normalizeBackupRetention(parsed.backupRetention);
                if (parsed.deleteConfirmEnabled != null) result.deleteConfirmEnabled = parsed.deleteConfirmEnabled !== false;
            }
        } catch {}
    }

    return jsonResponse({ ok: true, ...result });
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: '未绑定 KV' }, 500);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: '请求格式错误' }, 400); }

    // 允许部分更新
    const current = { ...DEFAULT_CONFIG };
    try {
        const saved = await env.FAV_KV.get(ADMIN_SITE_CONFIG_KEY);
        if (saved) Object.assign(current, JSON.parse(saved));
    } catch {}
    current.autoBackupEnabled = current.autoBackupEnabled === true;
    current.deleteConfirmEnabled = current.deleteConfirmEnabled !== false;

    const config = {
        title: body.title !== undefined ? String(body.title || '') : current.title,
        header: body.header !== undefined ? String(body.header || '') : current.header,
        footer: body.footer !== undefined ? String(body.footer || '') : current.footer,
        defaultTheme: body.defaultTheme !== undefined ? normalizeTheme(body.defaultTheme, current.defaultTheme) : normalizeTheme(current.defaultTheme),
        autoBackupEnabled: body.autoBackupEnabled !== undefined ? body.autoBackupEnabled === true : current.autoBackupEnabled === true,
        backupRetention: body.backupRetention !== undefined ? normalizeBackupRetention(body.backupRetention, current.backupRetention) : normalizeBackupRetention(current.backupRetention),
        deleteConfirmEnabled: body.deleteConfirmEnabled !== undefined ? body.deleteConfirmEnabled !== false : current.deleteConfirmEnabled !== false
    };

    await env.FAV_KV.put(ADMIN_SITE_CONFIG_KEY, JSON.stringify(config));
    return jsonResponse({ ok: true, ...config });
}
