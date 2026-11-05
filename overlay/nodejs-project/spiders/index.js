'use strict';
/*
 * spider 注册表。按 type 号段分发，type 与被 store.TYPE 保持一致。
 * key 是站点实例的唯一标识（store 生成的 uid），不等于 spider 名；
 * spider 名由 site.ext 之外的字段决定不了，所以这里用 site 上的 spider 字段兜底。
 */
const maccms = require('./maccms');
const direct = require('./direct');
const custom = require('./custom');

const BY_NAME = { maccms, direct, custom };
const BY_TYPE = { 1: maccms, 4: direct, 9: custom };

function resolve(site) {
    if (!site) throw new Error('站点不存在');
    // site.spider 显式指定优先（同一 type 下有多个实现时用得上）
    if (site.spider && BY_NAME[site.spider]) return BY_NAME[site.spider];
    const sp = BY_TYPE[Number(site.type)];
    if (!sp) throw new Error('不支持的站点类型: ' + site.type);
    return sp;
}

module.exports = { resolve, BY_NAME, BY_TYPE };
