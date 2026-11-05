/**
 * 本地服务的 HTTP 封装。所有网络请求都从这里出，方便统一加超时和错误归一化。
 */
import NodeService from '../node/NodeService';
import { REQ_TIMEOUT } from '../config';

export type Site = {
    key: string;
    name: string;
    type: number;
    url: string;
    ext?: string;
    enabled?: boolean;
    order?: number;
    headers?: Record<string, string>;
    /** 由 /config 下发的完整 api 前缀，缺省时按 key+type 现拼 */
    apiPath?: string;
};

export type Vod = {
    vod_id: string | number;
    vod_name: string;
    vod_pic?: string;
    vod_remarks?: string;
    vod_year?: string;
    vod_area?: string;
    vod_content?: string;
    type_name?: string;
    vod_play_from?: string;
    vod_play_url?: string;
    vod_time?: string;
    /** 搜索结果里标记来源站点 */
    _siteKey?: string;
    _siteName?: string;
};

export type CatConfig = {
    video?: { sites: Site[] };
    read?: { sites: Site[] };
    comic?: { sites: Site[] };
    music?: { sites: Site[] };
    pan?: { sites: Site[] };
};

type ReqOpts = { method?: 'GET' | 'POST'; body?: any; timeout?: number };

async function req<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
    const base = await NodeService.getBaseUrl();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || REQ_TIMEOUT);
    let resp: Response;
    try {
        resp = await fetch(base + path, {
            method: opts.method || (opts.body ? 'POST' : 'GET'),
            headers: opts.body ? { 'content-type': 'application/json' } : undefined,
            body: opts.body ? JSON.stringify(opts.body) : undefined,
            signal: ctrl.signal as any,
        });
    } catch (e: any) {
        clearTimeout(timer);
        if (e?.name === 'AbortError') throw new Error('请求超时');
        throw new Error('连不上本地服务: ' + String(e?.message || e));
    } finally {
        clearTimeout(timer);
    }
    const text = await resp.text();
    let json: any;
    try {
        json = text ? JSON.parse(text) : {};
    } catch (e) {
        throw new Error('响应非 JSON: ' + text.slice(0, 120));
    }
    if (!resp.ok) throw new Error(json?.err || json?.msg || `HTTP ${resp.status}`);
    return json as T;
}

// ---------------- 配置 / 站点 ----------------

export const Api = {
    getConfig: () => req<CatConfig>('/config'),

    listSites: () => req<{ ok: boolean; sites: Site[]; file: string }>('/sites'),

    addSite: (site: Partial<Site>) => req<{ ok: boolean; site: Site }>('/sites/add', { body: { site } }),

    updateSite: (key: string, patch: Partial<Site>) =>
        req<{ ok: boolean; site: Site }>('/sites/update', { body: { key, patch } }),

    removeSite: (key: string) => req<{ ok: boolean }>('/sites/remove', { body: { key } }),

    resetSites: () => req<{ ok: boolean; sites: Site[] }>('/sites/reset', { body: {} }),

    exportSites: () => req<{ ok: boolean; sites: Site[]; file: string }>('/sites/export', { body: {} }),

    importSites: (sites: Partial<Site>[]) =>
        req<{ ok: boolean; imported: number; sites: Site[] }>('/sites/import', { body: { sites } }),

    /** 探测站点可用性，返回分类和样本。失败会 throw，带上真实原因。 */
    testSite: (key: string) =>
        req<{ ok: boolean; count: number; class: { type_id: any; type_name: string }[]; sample: string[] }>(
            '/sites/test',
            { body: { key }, timeout: 25000 }
        ),

    // ---------------- spider ----------------

    init: (site: Site) => req(`${site.apiPath || '/spider/' + site.key + '/' + site.type}/init`, { body: {} }),

    home: (site: Site) =>
        req<{ class?: { type_id: any; type_name: string }[]; list?: Vod[] }>(`${apiPath(site)}/home`, {
            body: {},
        }),

    category: (site: Site, id: any, page = 1) =>
        req<{ page: number; pagecount: number; limit: number; total: number; list: Vod[] }>(
            `${apiPath(site)}/category`,
            { body: { id, page } }
        ),

    detail: (site: Site, id: string | number) =>
        req<{ list: Vod[] }>(`${apiPath(site)}/detail`, { body: { id } }),

    play: (site: Site, flag: string, id: string) =>
        req<{ parse: number; url: string; header?: any }>(`${apiPath(site)}/play`, { body: { flag, id } }),

    search: (site: Site, wd: string, page = 1) =>
        req<{ page: number; pagecount: number; limit: number; total: number; list: Vod[] }>(
            `${apiPath(site)}/search`,
            { body: { wd, page } }
        ),

    // ---------------- 偏好 ----------------

    getPrefs: () => req<{ settings: any; history: any[]; favorites: any[]; file: string }>('/prefs'),

    setSettings: (patch: any) => req<{ ok: boolean; settings: any }>('/prefs/settings', { body: { patch } }),

    touchHistory: (item: any) => req<{ ok: boolean; history: any[] }>('/prefs/history', { body: { item } }),

    removeHistory: (id: string) => req<{ ok: boolean; history: any[] }>('/prefs/history/remove', { body: { id } }),

    clearHistory: () => req<{ ok: boolean }>('/prefs/history/clear', { body: {} }),

    toggleFav: (item: any) => req<{ ok: boolean; fav: boolean; total: number }>('/prefs/fav', { body: { item } }),
};

/** 站点对应的 api 前缀。key 由服务端生成，路径固定为 /spider/{key}/{type} */
export function apiPath(site: Site): string {
    return site.apiPath || `/spider/${site.key}/${site.type}`;
}

// ---------------- 业务解析 ----------------

export type Episode = { name: string; id: string };
export type PlayLine = { from: string; episodes: Episode[] };

/**
 * 拆 vod_play_from / vod_play_url。
 * 结构：线路用 $$$ 分隔，分集用 # 分隔，分集内 "名称$地址"。
 * 两侧段数不一致时以短的为准（有的采集站会把空线路也塞进来）。
 */
export function splitPlay(vod: Vod | null | undefined): PlayLine[] {
    if (!vod) return [];
    const froms = String(vod.vod_play_from || '').split('$$$');
    const urls = String(vod.vod_play_url || '').split('$$$');
    const n = Math.min(froms.length, urls.length);
    const out: PlayLine[] = [];
    for (let i = 0; i < n; i++) {
        const episodes = String(urls[i] || '')
            .split('#')
            .filter(Boolean)
            .map((seg) => {
                const idx = seg.indexOf('$');
                return idx >= 0
                    ? { name: seg.slice(0, idx) || seg, id: seg.slice(idx + 1) }
                    : { name: seg, id: seg };
            })
            .filter((e) => !!e.id);
        if (episodes.length) out.push({ from: (froms[i] || '线路' + (i + 1)).trim(), episodes });
    }
    return out;
}

export type Quality = { label: string; url: string };

/**
 * play 返回的 url 可能是：
 *   字符串直链 / "标签,URL,标签,URL" 逗号对 / 数组 / 数组的数组
 * 统一成 [{label,url}]。
 */
export function parsePlayUrl(u: any): Quality[] {
    if (Array.isArray(u)) {
        const flat: string[] = [];
        u.forEach((x) => {
            if (Array.isArray(x)) x.forEach((y: any) => flat.push(String(y)));
            else flat.push(String(x));
        });
        if (flat.length >= 2) {
            const out: Quality[] = [];
            for (let i = 0; i + 1 < flat.length; i += 2) out.push({ label: flat[i], url: flat[i + 1] });
            if (out.length) return out;
        }
        if (flat.length === 1) return [{ label: '默认', url: flat[0] }];
        return [];
    }
    if (typeof u === 'string' && u) {
        if (/,\s*https?:\/\//.test(u)) {
            const parts = u.split(',');
            const out: Quality[] = [];
            for (let i = 0; i + 1 < parts.length; i += 2) out.push({ label: parts[i].trim(), url: parts[i + 1].trim() });
            if (out.length) return out;
        }
        return [{ label: '默认', url: u }];
    }
    return [];
}

/** 并发跑多个站点，单个站点失败不影响其它（搜索/首页都要这个语义）。 */
export async function settleAll<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency = 4
): Promise<{ ok: R[]; fail: { item: T; err: string }[] }> {
    const ok: R[] = [];
    const fail: { item: T; err: string }[] = [];
    let cursor = 0;

    async function worker() {
        while (cursor < items.length) {
            const i = cursor++;
            const it = items[i];
            try {
                ok.push(await fn(it));
            } catch (e: any) {
                fail.push({ item: it, err: String(e?.message || e) });
            }
        }
    }

    const n = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: n }, () => worker()));
    return { ok, fail };
}
