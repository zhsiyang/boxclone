/**
 * 片库：所有已配置视频源的清单，点一个切成当前源并回首页。
 * 和「我的 → 源管理」分工：那边管增删改，这边只管挑一个开始看。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Api, Site } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Btn, Empty, ErrBox, Loading } from '../components/Common';
import { IconGrid } from '../components/Icons';
import { switchSite } from '../../state/siteBus';
import { TABBAR_SPACE, T } from '../../theme';

function hostOf(url: string) {
    return String(url || '')
        .replace(/^https?:\/\//i, '')
        .split('/')[0];
}

export default function Catalog({ active, onPicked }: { active: boolean; onPicked?: () => void }) {
    const nav = useNav();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const cfg = await Api.getConfig();
            setSites(((cfg.video && cfg.video.sites) || []).filter((s: Site) => s.key));
        } catch (e: any) {
            setErr(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // 从源管理加完源回来要能看到新条目
    useEffect(() => {
        if (active) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const pick = (s: Site) => {
        switchSite(s);
        onPicked && onPicked();
    };

    if (loading) {
        return (
            <View style={styles.wrap}>
                <Head n={0} loading />
                <Loading />
            </View>
        );
    }
    if (err) {
        return (
            <View style={styles.wrap}>
                <Head n={0} />
                <ErrBox msg={err} onRetry={load} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            <Head n={sites.length} />
            <FlatList
                data={sites}
                keyExtractor={(s) => s.key}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={{ flex: 1, paddingTop: 40 }}>
                        <Empty text="一个源都没有" hint={'去「我的 → 源管理」加一个苹果CMS采集站'} />
                        <View style={{ alignItems: 'center', marginTop: 4 }}>
                            <Btn label="去添加源" onPress={() => nav.push('Sites')} />
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} activeOpacity={0.78} onPress={() => pick(item)}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText} numberOfLines={1}>
                                {(item.name || '?').slice(0, 1)}
                            </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.name} numberOfLines={1}>
                                {item.name || item.key}
                            </Text>
                            <Text style={styles.url} numberOfLines={1}>
                                {hostOf(item.url) || item.key}
                            </Text>
                        </View>
                        <Text style={styles.go}>›</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

function Head({ n, loading }: { n: number; loading?: boolean }) {
    return (
        <View style={styles.head}>
            <View style={{ width: 18 }}>
                <IconGrid size={18} color="#fff" />
            </View>
            <Text style={styles.headTitle}>片库</Text>
            <View style={{ flex: 1 }} />
            {!loading ? <Text style={styles.headCount}>{n} 个源</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.pad, paddingTop: 12, paddingBottom: 12 },
    headTitle: { color: T.text, fontSize: 19, fontWeight: '800', marginLeft: 9, letterSpacing: 0.4 },
    headCount: { color: T.text3, fontSize: 12 },
    list: { paddingHorizontal: T.pad, paddingBottom: TABBAR_SPACE },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surface,
        borderRadius: T.r2,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 9,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: T.surface2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: T.primary2, fontSize: 15, fontWeight: '800' },
    name: { color: T.text, fontSize: 14.5, fontWeight: '600' },
    url: { color: T.text3, fontSize: 11, marginTop: 3 },
    go: { color: T.text3, fontSize: 20, marginLeft: 8 },
});
