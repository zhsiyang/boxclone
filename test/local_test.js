'use strict';
/*
 * 本地验证：在桌面 Node 上跑通 Node 端全部逻辑（不依赖 nodejs-mobile）。
 * 做法：起一个假的苹果CMS采集站，把站点指过去，逐个验证 5 个 action。
 *
 * 跑法：node test/local_test.js
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', 'overlay', 'nodejs-project');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'boxclone-'));

let pass = 0;
function ok(name, cond, extra) {
    if (cond) {
        pass++;
        console.log('  ✔ ' + name);
    } else {
        console.error('  ✘ ' + name + (extra ? '  → ' + JSON.stringify(extra) : ''));
        process.exitCode = 1;
    }
}

// ---------- 假采集站 ----------
const VOD = {
    vod_id: 101,
    vod_name: '测试影片',
    vod_pic: 'http://example.com/p.jpg',
    vod_remarks: 'HD中字',
    vod_year: '2026',
    vod_area: '大陆',
    vod_content: '<p>剧情<b>简介</b></p>',
    type_name: '动作片',
    vod_play_from: 'ffm3u8$$$ldm3u8',
    vod_play_url:
        '第01集$http://cdn.example.com/1.m3u8#第02集$http://cdn.example.com/2.m3u8' +
        '$$$第01集$http://cdn2.example.com/1.m3u8#第02集$http://cdn2.example.com/2.m3u8',
};

const mock = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const ac = u.searchParams.get('ac');
    const send = (o, code) => {
        const b = Buffer.from(JSON.stringify(o));
        res.writeHead(code || 200, { 'content-type': 'application/json' });
        res.end(b);
    };
    if (ac === 'list') {
        return send({
            code: 1,
            class: [
                { type_id: 1, type_name: '电影' },
                { type_id: 2, type_name: '连续剧' },
            ],
            list: [VOD],
            page: 1,
            pagecount: 3,
            limit: 20,
            total: 55,
        });
    }
    if (ac === 'detail') {
        if (u.searchParams.get('ids')) return send({ list: [VOD] });
        return send({ list: [VOD, Object.assign({}, VOD, { vod_id: 102, vod_name: '第二部' })], page: 1, pagecount: 3, limit: 20, total: 55 });
    }
    return send({ err: 'unknown' }, 404);
});

// ---------- 启动被测服务 ----------
(async function main() {
    await new Promise((r) => mock.listen(0, '127.0.0.1', r));
    const mockPort = mock.address().port;
    console.log('mock 采集站: http://127.0.0.1:' + mockPort);

    const createStore = require(path.join(ROOT, 'store.js'));
    const { createServer } = require(path.join(ROOT, 'server.js'));

    const store = createStore(DATA);
    console.log('\n[1] store 初始化');
    ok('默认种子站点数=2', store.list().length === 2, store.list());
    ok('sites.json 已落盘', fs.existsSync(path.join(DATA, 'sites.json')));

    const srv = createServer(store, { dataDir: DATA, log: () => {} });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + srv.address().port;
    console.log('被测服务: ' + base);

    const get = async (p) => {
        const r = await fetch(base + p);
        return { status: r.status, body: await r.json() };
    };
    const post = async (p, body) => {
        const r = await fetch(base + p, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        return { status: r.status, body: await r.json() };
    };

    console.log('\n[2] 基础路由');
    let r = await get('/check');
    ok('/check -> {run:true}', r.body.run === true, r.body);

    r = await get('/config');
    ok('/config 有五板块', ['video', 'read', 'comic', 'music', 'pan'].every((k) => r.body[k] && Array.isArray(r.body[k].sites)), Object.keys(r.body));
    ok('/config video 站点数=2', r.body.video.sites.length === 2, r.body.video.sites);
    ok('api 路径格式正确', /^\/spider\/[^/]+\/\d+$/.test(r.body.video.sites[0].api), r.body.video.sites[0].api);

    r = await get('/sites');
    ok('/sites 返回站点', r.body.sites.length === 2);

    console.log('\n[3] 站点 CRUD');
    r = await post('/sites/add', { site: { name: '假采集站', type: 1, url: 'http://127.0.0.1:' + mockPort } });
    ok('add 成功', r.status === 200 && r.body.ok && r.body.site.key, r.body);
    const siteKey = r.body.site.key;

    r = await post('/sites/test', { key: siteKey });
    ok('test 探测到 1 条', r.status === 200 && r.body.count === 1, r.body);
    ok('test 返回分类 2 个', (r.body.class || []).length === 2, r.body.class);

    r = await post('/sites/update', { key: siteKey, patch: { name: '改名后' } });
    ok('update 生效', r.body.site.name === '改名后', r.body.site);
    ok('update 不破坏 key', r.body.site.key === siteKey, r.body.site.key);

    console.log('\n[4] spider 全链路（maccms）');
    const apiPath = '/spider/' + siteKey + '/1';

    r = await post(apiPath + '/init');
    ok('init 200', r.status === 200, r.body);

    r = await post(apiPath + '/home');
    ok('home 有 class', Array.isArray(r.body.class) && r.body.class.length === 2, r.body.class);
    ok('home 有 list', Array.isArray(r.body.list) && r.body.list.length === 1, r.body.list);
    ok('home 的 vod 字段已规范化', r.body.list[0].vod_name === '测试影片' && r.body.list[0].vod_id === 101, r.body.list[0]);
    ok('html 标签已剥离', r.body.list[0].vod_content === '剧情简介', r.body.list[0].vod_content);

    r = await post(apiPath + '/category', { id: 1, page: 1 });
    ok('category 分页字段齐', r.body.page === 1 && r.body.pagecount === 3 && r.body.total === 55, {
        page: r.body.page,
        pagecount: r.body.pagecount,
        total: r.body.total,
    });
    ok('category 返回 2 条', r.body.list.length === 2, r.body.list.length);

    r = await post(apiPath + '/detail', { id: 101 });
    ok('detail 返回 1 部', r.body.list.length === 1, r.body.list);
    ok('detail 保留多线路串', r.body.list[0].vod_play_from.split('$$$').length === 2, r.body.list[0].vod_play_from);
    ok('detail 保留分集串', r.body.list[0].vod_play_url.split('#').length === 3, r.body.list[0].vod_play_url);

    r = await post(apiPath + '/play', { flag: 'ffm3u8', id: 'http://cdn.example.com/1.m3u8' });
    ok('play parse=0', r.body.parse === 0, r.body);
    ok('play 原样回链', r.body.url === 'http://cdn.example.com/1.m3u8', r.body.url);

    r = await post(apiPath + '/search', { wd: '测试', page: 1 });
    ok('search 有结果', Array.isArray(r.body.list) && r.body.list.length === 2, r.body.list.length);

    r = await post(apiPath + '/search', { wd: '', page: 1 });
    ok('空关键词返回空列表不报错', r.body.list.length === 0, r.body);

    console.log('\n[5] 错误路径');
    r = await post('/spider/nope/1/home');
    ok('未知站点 404', r.status === 404, r.status);

    r = await post(apiPath + '/nosuch');
    ok('未知 action 404', r.status === 404, r.status);

    r = await post('/sites/add', { site: { name: '坏站', type: 1, url: 'http://127.0.0.1:1' } });
    const badKey = r.body.site.key;
    r = await post('/spider/' + badKey + '/1/home');
    ok('连不通的站返回 500 且带 err', r.status === 500 && r.body.err, r.body);

    r = await post('/spider/' + badKey + '/1/detail', { id: 1 });
    ok('错误信息可读（含 请求失败）', /请求失败/.test(r.body.err || ''), r.body.err);

    console.log('\n[6] direct spider');
    r = await post('/sites/add', {
        site: {
            name: '直链单条',
            type: 4,
            url: 'http://cdn.example.com/movie.m3u8',
        },
    });
    const dKey = r.body.site.key;
    r = await post('/spider/' + dKey + '/4/home');
    ok('direct home 1 条', r.body.list.length === 1, r.body.list);
    ok('direct 命名为文件名', r.body.list[0].vod_name === 'movie.m3u8', r.body.list[0].vod_name);

    r = await post('/sites/add', {
        site: {
            name: '直链片单',
            type: 4,
            url: '',
            ext: '第一集$http://a.com/1.m3u8\n第二集$http://a.com/2.m3u8\n# 注释行\nhttp://a.com/3.mp4',
        },
    });
    const dKey2 = r.body.site.key;
    r = await post('/spider/' + dKey2 + '/4/home');
    ok('direct 片单解析 3 条（跳过注释）', r.body.list.length === 3, r.body.list.map((x) => x.vod_name));
    ok('direct 无名条目自动编号', r.body.list[2].vod_name === '第3集', r.body.list[2].vod_name);

    r = await post('/spider/' + dKey2 + '/4/play', { id: 'http://a.com/2.m3u8' });
    ok('direct play 直通', r.body.parse === 0 && r.body.url === 'http://a.com/2.m3u8', r.body);

    r = await post('/spider/' + dKey2 + '/4/play', { id: 'javascript:alert(1)' });
    ok('非 http 直链被拒', r.status === 500 && /不是合法直链/.test(r.body.err || ''), r.body);

    console.log('\n[7] custom JS 源');
    const customSrc = `
module.exports = {
  async init(ctx){ return {}; },
  async home(ctx){ return { class:[{type_id:'a',type_name:'全部'}], list:[{ vod_id:'x1', vod_name:'来自自定义源', vod_pic:'', vod_content:'', vod_play_from:'自定义', vod_play_url:'正片$x1' }] }; },
  async category(ctx){ return { page:1, pagecount:1, limit:1, total:1, list:[] }; },
  async detail(ctx){ return { list:[{ vod_id:ctx.body.id, vod_name:'自定义详情', vod_pic:'', vod_content:'', vod_play_from:'自定义', vod_play_url:'正片$'+ctx.body.id }] }; },
  async play(ctx){ return { parse:0, url: ctx.body.id }; },
  async search(ctx){ return { page:1, pagecount:1, limit:0, total:0, list:[] }; },
};
`;
    r = await post('/sites/add', { site: { name: '自定义', type: 9, url: '', ext: customSrc } });
    const cKey = r.body.site.key;
    r = await post('/spider/' + cKey + '/9/home');
    ok('custom home 跑通', r.body.list && r.body.list[0].vod_name === '来自自定义源', r.body);

    r = await post('/spider/' + cKey + '/9/detail', { id: 'zzz' });
    ok('custom detail 拿到 id', r.body.list[0].vod_id === 'zzz', r.body.list);

    r = await post('/spider/' + cKey + '/9/play', { id: 'http://v.com/x.m3u8' });
    ok('custom play 透传', r.body.url === 'http://v.com/x.m3u8', r.body);

    // 脚本改了要立即生效（require 缓存已清理）
    r = await post('/sites/update', {
        key: cKey,
        patch: { ext: customSrc.replace('来自自定义源', '改完立即生效') },
    });
    r = await post('/spider/' + cKey + '/9/home');
    ok('custom 改源码后热生效', r.body.list[0].vod_name === '改完立即生效', r.body.list[0]);

    console.log('\n[8] 导出 / 导入 / 删除');
    r = await post('/sites/export');
    ok('export 返回全部站点', r.body.sites.length === 7, r.body.sites.length);

    const dump = r.body.sites.map((s) => ({ name: s.name, type: s.type, url: s.url, ext: s.ext }));
    r = await post('/sites/reset');
    ok('reset 回到 2 条', r.body.sites.length === 2, r.body.sites.length);

    r = await post('/sites/import', { sites: dump });
    // 空模板（既无 url 也无 ext）本就该被 import 跳过，按有效条目数比
    const effective = dump.filter((s) => s.url || s.ext).length;
    ok('import 跳过空模板', r.body.imported < dump.length, { imported: r.body.imported, dump: dump.length });
    ok('import 恢复有效站点', r.body.imported === effective, { imported: r.body.imported, effective });

    // import 会重建 key，删必须用返回里的新 key
    const importedSites = r.body.sites || [];
    const lastKey = importedSites[importedSites.length - 1].key;
    const beforeCount = importedSites.length;
    r = await post('/sites/remove', { key: lastKey });
    ok('remove 成功', r.body.ok === true, r.body);

    r = await get('/sites');
    ok('remove 后数量 -1', r.body.sites.length === beforeCount - 1, r.body.sites.length);

    // 原子写：不该留下 .tmp
    ok('无残留 .tmp 文件', !fs.existsSync(path.join(DATA, 'sites.json.tmp')));

    console.log('\n=========================================');
    console.log(pass + ' 项通过' + (process.exitCode ? '，有失败' : '，全部通过'));
    console.log('dataDir = ' + DATA);
    srv.close();
    mock.close();
})().catch((e) => {
    console.error('测试脚本异常:', e);
    process.exit(1);
});
