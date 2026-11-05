'use strict';
/*
 * 站点配置持久化。零依赖，落在 App 的 Documents 目录。
 * 单文件 JSON，写完即刷盘：iOS 上进程可能被随时 kill，不能只留内存态。
 */
const fs = require('fs');
const path = require('path');

// 站点类型号段沿用 CatVod 约定，App 端 /config 按此分流到不同板块
const TYPE = {
    VIDEO: 1,   // 苹果CMS / 通用影视采集
    DIRECT: 4,  // 直链 / m3u8 推送
    CUSTOM: 9,  // 外部 JS 源（用户导入）
    READ: 10,
    COMIC: 20,
    MUSIC: 30,
    PAN: 40,
};

function uid() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function template(key, name, type) {
    return {
        key,
        name,
        type,
        url: '',
        enabled: true,
        // ext 留给 spider 自己用：maccms 存 api 路径，custom 存脚本正文
        ext: '',
        headers: {},
        order: 0,
    };
}

module.exports = function createStore(dir) {
    const file = path.join(dir, 'sites.json');
    let sites = [];

    function read() {
        try {
            const raw = fs.readFileSync(file, 'utf8');
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return null;
        }
    }

    function save() {
        // 原子写：先落 .tmp 再 rename，避免写一半被 kill 留下坏 JSON
        const tmp = file + '.tmp';
        try {
            fs.writeFileSync(tmp, JSON.stringify(sites, null, 2));
            fs.renameSync(tmp, file);
            return true;
        } catch (e) {
            return false;
        }
    }

    function seed() {
        // 只给空模板，不预置任何具体站点地址：地址由用户自己填。
        sites = [
            template('maccms', '苹果CMS源', TYPE.VIDEO),
            template('direct', '直链/推送', TYPE.DIRECT),
        ];
        sites[0].order = 0;
        sites[1].order = 1;
        save();
    }

    sites = read();
    if (!sites) seed();
    if (!sites.length) seed();

    const api = {
        TYPE,
        list() {
            return sites.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        },
        enabled() {
            return api.list().filter((s) => s.enabled && s.url);
        },
        get(key) {
            return sites.find((s) => s.key === key) || null;
        },
        add(obj) {
            const s = Object.assign(template('site', '新站点', TYPE.VIDEO), obj || {});
            s.key = uid();
            s.order = sites.length;
            sites.push(s);
            save();
            return s;
        },
        update(key, patch) {
            const s = api.get(key);
            if (!s) return null;
            Object.assign(s, patch || {}, { key: s.key }); // key 不可改，它是路由的一部分
            save();
            return s;
        },
        remove(key) {
            const n = sites.length;
            sites = sites.filter((s) => s.key !== key);
            save();
            return sites.length !== n;
        },
        reorder(keys) {
            if (!Array.isArray(keys)) return false;
            keys.forEach((k, i) => {
                const s = api.get(k);
                if (s) s.order = i;
            });
            save();
            return true;
        },
        reset() {
            seed();
            return sites;
        },
        // 落盘路径暴露出来，方便 App 端做「导出配置」
        file() {
            return file;
        },
    };

    return api;
};
