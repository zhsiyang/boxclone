/**
 * 播放页。
 *
 * 流程：detail 里选中的 vod（含完整 vod_play_from/url）→ 切线路拿 ep.id → 调 /play → 拿真实地址 → 播。
 * parse=1 表示要靠网页嗅探/外部解析，本项目不做，明确提示而不是假装能播。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Api, Site, Vod, splitPlay } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { VideoPlayer, VideoPlayerHandle } from '../../player/VideoPlayer';
import { Btn, Loading, toast } from '../components/Common';
import { DEFAULT_SETTINGS } from '../../config';
import { T } from '../../theme';

export default function Player() {
    const nav = useNav();
    const { site, vod, lineIndex = 0, epIndex = 0 } = nav.current.params as {
        site: Site;
        vod: Vod;
        flag: string;
        lineIndex: number;
        epIndex: number;
    };

    const lines = useMemo(() => splitPlay(vod), [vod]);
    const [li, setLi] = useState(lineIndex);
    const [ei, setEi] = useState(epIndex);
    const [url, setUrl] = useState('');
    const [parse, setParse] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [showEps, setShowEps] = useState(false);
    const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
    const [startAt, setStartAt] = useState(0);

    const handle = useRef<VideoPlayerHandle | null>(null);
    const lastSaved = useRef(0);
    const line = lines[li];
    const ep = line?.episodes[ei];

    // 读设置 + 上次进度
    useEffect(() => {
        Api.getPrefs()
            .then((p) => {
                setSettings(Object.assign({}, DEFAULT_SETTINGS, p.settings || {}));
                const id = `${site.key}|${vod.vod_id}`;
                const rec = (p.history || []).find((x: any) => x.id === id);
                // 只有同一集才续播，换集不该跳
                if (rec && Number(rec.epIndex) === ei && rec.position > 3) {
                    setStartAt(Number(rec.position) || 0);
                }
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 取播放地址
    const resolve = useCallback(async () => {
        if (!ep) {
            setErr('没有可播放的分集');
            setLoading(false);
            return;
        }
        setLoading(true);
        setErr('');
        try {
            const r = await Api.play(site, line.from, ep.id);
            if (r.parse && Number(r.parse) === 1) {
                setErr('这个地址需要网页解析（parse=1），本项目不做二次嗅探。换一条线路或换源。');
                setUrl('');
            } else {
                setUrl(r.url || '');
                if (!r.url) setErr('接口没返回播放地址');
            }
        } catch (e: any) {
            setErr(String(e?.message || e));
            setUrl('');
        } finally {
            setLoading(false);
        }
    }, [site, line, ep]);

    useEffect(() => {
        resolve();
    }, [resolve]);

    /** 节流写历史：onProgress 500ms 一次，5 秒落一次盘够了 */
    const saveHistory = useCallback(
        (pos: number, dur: number) => {
            if (!settings.rememberPosition) return;
            const now = Date.now();
            if (now - lastSaved.current < 5000) return;
            lastSaved.current = now;
            Api.touchHistory({
                siteKey: site.key,
                siteName: site.name,
                vodId: vod.vod_id,
                vodName: vod.vod_name,
                vodPic: vod.vod_pic,
                flag: line?.from,
                epName: ep?.name,
                epIndex: ei,
                position: pos,
                duration: dur,
            }).catch(() => {});
        },
        [settings.rememberPosition, site, vod, line, ep, ei]
    );

    const onEnd = () => {
        if (settings.autoNextEpisode && line && ei + 1 < line.episodes.length) {
            setEi(ei + 1);
            setStartAt(0);
            toast('自动播放下一集');
        } else {
            toast('已播完');
        }
    };

    const switchEp = (index: number) => {
        setEi(index);
        setStartAt(0);
        setShowEps(false);
        lastSaved.current = 0;
    };

    const switchLine = (index: number) => {
        setLi(index);
        setEi(0);
        setStartAt(0);
        setShowEps(false);
        lastSaved.current = 0;
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.playerBox}>
                {loading ? (
                    <Loading text="取播放地址…" />
                ) : err ? (
                    <View style={styles.errWrap}>
                        <Text style={styles.errText}>{err}</Text>
                        <View style={styles.errOps}>
                            <Btn label="重试" small onPress={resolve} />
                            {lines.length > 1 ? (
                                <Btn
                                    label="换线路"
                                    kind="ghost"
                                    small
                                    style={{ marginLeft: 8 }}
                                    onPress={() => switchLine((li + 1) % lines.length)}
                                />
                            ) : null}
                        </View>
                    </View>
                ) : url ? (
                    <VideoPlayer
                        uri={url}
                        title={vod.vod_name + (ep ? ' · ' + ep.name : '')}
                        startAt={startAt}
                        playInBackground={!!settings.playInBackground}
                        onProgress={saveHistory}
                        onEnd={onEnd}
                        onError={(m) => toast('播放错误: ' + m)}
                        handleRef={(h) => (handle.current = h)}
                        headerExtra={
                            <TouchableOpacity onPress={nav.pop} style={styles.closeBtn}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        }
                    />
                ) : null}
            </View>

            <View style={styles.bottom}>
                <Text style={styles.nowTitle} numberOfLines={1}>
                    {vod.vod_name}
                </Text>
                <Text style={styles.nowSub} numberOfLines={1}>
                    {line ? `${line.from} · ${ep?.name || ''}` : ''}
                </Text>

                <View style={styles.ops}>
                    <Btn label={`选集 (${ei + 1}/${line?.episodes.length || 0})`} small onPress={() => setShowEps(true)} />
                    {lines.length > 1 ? (
                        <Btn
                            label="换线路"
                            kind="ghost"
                            small
                            style={{ marginLeft: 8 }}
                            onPress={() => switchLine((li + 1) % lines.length)}
                        />
                    ) : null}
                    {ei + 1 < (line?.episodes.length || 0) ? (
                        <Btn
                            label="下一集"
                            kind="ghost"
                            small
                            style={{ marginLeft: 8 }}
                            onPress={() => switchEp(ei + 1)}
                        />
                    ) : null}
                    <Btn label="返回" kind="plain" small style={{ marginLeft: 8 }} onPress={nav.pop} />
                </View>
            </View>

            <Modal visible={showEps} transparent animationType="slide" onRequestClose={() => setShowEps(false)}>
                <View style={styles.modalWrap}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEps(false)} />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHead}>
                            <Text style={styles.sheetTitle}>选集</Text>
                            <TouchableOpacity onPress={() => setShowEps(false)}>
                                <Text style={styles.sheetClose}>关闭</Text>
                            </TouchableOpacity>
                        </View>

                        {lines.length > 1 ? (
                            <FlatList
                                horizontal
                                data={lines}
                                keyExtractor={(l, i) => l.from + i}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 10 }}
                                renderItem={({ item, index }) => (
                                    <TouchableOpacity
                                        onPress={() => switchLine(index)}
                                        style={[styles.lineChip, index === li && styles.lineChipOn]}
                                    >
                                        <Text style={[styles.lineText, index === li && { color: '#fff' }]}>
                                            {item.from}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        ) : null}

                        <FlatList
                            data={line?.episodes || []}
                            keyExtractor={(e2, i) => e2.id + i}
                            numColumns={5}
                            contentContainerStyle={styles.epList}
                            renderItem={({ item, index }) => (
                                <TouchableOpacity
                                    onPress={() => switchEp(index)}
                                    style={[styles.ep, index === ei && styles.epOn]}
                                >
                                    <Text
                                        style={[styles.epText, index === ei && { color: '#fff' }]}
                                        numberOfLines={1}
                                    >
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    playerBox: { aspectRatio: 16 / 9, backgroundColor: '#000' },
    closeBtn: { padding: 6 },
    closeText: { color: '#fff', fontSize: 16 },
    errWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    errText: { color: T.text2, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    errOps: { flexDirection: 'row', marginTop: 16 },

    bottom: { padding: T.pad },
    nowTitle: { color: T.text, fontSize: 15.5, fontWeight: '700' },
    nowSub: { color: T.text3, fontSize: 12, marginTop: 5 },
    ops: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },

    modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
        backgroundColor: T.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '62%',
        paddingBottom: 26,
    },
    sheetHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    sheetTitle: { color: T.text, fontSize: 15, fontWeight: '700' },
    sheetClose: { color: T.text3, fontSize: 13 },
    lineChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: T.surface2,
        marginRight: 8,
    },
    lineChipOn: { backgroundColor: T.primary },
    lineText: { color: T.text2, fontSize: 12.5 },
    epList: { paddingHorizontal: 10, paddingBottom: 20 },
    ep: {
        flex: 1,
        margin: 4,
        paddingVertical: 10,
        borderRadius: 7,
        backgroundColor: T.surface2,
        alignItems: 'center',
    },
    epOn: { backgroundColor: T.primary },
    epText: { color: T.text2, fontSize: 11.5 },
});
