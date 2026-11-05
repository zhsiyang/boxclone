/**
 * 分类列表页：某个站点的某一类，滚动到底自动翻页。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Api, Site, Vod } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Empty, ErrBox, Header, Loading } from '../components/Common';
import { Poster } from '../components/Poster';
import { T } from '../../theme';

const COLS = 3;

export default function Category() {
    const nav = useNav();
    const { site, typeId, typeName } = nav.current.params as { site: Site; typeId: any; typeName: string };

    const [list, setList] = useState<Vod[]>([]);
    const [page, setPage] = useState(1);
    const [pagecount, setPagecount] = useState(1);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [err, setErr] = useState('');
    const busy = useRef(false);

    const load = useCallback(
        async (p: number, append: boolean) => {
            if (busy.current) return;
            busy.current = true;
            if (append) setMore(true);
            else setLoading(true);
            setErr('');
            try {
                const r = await Api.category(site, typeId, p);
                const items = r.list || [];
                setList((old) => (append ? old.concat(items) : items));
                setPage(r.page || p);
                setPagecount(r.pagecount || 1);
            } catch (e: any) {
                setErr(String(e?.message || e));
                if (!append) setList([]);
            } finally {
                busy.current = false;
                setLoading(false);
                setMore(false);
            }
        },
        [site, typeId]
    );

    useEffect(() => {
        load(1, false);
    }, [load]);

    const onEnd = () => {
        if (busy.current || page >= pagecount) return;
        load(page + 1, true);
    };

    return (
        <View style={styles.wrap}>
            <Header title={typeName || '分类'} subtitle={site?.name} onBack={nav.pop} />
            {loading ? (
                <Loading />
            ) : err ? (
                <ErrBox msg={err} onRetry={() => load(1, false)} />
            ) : (
                <FlatList
                    data={list}
                    keyExtractor={(it, i) => String(it.vod_id ?? i) + '_' + i}
                    numColumns={COLS}
                    columnWrapperStyle={styles.colWrap}
                    contentContainerStyle={styles.grid}
                    onEndReached={onEnd}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={<Empty text="这一分类没有内容" />}
                    ListFooterComponent={
                        more ? (
                            <View style={styles.footer}>
                                <ActivityIndicator color={T.primary} size="small" />
                                <Text style={styles.footerText}>加载更多…</Text>
                            </View>
                        ) : list.length > 0 && page >= pagecount ? (
                            <Text style={styles.endText}>— 没有更多了 —</Text>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <Poster vod={item} cols={COLS} onPress={() => nav.push('Detail', { site, vod: item })} />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    grid: { paddingHorizontal: T.pad, paddingBottom: 24 },
    colWrap: { justifyContent: 'space-between' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
    footerText: { color: T.text3, fontSize: 12, marginLeft: 8 },
    endText: { color: T.text3, fontSize: 11.5, textAlign: 'center', paddingVertical: 20 },
});
