'use strict';
/*
 * 直链 / 推送 spider。
 * 两种用法：
 *   1) site.url 直接填一条 m3u8 / mp4 地址
 *   2) site.ext 填多行，每行格式 "名称$地址"，做成片单
 * 全部 parse:0，不做二次解析。
 */

function parseExt(ext, fallbackUrl) {
    const raw = String(ext || '').trim();
    const out = [];
    if (!raw) {
        const u = String(fallbackUrl || '').trim();
        if (u) out.push({ name: u.split('/').pop() || u, url: u });
        return out;
    }
    raw.split(/\r?\n/).forEach((line) => {
        const s = line.trim();
        if (!s || s.startsWith('#')) return;
        // 编号按「有效条目数」算，不按原始行号：跳过注释后行号会错位
        const n = out.length + 1;
        const idx = s.indexOf('$');
        if (idx > 0) out.push({ name: s.slice(0, idx).trim() || '第' + n + '集', url: s.slice(idx + 1).trim() });
        else out.push({ name: '第' + n + '集', url: s });
    });
    return out;
}

function toVod(item, i) {
    return {
        vod_id: item.url,
        vod_name: item.name,
        vod_pic: '',
        vod_remarks: '直链',
        vod_content: '直链播放：' + item.url,
        type_name: '推送',
        vod_play_from: '直链',
        vod_play_url: item.name + '$' + item.url,
        _order: i,
    };
}

async function init() {
    return {};
}

async function home(ctx) {
    const items = parseExt(ctx.site.ext, ctx.site.url);
    return {
        class: [{ type_id: 'all', type_name: '全部' }],
        list: items.map(toVod),
    };
}

async function category(ctx) {
    const items = parseExt(ctx.site.ext, ctx.site.url);
    return { page: 1, pagecount: 1, limit: items.length, total: items.length, list: items.map(toVod) };
}

async function detail(ctx) {
    const id = String((ctx.body && ctx.body.id) || '');
    if (!id) throw new Error('缺少 id');
    const items = parseExt(ctx.site.ext, ctx.site.url);
    // id 命中片单则回片单条目，否则当成裸地址
    const hit = items.find((x) => x.url === id);
    return { list: [toVod(hit || { name: id.split('/').pop() || id, url: id }, 0)] };
}

async function play(ctx) {
    const id = String((ctx.body && ctx.body.id) || '');
    if (!id) throw new Error('缺少播放地址');
    if (!/^https?:\/\//i.test(id)) throw new Error('不是合法直链: ' + id.slice(0, 60));
    return { parse: 0, url: id };
}

async function search(ctx) {
    const wd = String((ctx.body && ctx.body.wd) || '').trim();
    const items = parseExt(ctx.site.ext, ctx.site.url);
    const hit = wd ? items.filter((x) => x.name.indexOf(wd) >= 0 || x.url.indexOf(wd) >= 0) : items;
    return { page: 1, pagecount: 1, limit: hit.length, total: hit.length, list: hit.map(toVod) };
}

module.exports = {
    key: 'direct',
    name: '直链推送',
    type: 4,
    init,
    home,
    category,
    detail,
    play,
    search,
};
