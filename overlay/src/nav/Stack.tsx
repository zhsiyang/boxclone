/**
 * 极简栈式导航。不引 react-navigation：
 * 少一个带原生 pod 的依赖，iOS 构建失败面小一圈；这个 App 的页面跳转也就「进/退」两种。
 *
 * 用法：
 *   <NavProvider><Shell /></NavProvider>
 *   屏幕里 const nav = useNav(); nav.push('Detail', {site, vod})
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

export type RouteName =
    | 'Boot'
    | 'Tabs'
    | 'Category'
    | 'Detail'
    | 'Player'
    | 'Search'
    | 'Sites'
    | 'SiteEdit'
    | 'History'
    | 'Favorites'
    | 'Diagnostics'
    | 'About';

export type Route = { name: RouteName; params?: any; key: string };

type NavApi = {
    stack: Route[];
    current: Route;
    push: (name: RouteName, params?: any) => void;
    pop: () => void;
    /** 替换栈顶，用于 Boot -> Tabs 这种不该回退的切换 */
    replace: (name: RouteName, params?: any) => void;
    reset: (name: RouteName, params?: any) => void;
    canGoBack: boolean;
};

const NavCtx = createContext<NavApi | null>(null);

let seq = 0;
const mk = (name: RouteName, params?: any): Route => ({ name, params, key: `${name}-${++seq}` });

export function NavProvider({ children }: { children: React.ReactNode }) {
    const [stack, setStack] = useState<Route[]>([mk('Boot')]);
    const stackRef = useRef(stack);
    stackRef.current = stack;

    const push = useCallback((name: RouteName, params?: any) => {
        setStack((s) => s.concat(mk(name, params)));
    }, []);

    const pop = useCallback(() => {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    }, []);

    const replace = useCallback((name: RouteName, params?: any) => {
        setStack((s) => (s.length ? s.slice(0, -1).concat(mk(name, params)) : [mk(name, params)]));
    }, []);

    const reset = useCallback((name: RouteName, params?: any) => {
        setStack([mk(name, params)]);
    }, []);

    // Android 物理返回键（本项目主要跑 iOS，这里只是别让调试机的返回键失灵）
    React.useEffect(() => {
        if (Platform.OS !== 'android') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (stackRef.current.length > 1) {
                pop();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [pop]);

    const value = useMemo<NavApi>(
        () => ({
            stack,
            current: stack[stack.length - 1],
            push,
            pop,
            replace,
            reset,
            canGoBack: stack.length > 1,
        }),
        [stack, push, pop, replace, reset]
    );

    return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav(): NavApi {
    const v = useContext(NavCtx);
    if (!v) throw new Error('useNav 必须在 NavProvider 内使用');
    return v;
}
