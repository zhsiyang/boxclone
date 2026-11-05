/**
 * 海报卡片。图片加载失败/为空时不留白块，直接画一个带首字的占位块。
 * 版式对齐参考稿：圆角竖版图 + 图内底部居中的评分胶囊 + 图下居中的单行片名。
 */
import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T, posterSize } from '../../theme';
import { IconStar } from './Icons';
import type { Vod } from '../../api/CatApi';

/** 有 remarks 就当评分/状态标签用，没有就按参考稿显示「暂无评分」 */
function scoreText(vod: Vod) {
    const r = (vod.vod_remarks || '').trim();
    return r || '暂无评分';
}

export function Poster({
    vod,
    cols = 3,
    onPress,
    showSite,
}: {
    vod: Vod;
    cols?: number;
    onPress: () => void;
    showSite?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    const { w, h } = posterSize(Dimensions.get('window').width, cols);
    const pic = (vod.vod_pic || '').trim();
    const showImg = !!pic && !failed;
    const hasScore = !!(vod.vod_remarks || '').trim();

    return (
        <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={{ width: w, marginBottom: 16 }}>
            <View style={[styles.box, { width: w, height: h }]}>
                {showImg ? (
                    <Image
                        source={{ uri: pic }}
                        style={styles.img}
                        resizeMode="cover"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    <View style={styles.ph}>
                        <Text style={styles.phText} numberOfLines={1}>
                            {(vod.vod_name || '?').slice(0, 1)}
                        </Text>
                    </View>
                )}

                {showSite && vod._siteName ? (
                    <View style={styles.siteBadge}>
                        <Text style={styles.siteText} numberOfLines={1}>
                            {vod._siteName}
                        </Text>
                    </View>
                ) : null}

                {/* 评分条压在图片底部中间，半透明黑底保证任何海报上都可读 */}
                <View style={styles.scoreWrap} pointerEvents="none">
                    <View style={styles.score}>
                        <IconStar size={7} color={hasScore ? T.gold : 'rgba(255,255,255,0.6)'} />
                        <Text style={styles.scoreText} numberOfLines={1}>
                            {scoreText(vod)}
                        </Text>
                    </View>
                </View>
            </View>

            <Text style={styles.title} numberOfLines={1}>
                {vod.vod_name || '未命名'}
            </Text>
        </TouchableOpacity>
    );
}

/** 横向滚动用的小卡（搜索结果以外的横滑列表用） */
export function PosterWide({ vod, onPress }: { vod: Vod; onPress: () => void }) {
    const [failed, setFailed] = useState(false);
    const w = 108;
    const h = Math.round(w * 1.47);
    const pic = (vod.vod_pic || '').trim();
    return (
        <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={{ width: w, marginRight: 10 }}>
            <View style={[styles.box, { width: w, height: h }]}>
                {pic && !failed ? (
                    <Image source={{ uri: pic }} style={styles.img} resizeMode="cover" onError={() => setFailed(true)} />
                ) : (
                    <View style={styles.ph}>
                        <Text style={styles.phText}>{(vod.vod_name || '?').slice(0, 1)}</Text>
                    </View>
                )}
                <View style={styles.scoreWrap} pointerEvents="none">
                    <View style={styles.score}>
                        <IconStar size={7} color={T.gold} />
                        <Text style={styles.scoreText} numberOfLines={1}>
                            {scoreText(vod)}
                        </Text>
                    </View>
                </View>
            </View>
            <Text style={styles.title} numberOfLines={1}>
                {vod.vod_name}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    box: {
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: T.surface2,
    },
    img: { width: '100%', height: '100%' },
    ph: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface2 },
    phText: { color: T.surface3, fontSize: 30, fontWeight: '800' },
    siteBadge: {
        position: 'absolute',
        left: 5,
        top: 5,
        backgroundColor: 'rgba(0,0,0,0.62)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        maxWidth: '80%',
    },
    siteText: { color: '#fff', fontSize: 9.5 },
    scoreWrap: { position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' },
    score: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '90%',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    scoreText: { color: '#fff', fontSize: 9.5, marginLeft: 4 },
    title: { color: T.text, fontSize: 12.5, marginTop: 7, textAlign: 'center' },
});
