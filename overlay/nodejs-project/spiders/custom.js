'use strict';
/*
 * 外部 JS 源加载器。
 *
 * 契约（比 CatVodOpen 的 fastify 插件式更简单，零依赖即可跑）：
 *
 *   module.exports = {
 *     async init(ctx)              -> object|void
 *     async home(ctx)              -> { class:[{type_id,type_name}], list:[vod] }
 *     async category(ctx)          -> { page, pagecount, limit, total, list:[vod] }
 *     async detail(ctx)            -> { list:[vod] }
 *     async play(ctx)              -> { parse:0|1, url }
 *     async search(ctx)            -> { page, pagecount, limit, total, list:[vod] }
 *   }
 *
 * ctx = {
 *   site,            // 当前站点对象（url / ext / headers）
 *   body,            // 请求体
 *   fetch,           // 全局 fetch（Node18 内置）
 *   require,         // Node require
 *   buffer,          // Buffer
 *   log(...args)     // 打回 App 日志面板
 * }
 *
 * 源码来源优先级：
 *   1) site.ext 非空        -> ext 当作 JS 源码，落盘到 scripts/<key>.js 后 require
 *   2) <dataDir>/scripts/<key>.js 存在 -> 直接 require
 * 这样热更新只要改 ext 即可，不必重装 App。
 */
const fs = require('fs');
const path = require('path');

const ACTIONS = ['init', 'home', 'category', 'detail', 'play', 'search'];

function isFastifyPlugin(mod) {
    return mod && typeof mod.api === 'function' && !mod.home && !mod.detail;
}

function buildCtx(ctx) {
    return {
        site: ctx.site,
        body: ctx.body || {},
        fetch: globalThis.fetch,
        require,
        buffer: Buffer,
        log: (...a) => ctx.log(...a),
    };
}

function loadModule(ctx) {
    const site = ctx.site;
    const dir = path.join(ctx.dataDir, 'scripts');
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
    const file = path.join(dir, String(site.key) + '.js');

    let code = String(site.ext || '').trim();
    if (code) {
        // 源码变了才重写，减少 IO；同时清理 require 缓存，保证改完立即生效
        let old = '';
        try {
            old = fs.readFileSync(file, 'utf8');
        } catch (e) {}
        if (old !== code) fs.writeFileSync(file, code);
    }

    if (!fs.existsSync(file)) {
        throw new Error('该源没有脚本：请在站点设置里粘贴 JS 源码，或把文件放到 scripts/' + site.key + '.js');
    }
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    if (isFastifyPlugin(mod)) {
        throw new Error('这是 CatVodOpen 的 fastify 插件式源，本运行时只支持简化契约（导出 home/category/detail/play/search）');
    }
    return mod;
}

function pick(mod, name) {
    if (!mod || typeof mod[name] !== 'function') {
        throw new Error('脚本未实现 ' + name + '()');
    }
    return mod[name];
}

const spider = {
    key: 'custom',
    name: '自定义JS',
    type: 9,

    async init(ctx) {
        const mod = loadModule(ctx);
        ctx.__mod = mod;
        if (typeof mod.init === 'function') return mod.init(buildCtx(ctx));
        return {};
    },

    async home(ctx) {
        const mod = loadModule(ctx);
        return pick(mod, 'home')(buildCtx(ctx));
    },

    async category(ctx) {
        const mod = loadModule(ctx);
        return pick(mod, 'category')(buildCtx(ctx));
    },

    async detail(ctx) {
        const mod = loadModule(ctx);
        return pick(mod, 'detail')(buildCtx(ctx));
    },

    async play(ctx) {
        const mod = loadModule(ctx);
        const r = await pick(mod, 'play')(buildCtx(ctx));
        if (!r || !r.url) throw new Error('play() 未返回 url');
        return { parse: Number(r.parse) === 1 ? 1 : 0, url: String(r.url), header: r.header || null };
    },

    async search(ctx) {
        const mod = loadModule(ctx);
        return pick(mod, 'search')(buildCtx(ctx));
    },
};

module.exports = spider;
module.exports.ACTIONS = ACTIONS;
