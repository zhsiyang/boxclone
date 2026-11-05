/**
 * 详情页：海报 + 信息 + 线路切换 + 选集。
 * 列表项里的 vod 字段不全（多数采集站列表不带 vod_play_url），所以这里必须再拉一次 detail。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Api, Site, Vod, splitPlay } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Btn, Empty, ErrBox, Header, Loading, toast } from '../components/Common';
import { T } from '../../theme';

export default function Detail() {
    const nav = useNav();
    const { site, vod: brief } = nav.current.params as { site: Site; vod: Vod };

    const [vod, setVod] = useState<Vod | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [lineIdx, setLineIdx] = useState(0);
    const [expandIntro, setExpandIntro] = useState(false);
    const [faved, setFaved] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const r = await Api.detail(site, brief.vod_id);
            const v = (r.list && r.list[0]) || brief;
            setVod(v);
            setLineIdx(0);
        } catch (e: any) {
            // detail 挂了也别空屏：用列表项兜底展示，同时把错误说出来
            setVod(brief);
            setErr(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, [site, brief]);

    useEffect(() => {
        load();
        Api.getPrefs()
            .then((p) => {
                const id = `${site.key}|${brief.vod_id}`;
                setFaved((p.favorites || []).some((x: any) => x.id === id));
            })
            .catch(() => {});
    }, [load, site.key, brief.vod_id]);

    const lines = useMemo(() => splitPlay(vod), [vod]);
    const line = lines[lineIdx];

    const toggleFav = async () => {
        try {
            const r = await Api.toggleFav({
                siteKey: site.key,
                siteName: site.name,
                vodId: vod?.vod_id ?? brief.vod_id,
                vodName: vod?.vod_name || brief.vod_name,
                vodPic: vod?.vod_pic || brief.vod_pic,
            });
            setFaved(r.fav);
            toast(r.fav ? '已加入收藏' : '已取消收藏');
        } catch (e: any) {
            toast('操作失败: ' + String(e?.message || e));
        }
    };

    const playEp = (epIndex: number) => {
        if (!line) return;
        nav.push('Player', {
            site,
            vod: vod || brief,
            flag: line.from,
            lineIndex: lineIdx,
            epIndex,
        });
    };

    const intro = (vod?.vod_content || '').trim();
    const shortIntro = intro.length > 110 ? intro.slice(0, 110) + '…' : intro;

    if (loading) {
        return (
            <View style={styles.wrap}>
                <Header title={brief.vod_name} onBack={nav.pop} />
                <Loading />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            <Header title={vod?.vod_name || brief.vod_name} onBack={nav.pop} subtitle={site.name} />
            <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.head}>
                    {vod?.vod_pic ? (
                        <Image source={{ uri: vod.vod_pic }} style={styles.pic} resizeMode="cover" />
                    ) : (
                        <View style={[styles.pic, styles.picPh]}>
                            <Text style={styles.picPhText}>{(vod?.vod_name || '?').slice(0, 1)}</Text>
                        </View>
                    )}

                    <View style={styles.headInfo}>
                        <Text style={styles.title} numberOfLines={2}>
                            {vod?.vod_name || brief.vod_name}
                        </Text>
                        <Text style={styles.meta} numberOfLines={1}>
                            {[vod?.type_name, vod?.vod_year, vod?.vod_area].filter(Boolean).join(' · ') || '—'}
                        </Text>
                        {vod?.vod_remarks ? <Text style={styles.remarks}>{vod.vod_remarks}</Text> : null}
                        <View style={{ flex: 1 }} />
                        <View style={styles.headOps}>
                            <Btn label={faved ? '已收藏' : '收藏'} kind={faved ? 'ghost' : 'primary'} small onPress={toggleFav} />
                            {lines.length ? (
                                <Btn
                                    label="播放"
                                    kind="ghost"
                                    small
                                    style={{ marginLeft: 8 }}
                                    onPress={() => playEp(0)}
                                />
                            ) : null}
                        </View>
                    </View>
                </View>

                {err ? (
                    <Text style={styles.warn}>详情接口异常：{err}（下面用的是列表数据）</Text>
                ) : null}

                {intro ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandIntro((v) => !v)}>
                        <Text style={styles.intro}>{expandIntro ? intro : shortIntro}</Text>
                        {intro.length > 110 ? (
                            <Text style={styles.more}>{expandIntro ? '收起' : '展开全部'}</Text>
                        ) : null}
                    </TouchableOpacity>
                ) : null}

                {lines.length === 0 ? (
                    <Empty text="这个源没有给出播放地址" hint="可能是采集站数据不完整，换个源试试" />
                ) : (
                    <>
                        <Text style={styles.blockTitle}>线路</Text>
                        <View style={styles.lineRow}>
                            {lines.map((l, i) => (
                                <TouchableOpacity
                                    key={l.from + i}
                                    onPress={() => setLineIdx(i)}
                                    style={[styles.lineChip, i === lineIdx && styles.lineChipOn]}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[styles.lineText, i === lineIdx && { color: '#fff' }]}
                                        numberOfLines={1}
                                    >
                                        {l.from}
                                    </Text>
                                    <Text style={[styles.lineCount, i === lineIdx && { color: 'rgba(255,255,255,0.8)' }]}>
                                        {l.episodes.length}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.blockTitle}>选集（{line?.episodes.length || 0}）</Text>
                        <View style={styles.epGrid}>
                            {line?.episodes.map((ep, i) => (
                                <TouchableOpacity
                                    key={ep.id + i}
                                    style={styles.ep}
                                    activeOpacity={0.8}
                                    onPress={() => playEp(i)}
                                >
                                    <Text style={styles.epText} numberOfLines={1}>
                                        {ep.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    body: { paddingHorizontal: T.pad, paddingBottom: 40 },
    head: { flexDirection: 'row' },
    pic: { width: 104, height: 150, borderRadius: T.r, backgroundColor: T.surface2 },
    picPh: { alignItems: 'center', justifyContent: 'center' },
    picPhText: { color: T.surface3, fontSize: 30, fontWeight: '800' },
    headInfo: { flex: 1, marginLeft: 14 },
    title: { color: T.text, fontSize: 17, fontWeight: '700', lineHeight: 23 },
    meta: { color: T.text3, fontSize: 12, marginTop: 7 },
    remarks: { color: T.gold, fontSize: 11.5, marginTop: 6 },
    headOps: { flexDirection: 'row', marginTop: 12 },
    warn: { color: T.warn, fontSize: 12, marginTop: 14, lineHeight: 18 },
    intro: { color: T.text2, fontSize: 13, lineHeight: 20, marginTop: 18 },
    more: { color: T.primary, fontSize: 12, marginTop: 6 },
    blockTitle: { color: T.text, fontSize: 14.5, fontWeight: '700', marginTop: 22, marginBottom: 10 },
    lineRow: { flexDirection: 'row', flexWrap: 'wrap' },
    lineChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: T.surface2,
        marginRight: 8,
        marginBottom: 8,
        maxWidth: 170,
    },
    lineChipOn: { backgroundColor: T.primary },
    lineText: { color: T.text2, fontSize: 12.5 },
    lineCount: { color: T.text3, fontSize: 10.5, marginLeft: 6 },
    epGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    ep: {
        minWidth: '30%',
        paddingHorizontal: 8,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: T.surface,
        borderWidth: 1,
        borderColor: T.line,
        marginRight: 8,
        marginBottom: 8,
        alignItems: 'center',
    },
    epText: { color: T.text2, fontSize: 12.5 },
});
