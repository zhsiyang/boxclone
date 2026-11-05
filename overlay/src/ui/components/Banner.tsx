/**
 * 首页主视觉轮播。
 * 不用第三方轮播库：就是一个横向 pagingEnabled 的 ScrollView + 定时器，
 * 手势拖动时暂停自动轮播，松手后重新计时，避免和用户抢。
 *
 * 渐变遮罩用 N 条透明黑叠加模拟（RN 没有内置 linear-gradient，
 * 为一条渐变引原生依赖不值当），26 条在 3x 屏上肉眼无断层。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Vod } from '../../api/CatApi';
import { T } from '../../theme';

const SIDE = T.pad;
// 挂到列表 header 里时，header 已经吃掉了左右各 SIDE 的 padding，
// 所以这里的宽度按「屏宽 - 2*SIDE」算，wrap 自己不再加 paddingHorizontal，否则会缩进成 32。
const W = Math.round(Dimensions.get('window').width - SIDE * 2);
const H = Math.round(W * 0.5625); // 16:9
const FADE_STEPS = 26;
const AUTO_MS = 4200;

export function Banner({ items, onPress }: { items: Vod[]; onPress: (v: Vod) => void }) {
    const [idx, setIdx] = useState(0);
    const box = useRef<ScrollView>(null);
    const timer = useRef<any>(null);
    const idxRef = useRef(0);

    const stop = useCallback(() => {
        if (timer.current) {
            clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    const start = useCallback(() => {
        stop();
        if (items.length < 2) return;
        timer.current = setInterval(() => {
            const n = (idxRef.current + 1) % items.length;
            idxRef.current = n;
            setIdx(n);
            box.current?.scrollTo({ x: n * W, animated: true });
        }, AUTO_MS);
    }, [items.length, stop]);

    useEffect(() => {
        idxRef.current = 0;
        setIdx(0);
        box.current?.scrollTo({ x: 0, animated: false });
        start();
        return stop;
    }, [items.length, start, stop]);

    if (!items.length) return null;

    // 手指一碰就停表，惯性停下再接着跑
    const onEnd = (e: any) => {
        const x = e?.nativeEvent?.contentOffset?.x || 0;
        const n = Math.max(0, Math.min(items.length - 1, Math.round(x / W)));
        idxRef.current = n;
        setIdx(n);
        start();
    };

    return (
        <View style={styles.wrap}>
            <ScrollView
                ref={box}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScrollBeginDrag={stop}
                onMomentumScrollEnd={onEnd}
                onScrollEndDrag={onEnd}
                style={{ width: W }}
                contentContainerStyle={{ width: W * items.length }}
            >
                {items.map((v) => (
                    <Slide key={String(v.vod_id)} vod={v} onPress={() => onPress(v)} />
                ))}
            </ScrollView>

            {items.length > 1 ? (
                <View style={styles.dots} pointerEvents="none">
                    {items.map((v, i) => (
                        <View key={String(v.vod_id) + '_dot'} style={[styles.dot, i === idx && styles.dotOn]} />
                    ))}
                </View>
            ) : null}
        </View>
    );
}

function Slide({ vod, onPress }: { vod: Vod; onPress: () => void }) {
    const [failed, setFailed] = useState(false);
    const pic = (vod.vod_pic || '').trim();
    const show = !!pic && !failed;

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ width: W, height: H }}>
            <View style={styles.card}>
                {show ? (
                    <Image source={{ uri: pic }} style={styles.img} resizeMode="cover" onError={() => setFailed(true)} />
                ) : (
                    <View style={styles.ph}>
                        <Text style={styles.phText} numberOfLines={1}>
                            {(vod.vod_name || '?').slice(0, 1)}
                        </Text>
                    </View>
                )}

                {/* 底部压暗，保证标题在任何海报上都读得清 */}
                <View style={styles.fade} pointerEvents="none">
                    {Array.from({ length: FADE_STEPS }).map((_, i) => (
                        <View
                            key={i}
                            style={{
                                flex: 1,
                                backgroundColor: 'rgba(0,0,0,' + (Math.pow((i + 1) / FADE_STEPS, 2.1) * 0.92).toFixed(3) + ')',
                            }}
                        />
                    ))}
                </View>

                <View style={styles.titleWrap} pointerEvents="none">
                    <Text style={styles.title} numberOfLines={1}>
                        {vod.vod_name || '未命名'}
                    </Text>
                    {vod.vod_remarks ? (
                        <Text style={styles.sub} numberOfLines={1}>
                            {vod.vod_remarks}
                        </Text>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: { marginTop: 4, marginBottom: 6 },
    card: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface2 },
    img: { width: '100%', height: '100%' },
    ph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    phText: { color: T.surface3, fontSize: 56, fontWeight: '900' },
    fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(H * 0.52) },
    titleWrap: { position: 'absolute', left: 14, right: 60, bottom: 12 },
    title: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 1.5,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    sub: { color: 'rgba(255,255,255,0.72)', fontSize: 11.5, marginTop: 4 },
    dots: { position: 'absolute', right: 10, bottom: 20, flexDirection: 'row', alignItems: 'center' },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginLeft: 5,
        backgroundColor: 'rgba(255,255,255,0.42)',
    },
    dotOn: { width: 14, backgroundColor: '#fff' },
});
