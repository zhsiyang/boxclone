'use strict';
/*
 * 苹果CMS v10 通用采集 spider。
 * 协议：GET {base}/api.php/provide/vod/?ac=<list|detail>&...
 *   ac=list                 -> 分类表 + 首页
 *   ac=detail&t=<type>&pg=n -> 分类内容
 *   ac=detail&ids=<id>      -> 详情
 *   ac=detail&wd=<kw>&pg=n  -> 搜索
 * 只认 JSON 响应（站点若不支持 JSON 会在解析阶段明确报错，不静默返回空）。
 */

const UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const TIMEOUT = 15000;

function joinUrl(base, ext) {
    let b = String(base || '').trim().replace(/\/+$/, '');
    if (!b) throw new Error('站点未配置地址');
    if (!/^https?:\/\//i.test(b)) b = 'http://' + b;
    const e = String(ext || '').trim().replace(/^\/+/, '');
    return e ? b + '/' + e : b;
}

function apiUrl(site) {
    // ext 可覆盖默认采集路径，例如 "api.php/provide/vod" 或自定义目录
    const p = site && site.ext ? site.ext : 'api.php/provide/vod';
    return joinUrl(site && site.url, p);
}

async function request(site, params) {
    const u = apiUrl(site) + '/?' + params;
    const headers = Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, site.headers || {});
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    let resp;
    try {
        resp = await fetch(u, { headers, signal: ctrl.signal });
    } catch (e) {
        throw new Error('请求失败: ' + (e && e.message ? e.message : String(e)));
    } finally {
        clearTimeout(timer);
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const head = text.slice(0, 200).trim();
    if (head.startsWith('<')) {
        // 绝大多数情况是站点只开了 XML，或采集路径填错打到了网页
        throw new Error('响应不是 JSON（站点可能仅支持 XML，或采集路径错误）');
    }
    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        throw new Error('JSON 解析失败: ' + (e && e.message ? e.message : String(e)));
    }
    return json;
}

function cleanVod(v) {
    // 统一成 CatVod 字段名，缺的补空串，避免 App 端到处判空
    return {
        vod_id: v.vod_id != null ? v.vod_id : v.id,
        vod_name: v.vod_name || '',
        vod_pic: v.vod_pic || v.vod_pic_slide || '',
        vod_remarks: v.vod_remarks || '',
        vod_year: v.vod_year || '',
        vod_area: v.vod_area || '',
        vod_lang: v.vod_lang || '',
        vod_actor: v.vod_actor || '',
        vod_director: v.vod_director || '',
        vod_content: String(v.vod_content || v.vod_blurb || '').replace(/<[^>]+>/g, '').trim(),
        type_name: v.type_name || v.vod_class || '',
        vod_time: v.vod_time || '',
        vod_play_from: v.vod_play_from || '',
        vod_play_url: v.vod_play_url || '',
    };
}

function classes(json) {
    const arr = json.class || json.classes || [];
    return (Array.isArray(arr) ? arr : []).map((c) => ({
        type_id: c.type_id != null ? c.type_id : c.id,
        type_name: c.type_name || c.name || '',
    }));
}

function listPage(json) {
    const arr = Array.isArray(json.list) ? json.list : [];
    return {
        page: Number(json.page) || 1,
        pagecount: Number(json.pagecount) || 1,
        limit: Number(json.limit) || arr.length || 20,
        total: Number(json.total) || arr.length,
        list: arr.map(cleanVod),
    };
}

async function init() {
    // 无状态，无需握手
    return {};
}

async function home(ctx) {
    const json = await request(ctx.site, 'ac=list');
    const p = listPage(json);
    return { class: classes(json), list: p.list };
}

async function category(ctx) {
    const { id, page } = ctx.body || {};
    const pg = Number(page) || 1;
    const params = 'ac=detail&pg=' + pg + (id != null && id !== '' ? '&t=' + encodeURIComponent(id) : '');
    const json = await request(ctx.site, params);
    return listPage(json);
}

async function detail(ctx) {
    const ids = ctx.body && ctx.body.id;
    const idStr = Array.isArray(ids) ? ids.join(',') : String(ids == null ? '' : ids);
    if (!idStr) throw new Error('缺少 id');
    const json = await request(ctx.site, 'ac=detail&ids=' + encodeURIComponent(idStr));
    const arr = Array.isArray(json.list) ? json.list : [];
    if (!arr.length) throw new Error('未取到详情');
    return { list: arr.map(cleanVod) };
}

async function play(ctx) {
    // 苹果CMS 的 vod_play_url 里已是可直接播放的地址（m3u8/mp4），
    // parse:0 表示交给播放器直读，不再二次解析。
    const id = String((ctx.body && ctx.body.id) || '');
    if (!id) throw new Error('缺少播放地址');
    return { parse: 0, url: id };
}

async function search(ctx) {
    const { wd, page } = ctx.body || {};
    const pg = Number(page) || 1;
    if (!wd) return { page: 1, pagecount: 1, limit: 0, total: 0, list: [] };
    const json = await request(ctx.site, 'ac=detail&wd=' + encodeURIComponent(wd) + '&pg=' + pg);
    return listPage(json);
}

module.exports = {
    key: 'maccms',
    name: '苹果CMS',
    type: 1,
    init,
    home,
    category,
    detail,
    play,
    search,
};
