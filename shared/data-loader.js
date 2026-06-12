(function () {
    var DB_NAME = 'smarttools_data_cache_v1';
    var STORE = 'entries';
    var CACHE_PREFIX = 'data:';
    var SESSION_PWD = 'bm_cfg_enc_pwd';

    function b64d(s) {
        var bin = atob(s || '');
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function getPublicSlug() {
        return document.documentElement.getAttribute('data-public-mode') || '';
    }

    function applyPublicSlugInfo() {
        var info = window.__publicSlugInfo;
        if (!info || info.hit !== true) {
            document.documentElement.removeAttribute('data-public-mode');
            return;
        }
        if (!info.oldSlug || info.oldSlug === info.slug) return;

        var lang = (document.documentElement.lang || navigator.language || 'zh').toLowerCase();
        var isZh = lang.indexOf('en') !== 0;
        var msg = isZh
            ? '您访问的旧链接 /@' + info.oldSlug + ' 已改名为 /@' + info.slug + ',数据正常显示。'
            : 'The old link /@' + info.oldSlug + ' has been renamed to /@' + info.slug + '. Content loaded normally.';
        var closeLabel = isZh ? '我知道了' : 'Got it';

        function showBanner() {
            if (document.getElementById('__renameBanner')) return;
            var b = document.createElement('div');
            b.id = '__renameBanner';
            b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
                'background:linear-gradient(90deg,#fff7e6 0%,#fffaf0 100%);' +
                'color:#7a5200;border-bottom:1px solid #f0c674;' +
                'padding:10px 16px;font-size:14px;line-height:1.5;' +
                'display:flex;align-items:center;justify-content:center;gap:16px;' +
                'box-shadow:0 2px 6px rgba(0,0,0,0.08);' +
                'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
            var text = document.createElement('span');
            text.textContent = '🔗 ' + msg;
            text.style.cssText = 'flex:1;text-align:center;max-width:900px;';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = closeLabel;
            btn.style.cssText = 'background:#f0c674;color:#5c3d00;border:0;border-radius:4px;' +
                'padding:5px 14px;cursor:pointer;font-size:13px;font-weight:500;flex-shrink:0;';
            btn.onclick = function () { if (b.parentNode) b.parentNode.removeChild(b); };
            b.appendChild(text);
            b.appendChild(btn);
            document.body.appendChild(b);
        }

        if (document.body) showBanner();
        else document.addEventListener('DOMContentLoaded', showBanner, { once: true });
    }

    function dataUrl(path) {
        var u = getPublicSlug();
        return u ? path + '?u=' + encodeURIComponent(u) : path;
    }

    function appendScript(src) {
        return new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = function() { resolve(); };
            s.onerror = function() { reject(new Error('script load failed: ' + src)); };
            document.head.appendChild(s);
        });
    }

    function runScript(text, sourceURL) {
        var s = document.createElement('script');
        s.text = String(text || '') + '\n//# sourceURL=' + (sourceURL || 'smarttools-data.js');
        document.head.appendChild(s);
    }

    function openDb() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function() {
                var db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error || new Error('IndexedDB open failed')); };
        });
    }

    async function getCache(key) {
        var db = await openDb();
        return await new Promise(function(resolve, reject) {
            var tx = db.transaction(STORE, 'readonly');
            var req = tx.objectStore(STORE).get(key);
            req.onsuccess = function() { resolve(req.result || null); };
            req.onerror = function() { reject(req.error || new Error('IndexedDB get failed')); };
            tx.oncomplete = function() { db.close(); };
            tx.onerror = function() { db.close(); };
        });
    }

    async function deriveKey(password, saltB64) {
        var baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return await crypto.subtle.deriveKey(
            { name: 'PBKDF2', hash: 'SHA-256', salt: b64d(saltB64), iterations: 150000 },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
    }

    async function tryEncryptedCache(meta) {
        if (!meta || !meta.loggedIn || meta.privateFiltered || !meta.dataEtag || !meta.uid) return false;
        if (!crypto || !crypto.subtle || !indexedDB) return false;
        var password = null;
        try { password = sessionStorage.getItem(SESSION_PWD); } catch (e) {}
        if (!password) return false;

        var item = await getCache(CACHE_PREFIX + meta.uid);
        if (!item || item.dataEtag !== meta.dataEtag || !item.cipher || !item.iv || !item.salt) return false;

        var key = await deriveKey(password, item.salt);
        var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(item.iv) }, key, b64d(item.cipher));
        window.__viewerInfo = {
            isAdminView: meta.namespace === 'admin',
            slug: null,
            username: meta.uid || null
        };
        runScript(new TextDecoder().decode(plain), 'smarttools-data-cache.js');
        window.__smartToolsDataCacheHit = true;
        return true;
    }

    async function loadOnlineData() {
        var meta = null;
        var password = null;
        try { password = sessionStorage.getItem(SESSION_PWD); } catch (e) {}
        if (password) {
            try {
                var mr = await fetch(dataUrl('/api/data-meta'), { credentials: 'include', cache: 'no-store' });
                if (mr.ok) meta = await mr.json();
            } catch (e) {}

            try {
                if (await tryEncryptedCache(meta)) return;
            } catch (e) {
                console.warn('encrypted data cache skipped:', e && e.message);
            }
        }

        var r = await fetch(dataUrl('/api/data'), { credentials: 'include', cache: 'default' });
        if (!r.ok) throw new Error('/api/data failed: ' + r.status);
        runScript(await r.text(), '/api/data');
        window.__smartToolsDataCacheHit = false;
    }

    async function loadData() {
        if (location.protocol === 'file:') {
            await appendScript('data.js');
            return;
        }
        try {
            await loadOnlineData();
            applyPublicSlugInfo();
        } catch (e) {
            console.warn('online data load failed, fallback to data.js:', e && e.message);
            await appendScript('data.js');
        }
    }

    window.__SmartToolsDataReady = loadData();
})();
