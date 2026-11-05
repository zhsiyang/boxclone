/**
 * 搜索页：对启用的站点并发搜，结果合并后按站点打标。
 * 单站失败不影响其它站，失败数量单独提示。
 */
import React, { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Api, Site, Vod, settleAll } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Empty, Loading } from '../components/Common';
import { Poster } from '../components/Poster';
import { SEARCH_PER_SITE } from '../../config';
import { TABBAR_SPACE, T } from '../../theme';

const COLS = 3;

export default function Search({ active }: { active: boolean }) {
    const nav = useNav();
    const [wd, setWd] = useState('');
    const [list, setList] = useState<Vod[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [failInfo, setFailInfo] = useState('');
    const reqId = useRef(0);

    const doSearch = useCallback(async () => {
        const kw = wd.trim();
        if (!kw) return;
        Keyboard.dismiss();
        const my = ++reqId.current; // 防止旧请求覆盖新结果
        setLoading(true);
        setSearched(true);
        setFailInfo('');
        setList([]);
        try {
            const cfg = await Api.getConfig();
            const sites: Site[] = ((cfg.video && cfg.video.sites) || []).filter((s: Site) => s.key);
            if (!sites.length) {
                setLoading(false);
                setFailInfo('没有可用的源，先去「我的 → 源管理」加一个');
                return;
            }
            const { ok, fail } = await settleAll(
                sites,
                async (s) => {
                    const r = await Api.search(s, kw, 1);
                    return (r.list || []).slice(0, SEARCH_PER_SITE).map((v) => ({
                        ...v,
                        _siteKey: s.key,
                        _siteName: s.name,
                    }));
                },
                4
            );
            if (my !== reqId.current) return; // 已被更新的搜索取代
            setList(ok.flat());
            if (fail.length) {
                setFailInfo(`${fail.length} 个源搜索失败：` + fail.map((f) => f.item.name).join('、'));
            }
        } catch (e: any) {
            if (my === reqId.current) setFailInfo(String(e?.message || e));
        } finally {
            if (my === reqId.current) setLoading(false);
        }
    }, [wd]);

    return (
        <View style={styles.wrap}>
            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                    value={wd}
                    onChangeText={setWd}
                    placeholder="搜片名、演员…"
                    placeholderTextColor={T.text3}
                    style={styles.input}
                    returnKeyType="search"
                    onSubmitEditing={doSearch}
                    autoCorrect={false}
                />
                {wd ? (
                    <TouchableOpacity onPress={() => { setWd(''); setList([]); setSearched(false); }}>
                        <Text style={styles.clear}>✕</Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={doSearch} style={styles.goBtn}>
                    <Text style={styles.goText}>搜索</Text>
                </TouchableOpacity>
            </View>

            {failInfo ? <Text style={styles.fail}>{failInfo}</Text> : null}

            {loading ? (
                <Loading text="正在各源搜索…" />
            ) : (
                <FlatList
                    data={list}
                    keyExtractor={(it, i) => `${it._siteKey}_${it.vod_id}_${i}`}
                    numColumns={COLS}
                    columnWrapperStyle={styles.colWrap}
                    contentContainerStyle={styles.grid}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        searched ? (
                            <Empty text="没搜到" hint="换个关键词，或者换个源再试" />
                        ) : (
                            <Empty text="输入关键词开始搜索" hint="会同时在所有启用的源里找" />
                        )
                    }
                    renderItem={({ item }) => {
                        const site = { key: item._siteKey!, name: item._siteName!, type: 1, url: '' } as Site;
                        return (
                            <Poster
                                vod={item}
                                cols={COLS}
                                showSite
                                onPress={() => nav.push('Detail', { site, vod: item })}
                            />
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: T.pad,
        marginTop: 6,
        marginBottom: 8,
        paddingHorizontal: 14,
        height: 42,
        borderRadius: 21,
        backgroundColor: T.surface2,
    },
    searchIcon: { color: T.text3, fontSize: 15, marginRight: 8 },
    input: { flex: 1, color: T.text, fontSize: 14.5, padding: 0 },
    clear: { color: T.text3, fontSize: 13, paddingHorizontal: 8 },
    goBtn: { paddingLeft: 8 },
    goText: { color: T.primary, fontSize: 14, fontWeight: '600' },
    fail: { color: T.warn, fontSize: 11.5, paddingHorizontal: T.pad, paddingBottom: 6 },
    grid: { paddingHorizontal: T.pad, paddingTop: 8, paddingBottom: TABBAR_SPACE },
    colWrap: { justifyContent: 'space-between' },
});
