/**
 * 我的：入口列表 + 播放设置开关。设置直接落 prefs，不额外做「保存」按钮。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Api } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { toast } from '../components/Common';
import { DEFAULT_SETTINGS } from '../../config';
import { TABBAR_SPACE, T } from '../../theme';

type Row = { label: string; hint?: string; onPress: () => void };

export default function Mine({ active }: { active: boolean }) {
    const nav = useNav();
    const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
    const [counts, setCounts] = useState({ history: 0, fav: 0, sites: 0 });

    const refresh = useCallback(async () => {
        try {
            const [p, s] = await Promise.all([Api.getPrefs(), Api.listSites()]);
            setSettings(Object.assign({}, DEFAULT_SETTINGS, p.settings || {}));
            setCounts({
                history: (p.history || []).length,
                fav: (p.favorites || []).length,
                sites: (s.sites || []).filter((x) => x.url || x.ext).length,
            });
        } catch (e) {
            /* 服务没起好时静默，页面照样能进 */
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (active) refresh();
    }, [active, refresh]);

    const setFlag = async (key: string, val: boolean) => {
        const next = Object.assign({}, settings, { [key]: val });
        setSettings(next);
        try {
            await Api.setSettings({ [key]: val });
        } catch (e: any) {
            toast('保存失败: ' + String(e?.message || e));
            setSettings(settings);
        }
    };

    const rows: Row[] = [
        {
            label: '播放记录',
            hint: counts.history ? `${counts.history} 条` : '空',
            onPress: () => nav.push('Records', { mode: 'history' }),
        },
        {
            label: '我的收藏',
            hint: counts.fav ? `${counts.fav} 部` : '空',
            onPress: () => nav.push('Records', { mode: 'favorites' }),
        },
        {
            label: '源管理',
            hint: counts.sites ? `${counts.sites} 个在用` : '未配置',
            onPress: () => nav.push('Sites'),
        },
        { label: '诊断日志', onPress: () => nav.push('Diagnostics') },
        { label: '关于', onPress: () => nav.push('About') },
    ];

    return (
        <View style={styles.wrap}>
            <ScrollView contentContainerStyle={{ paddingBottom: TABBAR_SPACE }}>
                <View style={styles.head}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>B</Text>
                    </View>
                    <View style={{ marginLeft: 14 }}>
                        <Text style={styles.name}>BoxClone</Text>
                        <Text style={styles.sub}>
                            {counts.sites ? `${counts.sites} 个源在用` : '还没配置源'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.groupTitle}>播放设置</Text>
                <View style={styles.card}>
                    <SwRow
                        label="自动横屏全屏"
                        value={!!settings.autoFullscreenLandscape}
                        onChange={(v) => setFlag('autoFullscreenLandscape', v)}
                    />
                    <SwRow
                        label="后台/息屏续播"
                        value={!!settings.playInBackground}
                        onChange={(v) => setFlag('playInBackground', v)}
                    />
                    <SwRow
                        label="播完自动下一集"
                        value={!!settings.autoNextEpisode}
                        onChange={(v) => setFlag('autoNextEpisode', v)}
                        last
                    />
                    <SwRow
                        label="记住播放进度"
                        value={!!settings.rememberPosition}
                        onChange={(v) => setFlag('rememberPosition', v)}
                        last
                    />
                </View>

                <Text style={styles.groupTitle}>功能</Text>
                <View style={styles.card}>
                    {rows.map((r, i) => (
                        <TouchableOpacity
                            key={r.label}
                            activeOpacity={0.75}
                            onPress={r.onPress}
                            style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}
                        >
                            <Text style={styles.rowLabel}>{r.label}</Text>
                            <View style={{ flex: 1 }} />
                            {r.hint ? <Text style={styles.rowHint}>{r.hint}</Text> : null}
                            <Text style={styles.arrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.footer}>BoxClone v1.0.0 · 本工具不含任何内容源</Text>
            </ScrollView>
        </View>
    );
}

function SwRow({
    label,
    value,
    onChange,
    last,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    last?: boolean;
}) {
    return (
        <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <View style={{ flex: 1 }} />
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: T.surface3, true: 'rgba(62,99,255,0.55)' }}
                thumbColor={value ? T.primary : '#8A90A2'}
                ios_backgroundColor={T.surface3}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.pad, paddingTop: 18, paddingBottom: 22 },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: T.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
    name: { color: T.text, fontSize: 17, fontWeight: '700' },
    sub: { color: T.text3, fontSize: 12, marginTop: 4 },
    groupTitle: { color: T.text3, fontSize: 11.5, marginLeft: T.pad + 2, marginBottom: 7, marginTop: 8 },
    card: {
        backgroundColor: T.surface,
        marginHorizontal: T.pad,
        borderRadius: T.r2,
        overflow: 'hidden',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        minHeight: 48,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.line,
    },
    rowLabel: { color: T.text, fontSize: 14 },
    rowHint: { color: T.text3, fontSize: 12, marginRight: 6 },
    arrow: { color: T.text3, fontSize: 18, marginLeft: 2 },
    footer: { color: T.text3, fontSize: 11, textAlign: 'center', marginTop: 22 },
});
