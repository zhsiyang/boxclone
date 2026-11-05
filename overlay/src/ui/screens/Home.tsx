/**
 * 首页：顶部搜索 + 频道横滑 + 主视觉轮播 + 三列海报网格。
 *
 * 频道第一个是「推荐」，走站点 home 接口（一次给分类 + 一批内容，不分页）；
 * 其余频道是站点分类，走 category 接口，滚到底自动翻页。
 * 换源入口收在右上角四宫格里，主界面保持参考稿那种只剩搜索和内容的干净版式。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Api, Site, Vod } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Btn, Empty, ErrBox, Loading } from '../components/Common';
import { Banner } from '../components/Banner';
import { Poster } from '../components/Poster';
import { IconGrid, IconSearch } from '../components/Icons';
import { onSwitchSite } from '../../state/siteBus';
import { TABBAR_SPACE, T } from '../../theme';

const COLS = 3;
const BANNER_MAX = 6;
type Cls = { type_id: any; type_name: string };

export default function Home({ active, onOpenSearch }: { active: boolean; onOpenSearch?: () => void }) {
    const nav = useNav();
    const [sites, setSites] = useState<Site[]>([]);
    const [cur, setCur] = useState<Site | null>(null);
    const [classes, setClasses] = useState<Cls[]>([]);
    const [tab, setTab] = useState(0); // 0 = 推荐，1..n = classes[tab-1]
    const [list, setList] = useState<Vod[]>([]);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [err, setErr] = useState('');
    const [sitePick, setSitePick] = useState(false);
    const inited = useRef(false);
    // 请求序号：快速点频道/换源时，只认最后一次请求的结果，旧响应回来直接丢
    const reqId = useRef(0);

    /** 只拉启用了且有 key 的站点 */
    const loadSites = useCallback(async () => {
        const cfg = await Api.getConfig();
        const vs = ((cfg.video && cfg.video.sites) || []).filter((s: Site) => s.key);
        setSites(vs);
        return vs;
    }, []);

    /** 推荐页：home 接口一次返回分类 + 内容，没有翻页概念 */
    const loadHome = useCallback(async (site: Site, silent = false) => {
        const my = ++reqId.current;
        if (!silent) setLoading(true);
        setErr('');
        try {
            const r = await Api.home(site);
            if (my !== reqId.current) return;
            setClasses(r.class || []);
            setList(r.list || []);
            setPage(1);
            setPageCount(1);
        } catch (e: any) {
            if (my !== reqId.current) return;
            setErr(String(e?.message || e));
            setClasses([]);
            setList([]);
        } finally {
            if (my === reqId.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    /** 分类页：分页拉，append 时不清空已有列表 */
    const loadCat = useCallback(async (site: Site, tid: any, p: number, append: boolean) => {
        const my = ++reqId.current;
        if (append) setMore(true);
        else setLoading(true);
        setErr('');
        try {
            const r = await Api.category(site, tid, p);
            if (my !== reqId.current) return;
            const items = r.list || [];
            setList((old) => (append ? old.concat(items) : items));
            setPage(r.page || p);
            setPageCount(r.pagecount || 1);
        } catch (e: any) {
            if (my !== reqId.current) return;
            setErr(String(e?.message || e));
            if (!append) setList([]);
        } finally {
            if (my === reqId.current) {
                setLoading(false);
                setMore(false);
                setRefreshing(false);
            }
        }
    }, []);

    const boot = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const vs = await loadSites();
            if (!vs.length) {
                setLoading(false);
                setCur(null);
                return;
            }
            setCur(vs[0]);
            await loadHome(vs[0]);
        } catch (e: any) {
            setErr(String(e?.message || e));
            setLoading(false);
        }
    }, [loadSites, loadHome]);

    // 首次进入才加载；从别的 tab 切回来不重拉，省流量也保住位置
    useEffect(() => {
        if (inited.current) return;
        inited.current = true;
        boot();
    }, [boot]);

    // 从「源管理」回来可能改了站点，切回首页时静默核对一次
    useEffect(() => {
        if (!active || !inited.current) return;
        loadSites().then((vs) => {
            if (!vs.length) {
                setSites([]);
                setCur(null);
                setClasses([]);
                setList([]);
                return;
            }
            setSites(vs);
            if (!cur || !vs.find((x) => x.key === cur.key)) {
                setCur(vs[0]);
                loadHome(vs[0]);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    // 片库页选了源会从这里进来
    useEffect(() => {
        return onSwitchSite((s) => {
            setSitePick(false);
            setCur(s);
            setTab(0);
            setList([]);
            setClasses([]);
            loadHome(s);
        });
    }, [loadHome]);

    const pickSite = (s: Site) => {
        setSitePick(false);
        if (cur?.key === s.key) return;
        setCur(s);
        setTab(0);
        setList([]);
        setClasses([]);
        loadHome(s);
    };

    const pickTab = (i: number) => {
        if (i === tab) return;
        setTab(i);
        if (!cur) return;
        if (i === 0) {
            setList([]);
            loadHome(cur);
        } else {
            const c = classes[i - 1];
            if (!c) return;
            setList([]);
            setPage(1);
            setPageCount(1);
            loadCat(cur, c.type_id, 1, false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (!cur) return boot();
        if (tab === 0) loadHome(cur, true);
        else {
            const c = classes[tab - 1];
            if (c) loadCat(cur, c.type_id, 1, false);
        }
    };

    const onEnd = () => {
        if (tab === 0 || !cur || more || loading || page >= pageCount) return;
        const c = classes[tab - 1];
        if (!c) return;
        loadCat(cur, c.type_id, page + 1, true);
    };

    /** 轮播只挑有图的，占位块放到大图上太丑 */
    const banners = useMemo(
        () => (tab === 0 ? list.filter((v) => (v.vod_pic || '').trim()).slice(0, BANNER_MAX) : []),
        [list, tab]
    );

    const sectionTitle = tab === 0 ? '推荐' : classes[tab - 1]?.type_name || '';

    // 没配源：给个明确的重定向，而不是空列表
    if (!loading && !err && !sites.length) {
        return (
            <View style={styles.wrap}>
                <TopBar onSearch={() => (onOpenSearch ? onOpenSearch() : nav.push('Search'))} onPick={() => setSitePick(true)} />
                <Empty
                    text="还没有配置任何源"
                    hint={'去「我的 → 源管理」添加一个苹果CMS采集站，\n或者粘一个自定义 JS 源。'}
                />
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                    <Btn label="去添加源" onPress={() => nav.push('Sites')} />
                </View>
                <SiteSheet visible={sitePick} sites={sites} curKey={cur?.key} onClose={() => setSitePick(false)} onPick={pickSite} onManage={() => { setSitePick(false); nav.push('Sites'); }} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            <TopBar onSearch={() => (onOpenSearch ? onOpenSearch() : nav.push('Search'))} onPick={() => setSitePick(true)} />

            <ChannelRow classes={classes} tab={tab} onPick={pickTab} />

            {loading ? (
                <Loading />
            ) : err ? (
                <ErrBox msg={err} onRetry={() => (cur ? loadHome(cur) : boot())} />
            ) : (
                <FlatList
                    data={list}
                    keyExtractor={(it, i) => String(it.vod_id ?? i) + '_' + i}
                    numColumns={COLS}
                    columnWrapperStyle={styles.colWrap}
                    contentContainerStyle={styles.grid}
                    onEndReached={onEnd}
                    onEndReachedThreshold={0.35}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
                    }
                    ListHeaderComponent={
                        <View>
                            {banners.length ? (
                                <Banner
                                    items={banners}
                                    onPress={(v) => nav.push('Detail', { site: cur, vod: v })}
                                />
                            ) : null}
                            {sectionTitle ? (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                                    {cur ? <Text style={styles.sectionSub} numberOfLines={1}>{cur.name}</Text> : null}
                                </View>
                            ) : null}
                        </View>
                    }
                    ListEmptyComponent={
                        <Empty text="这个源没返回内容" hint="可能采集接口挂了，去源管理点一下测试" />
                    }
                    ListFooterComponent={
                        more ? (
                            <View style={styles.footer}>
                                <ActivityIndicator color={T.primary} size="small" />
                                <Text style={styles.footerText}>加载更多…</Text>
                            </View>
                        ) : tab > 0 && list.length > 0 && page >= pageCount ? (
                            <Text style={styles.endText}>— 没有更多了 —</Text>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <Poster
                            vod={item}
                            cols={COLS}
                            onPress={() => nav.push('Detail', { site: cur, vod: item })}
                        />
                    )}
                />
            )}

            <SiteSheet
                visible={sitePick}
                sites={sites}
                curKey={cur?.key}
                onClose={() => setSitePick(false)}
                onPick={pickSite}
                onManage={() => {
                    setSitePick(false);
                    nav.push('Sites');
                }}
            />
        </View>
    );
}

/* ---------------- 顶部搜索条 ---------------- */

function TopBar({ onSearch, onPick }: { onSearch: () => void; onPick: () => void }) {
    return (
        <View style={styles.topbar}>
            <TouchableOpacity style={styles.searchBox} activeOpacity={0.8} onPress={onSearch}>
                <IconSearch size={16} color={T.text3} />
                <Text style={styles.searchPh}>搜索视频</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridBtn} activeOpacity={0.7} onPress={onPick} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconGrid size={19} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

/* ---------------- 频道行 ---------------- */

function ChannelRow({ classes, tab, onPick }: { classes: Cls[]; tab: number; onPick: (i: number) => void }) {
    const items: Cls[] = [{ type_id: '__rec', type_name: '推荐' } as Cls].concat(classes);
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chRow}
            style={styles.chScroll}
        >
            {items.map((c, i) => {
                const on = tab === i;
                return (
                    <TouchableOpacity
                        key={String(c.type_id) + '_' + i}
                        activeOpacity={0.75}
                        onPress={() => onPick(i)}
                        style={styles.chItem}
                    >
                        <Text style={[styles.chText, on && styles.chTextOn]} numberOfLines={1}>
                            {c.type_name}
                        </Text>
                        {on ? (
                            // 蓝紫渐变用三段色块拼，和参考稿的选中条一致
                            <View style={styles.chBar}>
                                <View style={{ flex: 1, backgroundColor: '#3E63FF' }} />
                                <View style={{ flex: 1, backgroundColor: '#5F5BFF' }} />
                                <View style={{ flex: 1, backgroundColor: '#8A5CFF' }} />
                            </View>
                        ) : (
                            <View style={styles.chBarPlaceholder} />
                        )}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

/* ---------------- 换源面板 ---------------- */

function SiteSheet({
    visible,
    sites,
    curKey,
    onClose,
    onPick,
    onManage,
}: {
    visible: boolean;
    sites: Site[];
    curKey?: string;
    onClose: () => void;
    onPick: (s: Site) => void;
    onManage: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.mask} onPress={onClose}>
                {/* 内层吃掉点击，避免点面板本身也关掉 */}
                <Pressable style={styles.sheet} onPress={() => {}}>
                    <View style={styles.sheetHandle} />
                    <View style={styles.sheetHead}>
                        <Text style={styles.sheetTitle}>选择源</Text>
                        <TouchableOpacity onPress={onManage} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.sheetLink}>源管理</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 8 }}>
                        {sites.length ? (
                            sites.map((s) => {
                                const on = s.key === curKey;
                                return (
                                    <TouchableOpacity key={s.key} activeOpacity={0.75} style={styles.siteRow} onPress={() => onPick(s)}>
                                        <View style={[styles.dot, on && styles.dotOn]} />
                                        <Text style={[styles.siteName, on && { color: T.primary }]} numberOfLines={1}>
                                            {s.name || s.key}
                                        </Text>
                                        {on ? <Text style={styles.siteOn}>当前</Text> : null}
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <Text style={styles.sheetEmpty}>还没有配置源</Text>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },

    topbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: T.pad,
        paddingTop: 6,
        paddingBottom: 8,
    },
    searchBox: {
        flex: 1,
        height: 42,
        borderRadius: 21,
        backgroundColor: T.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
    },
    searchPh: { color: T.text3, fontSize: 14.5, marginLeft: 8 },
    gridBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

    chScroll: { flexGrow: 0 },
    chRow: { paddingHorizontal: T.pad, paddingTop: 4, paddingBottom: 6 },
    chItem: { marginRight: 22, alignItems: 'center' },
    chText: { color: T.text2, fontSize: 15.5 },
    chTextOn: { color: '#FFFFFF', fontWeight: '800' },
    chBar: { flexDirection: 'row', width: 22, height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
    chBarPlaceholder: { width: 22, height: 3, marginTop: 7 },

    section: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 14, paddingBottom: 11 },
    sectionTitle: { color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
    sectionSub: { color: T.text3, fontSize: 11, marginLeft: 8, flexShrink: 1, marginBottom: 2 },

    grid: { paddingHorizontal: T.pad, paddingBottom: TABBAR_SPACE },
    colWrap: { justifyContent: 'space-between' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
    footerText: { color: T.text3, fontSize: 12, marginLeft: 8 },
    endText: { color: T.text3, fontSize: 11.5, textAlign: 'center', paddingVertical: 18 },

    mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: T.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: T.pad,
        paddingTop: 8,
        paddingBottom: 26,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: T.line2,
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.surface3, alignSelf: 'center', marginBottom: 10 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
    sheetTitle: { color: T.text, fontSize: 16, fontWeight: '700' },
    sheetLink: { color: T.primary, fontSize: 13 },
    sheetEmpty: { color: T.text3, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
    siteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.surface3, marginRight: 10 },
    dotOn: { backgroundColor: T.primary },
    siteName: { color: T.text, fontSize: 14, flex: 1 },
    siteOn: { color: T.primary, fontSize: 11.5 },
});
