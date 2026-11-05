/**
 * 播放记录 / 我的收藏。两者结构接近，用 mode 区分，避免两份几乎一样的页面。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Api, Site } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Empty, Header, Loading } from '../components/Common';
import { T } from '../../theme';

type Mode = 'history' | 'favorites';

export default function Records() {
    const nav = useNav();
    const { mode } = nav.current.params as { mode: Mode };
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = await Api.getPrefs();
            setItems((mode === 'history' ? p.history : p.favorites) || []);
        } catch (e) {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [mode]);

    useEffect(() => {
        load();
    }, [load]);

    /** 历史记录里没有站点 type，这里给 1 兜底——服务端只按 key 查站点，type 段仅占位 */
    const open = (it: any) => {
        const site: Site = { key: it.siteKey, name: it.siteName || it.siteKey, type: 1, url: '' };
        nav.push('Detail', {
            site,
            vod: {
                vod_id: it.vodId,
                vod_name: it.vodName,
                vod_pic: it.vodPic,
            },
        });
    };

    const removeOne = (it: any) => {
        Alert.alert('删除', `删除「${it.vodName}」这条记录？`, [
            { text: '取消', style: 'cancel' },
            {
                text: '删除',
                style: 'destructive',
                onPress: async () => {
                    try {
                        if (mode === 'history') await Api.removeHistory(it.id);
                        else await Api.toggleFav({ siteKey: it.siteKey, vodId: it.vodId });
                        await load();
                    } catch (e) {
                        /* 忽略，列表会自己刷新 */
                    }
                },
            },
        ]);
    };

    const clearAll = () => {
        if (!items.length) return;
        Alert.alert('清空', `清空全部${mode === 'history' ? '播放记录' : '收藏'}？`, [
            { text: '取消', style: 'cancel' },
            {
                text: '清空',
                style: 'destructive',
                onPress: async () => {
                    try {
                        if (mode === 'history') {
                            await Api.clearHistory();
                            await load();
                        } else {
                            // 收藏没有批量接口，逐条取消
                            for (const it of items) {
                                await Api.toggleFav({ siteKey: it.siteKey, vodId: it.vodId });
                            }
                            await load();
                        }
                    } catch (e) {
                        /* 同上 */
                    }
                },
            },
        ]);
    };

    const pct = (it: any) => {
        if (mode !== 'history' || !it.duration) return '';
        const p = Math.min(1, (it.position || 0) / it.duration);
        return `${Math.round(p * 100)}%`;
    };

    return (
        <View style={styles.wrap}>
            <Header
                title={mode === 'history' ? '播放记录' : '我的收藏'}
                subtitle={`${items.length} 条`}
                onBack={nav.pop}
                right={
                    items.length ? (
                        <TouchableOpacity onPress={clearAll}>
                            <Text style={styles.clear}>清空</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />
            {loading ? (
                <Loading />
            ) : items.length === 0 ? (
                <Empty
                    text={mode === 'history' ? '还没有播放记录' : '还没有收藏'}
                    hint={mode === 'history' ? '看过一集就会出现在这里' : '在详情页点「收藏」'}
                />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => open(item)}
                            onLongPress={() => removeOne(item)}
                            style={styles.row}
                        >
                            {item.vodPic ? (
                                <Image source={{ uri: item.vodPic }} style={styles.pic} resizeMode="cover" />
                            ) : (
                                <View style={[styles.pic, styles.picPh]}>
                                    <Text style={styles.picPhText}>{(item.vodName || '?').slice(0, 1)}</Text>
                                </View>
                            )}
                            <View style={styles.info}>
                                <Text style={styles.name} numberOfLines={2}>
                                    {item.vodName}
                                </Text>
                                <Text style={styles.sub} numberOfLines={1}>
                                    {mode === 'history'
                                        ? [item.siteName, item.epName, pct(item)].filter(Boolean).join(' · ')
                                        : item.siteName}
                                </Text>
                                {mode === 'history' && item.updatedAt ? (
                                    <Text style={styles.time}>
                                        {new Date(item.updatedAt).toLocaleString()}
                                    </Text>
                                ) : null}
                            </View>
                            <TouchableOpacity onPress={() => removeOne(item)} style={styles.del}>
                                <Text style={styles.delText}>✕</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                />
            )}
            <Text style={styles.tip}>长按条目也可以删除</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    clear: { color: T.text3, fontSize: 13 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: T.pad,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.line,
    },
    pic: { width: 62, height: 88, borderRadius: 7, backgroundColor: T.surface2 },
    picPh: { alignItems: 'center', justifyContent: 'center' },
    picPhText: { color: T.surface3, fontSize: 20, fontWeight: '800' },
    info: { flex: 1, marginLeft: 12 },
    name: { color: T.text, fontSize: 14, lineHeight: 19 },
    sub: { color: T.text3, fontSize: 11.5, marginTop: 6 },
    time: { color: T.text3, fontSize: 10.5, marginTop: 5 },
    del: { padding: 10 },
    delText: { color: T.text3, fontSize: 13 },
    tip: { color: T.text3, fontSize: 10.5, textAlign: 'center', paddingBottom: 14 },
});
