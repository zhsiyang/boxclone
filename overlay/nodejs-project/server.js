'use strict';
/*
 * 零依赖 HTTP 服务（node:http 手写路由）。
 * 不引 fastify / axios / cheerio —— iOS 上少一层原生依赖，构建和运行时都更稳。
 *
 * 路由：
 *   GET  /check                       存活探针
 *   GET  /config                      CatVod 格式配置（App 启动时拉）
 *   GET  /sites                       站点列表（App 的「源管理」页用）
 *   POST /sites/{add|update|remove|reorder|reset|test|export|import}
 *   POST /spider/{key}/{type}/{action} action ∈ init|home|category|detail|play|search
 *
 * 约定：业务错误一律 HTTP 500 + {err, tip}，与 CatVod 一致，App 端按 !ok 处理。
 */
const http = require('http');
const { URL } = require('url');
const spiders = require('./spiders');

const MAX_BODY = 2 * 1024 * 1024; // custom 源要粘整段 JS，给到 2MB

function sendJson(res, code, obj) {
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    res.writeHead(code, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.length,
        'cache-control': 'no-store',
    });
    res.end(body);
}

function sendErr(res, err) {
    const msg = err && err.message ? err.message : String(err);
    sendJson(res, 500, { err: msg, tip: 'check debug console output' });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(new Error('请求体过大 (>2MB)'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8').trim();
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                // 允许表单式提交，兜底成空对象而不是直接报错
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

function buildConfig(store) {
    const cfg = {
        video: { sites: [] },
        read: { sites: [] },
        comic: { sites: [] },
        music: { sites: [] },
        pan: { sites: [] },
    };
    store.list().forEach((s) => {
        const item = {
            key: s.key,
            name: s.name || s.key,
            type: s.type,
            api: '/spider/' + s.key + '/' + s.type,
            searchable: s.type === 1 || s.type === 9,
            quickSearch: s.type === 1 || s.type === 9,
        };
        const t = Number(s.type);
        if (t < 10) cfg.video.sites.push(item);
        else if (t < 20) cfg.read.sites.push(item);
        else if (t < 30) cfg.comic.sites.push(item);
        else if (t < 40) cfg.music.sites.push(item);
        else if (t < 50) cfg.pan.sites.push(item);
    });
    return cfg;
}

async function handleSites(req, res, action, store, dataDir) {
    const body = await readBody(req);
    switch (action) {
        case 'add':
            return sendJson(res, 200, { ok: true, site: store.add(body.site || body) });

        case 'update': {
            const key = body.key || (body.site && body.site.key);
            const s = store.update(key, body.patch || body.site || {});
            if (!s) return sendJson(res, 404, { err: '站点不存在' });
            return sendJson(res, 200, { ok: true, site: s });
        }

        case 'remove': {
            const ok = store.remove(body.key);
            return sendJson(res, ok ? 200 : 404, { ok, key: body.key });
        }

        case 'reorder':
            return sendJson(res, 200, { ok: store.reorder(body.keys) });

        case 'reset':
            return sendJson(res, 200, { ok: true, sites: store.reset() });

        case 'export':
            return sendJson(res, 200, { ok: true, sites: store.list(), file: store.file() });

        case 'import': {
            const arr = Array.isArray(body.sites) ? body.sites : [];
            let n = 0;
            arr.forEach((s) => {
                // 自定义 JS 源可以没有 url（脚本全在 ext 里），所以不能只用 url 判空
                if (!s || (!s.url && !s.ext)) return;
                store.add({
                    name: s.name || '导入站点',
                    type: Number(s.type) || 1,
                    url: s.url || '',
                    ext: s.ext || '',
                    headers: s.headers || {},
                    enabled: s.enabled !== false,
                });
                n++;
            });
            return sendJson(res, 200, { ok: true, imported: n, sites: store.list() });
        }

        case 'test': {
            // 只用 get() 取地址，不落任何状态；把真实错误原样抛给 App
            const site = store.get(body.key) || body.site;
            if (!site) return sendJson(res, 404, { err: '站点不存在' });
            const sp = spiders.resolve(site);
            try {
                const r = await sp.home({ site, body: {}, dataDir, log: () => {} });
                const n = (r && r.list && r.list.length) || 0;
                return sendJson(res, 200, {
                    ok: true,
                    count: n,
                    class: (r && r.class) || [],
                    sample: n ? r.list.slice(0, 3).map((v) => v.vod_name) : [],
                });
            } catch (e) {
                return sendJson(res, 500, { err: e.message || String(e) });
            }
        }

        default:
            return sendJson(res, 404, { err: '未知操作: ' + action });
    }
}

async function handleSpider(req, res, parts, store, dataDir, log) {
    // parts = [key, type, action]
    const key = parts[0];
    const action = parts[2];
    const site = store.get(key);
    if (!site) return sendJson(res, 404, { err: '站点不存在: ' + key });
    if (site.enabled === false) return sendJson(res, 403, { err: '站点已停用' });

    const sp = spiders.resolve(site);
    const fn = sp[action];
    if (typeof fn !== 'function') return sendJson(res, 404, { err: '不支持的 action: ' + action });

    const body = action === 'init' ? {} : await readBody(req);
    const ctx = {
        site,
        body,
        dataDir,
        log: (...a) => log('[spider:' + site.name + '] ' + a.map(String).join(' ')),
    };
    const out = await fn(ctx);
    return sendJson(res, 200, out);
}

async function handlePrefs(req, res, action, prefs) {
    const body = await readBody(req);
    switch (action) {
        case 'settings':
            return sendJson(res, 200, { ok: true, settings: prefs.setSettings(body.patch || body) });

        case 'history':
            return sendJson(res, 200, { ok: true, history: prefs.touchHistory(body.item || body) });

        case 'history/remove':
            return sendJson(res, 200, { ok: prefs.removeHistory(body.id), history: prefs.history() });

        case 'history/clear':
            return sendJson(res, 200, { ok: prefs.clearHistory(), history: [] });

        case 'fav':
            return sendJson(res, 200, Object.assign({ ok: true }, prefs.toggleFav(body.item || body)));

        default:
            return sendJson(res, 404, { err: '未知操作: ' + action });
    }
}

module.exports.createServer = function createServer(store, opts) {
    const dataDir = (opts && opts.dataDir) || process.cwd();
    const log = (opts && opts.log) || ((s) => console.log(s));
    const prefs = require('./prefs')(dataDir);

    return http.createServer(async (req, res) => {
        // 本地服务，允许任意来源，方便调试时用浏览器直连
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('access-control-allow-headers', 'content-type');
        res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        let u;
        try {
            u = new URL(req.url, 'http://127.0.0.1');
        } catch (e) {
            return sendJson(res, 400, { err: 'bad url' });
        }
        const p = u.pathname.replace(/\/+$/, '') || '/';

        try {
            if (p === '/check') return sendJson(res, 200, { run: true });
            if (p === '/config') return sendJson(res, 200, buildConfig(store));
            if (p === '/sites' && req.method === 'GET') {
                return sendJson(res, 200, { ok: true, sites: store.list(), file: store.file() });
            }
            if (p.startsWith('/sites/')) {
                const action = p.slice('/sites/'.length);
                return await handleSites(req, res, action, store, dataDir);
            }
            if (p === '/prefs' && req.method === 'GET') {
                return sendJson(res, 200, Object.assign({ ok: true }, prefs.all(), { file: prefs.file() }));
            }
            if (p.startsWith('/prefs/')) {
                return await handlePrefs(req, res, p.slice('/prefs/'.length), prefs);
            }
            if (p.startsWith('/spider/')) {
                const parts = p.slice('/spider/'.length).split('/').filter(Boolean);
                if (parts.length < 3) return sendJson(res, 400, { err: '路由应为 /spider/{key}/{type}/{action}' });
                return await handleSpider(req, res, parts, store, dataDir, log);
            }
            return sendJson(res, 404, { err: 'not found: ' + p });
        } catch (e) {
            log('[error] ' + (e && e.stack ? e.stack : String(e)));
            return sendErr(res, e);
        }
    });
};
