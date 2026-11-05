'use strict';
/*
 * 播放历史 / 收藏 / 设置 的持久化。
 * 放在 Node 侧而不是 RN 侧，是为了不额外引 AsyncStorage 这个原生依赖
 * （每多一个 pod，iOS 构建失败面就大一截）。
 */
const fs = require('fs');
const path = require('path');

const HISTORY_MAX = 500;

module.exports = function createPrefs(dir) {
    const file = path.join(dir, 'prefs.json');
    let data = null;

    function blank() {
        return { history: [], favorites: [], settings: {} };
    }

    function load() {
        try {
            const o = JSON.parse(fs.readFileSync(file, 'utf8'));
            return {
                history: Array.isArray(o.history) ? o.history : [],
                favorites: Array.isArray(o.favorites) ? o.favorites : [],
                settings: o.settings && typeof o.settings === 'object' ? o.settings : {},
            };
        } catch (e) {
            return null;
        }
    }

    function save() {
        const tmp = file + '.tmp';
        try {
            fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
            fs.renameSync(tmp, file);
            return true;
        } catch (e) {
            return false;
        }
    }

    data = load() || blank();

    const idOf = (x) => String(x.siteKey || '') + '|' + String(x.vodId || '');

    return {
        all() {
            return data;
        },

        settings() {
            return data.settings;
        },

        setSettings(patch) {
            data.settings = Object.assign({}, data.settings, patch || {});
            save();
            return data.settings;
        },

        history() {
            return data.history.slice(0, HISTORY_MAX);
        },

        /** 同一条目重复播放就更新位置，不堆重复记录。 */
        touchHistory(item) {
            if (!item || !item.vodId) return data.history;
            const id = idOf(item);
            const rec = {
                id,
                siteKey: item.siteKey || '',
                siteName: item.siteName || '',
                vodId: String(item.vodId),
                vodName: item.vodName || '',
                vodPic: item.vodPic || '',
                flag: item.flag || '',
                epName: item.epName || '',
                epIndex: Number(item.epIndex) || 0,
                position: Number(item.position) || 0,
                duration: Number(item.duration) || 0,
                updatedAt: Date.now(),
            };
            data.history = [rec].concat(data.history.filter((x) => x.id !== id)).slice(0, HISTORY_MAX);
            save();
            return data.history;
        },

        removeHistory(id) {
            const n = data.history.length;
            data.history = data.history.filter((x) => x.id !== id);
            save();
            return data.history.length !== n;
        },

        clearHistory() {
            data.history = [];
            save();
            return true;
        },

        favorites() {
            return data.favorites;
        },

        isFav(item) {
            if (!item || !item.vodId) return false;
            const id = idOf(item);
            return data.favorites.some((x) => x.id === id);
        },

        toggleFav(item) {
            if (!item || !item.vodId) return { fav: false };
            const id = idOf(item);
            const has = data.favorites.some((x) => x.id === id);
            if (has) {
                data.favorites = data.favorites.filter((x) => x.id !== id);
            } else {
                data.favorites = [
                    {
                        id,
                        siteKey: item.siteKey || '',
                        siteName: item.siteName || '',
                        vodId: String(item.vodId),
                        vodName: item.vodName || '',
                        vodPic: item.vodPic || '',
                        addedAt: Date.now(),
                    },
                ].concat(data.favorites);
            }
            save();
            return { fav: !has, total: data.favorites.length };
        },

        file() {
            return file;
        },
    };
};
