/**
 * Metro 配置。
 * 关键点：把 nodejs-assets 整个目录 block 掉。
 * 那里面的代码是给内嵌 Node 跑的（含 require('rn-bridge')、fs、http 之类），
 * Metro 解析不了，也不该被打进 RN bundle。
 */
const path = require('path');
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
    const config = await getDefaultConfig(__dirname);
    config.resolver.blockList = [/nodejs-assets\/nodejs-project\/.*/];
    return config;
})();
