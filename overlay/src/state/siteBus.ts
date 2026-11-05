/**
 * 极简事件总线：片库页选了源之后，要通知首页换源并切回首页 tab。
 * 首页和片库是兄弟页，没共同父级 state，用一个模块级订阅比往 Tabs 里塞一堆回调干净。
 * 订阅返回退订函数，页面卸载时清掉，避免热重载后重复触发。
 */
import type { Site } from '../api/CatApi';

type Fn = (s: Site) => void;

let subs: Fn[] = [];

export function onSwitchSite(fn: Fn): () => void {
    subs = subs.concat(fn);
    return () => {
        subs = subs.filter((x) => x !== fn);
    };
}

export function switchSite(site: Site): number {
    const list = subs;
    list.forEach((f) => {
        try {
            f(site);
        } catch (e) {
            /* 单个订阅抛错不影响其它订阅者 */
        }
    });
    return list.length;
}
