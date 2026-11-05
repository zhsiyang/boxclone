/**
 * 播放器外壳 + 自绘控制条。
 *
 * 用 react-native-video 6.x：playInBackground / playWhenInactive 让后台和息屏继续出声，
 * presentFullscreenPlayer() 走原生全屏，配合 fullscreenOrientation="landscape"
 * 实现「点全屏自动横屏」。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Video, { VideoRef, OnLoadData, OnProgressData } from 'react-native-video';
import { T } from '../theme';
import { SPEEDS, SEEK_STEP } from '../config';

export type VideoPlayerHandle = {
    seek: (sec: number) => void;
    seekBy: (delta: number) => void;
    pause: () => void;
    play: () => void;
    fullscreen: () => void;
};

function fmt(sec: number): string {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function VideoPlayer({
    uri,
    title,
    startAt = 0,
    autoPlay = true,
    playInBackground = true,
    onProgress,
    onEnd,
    onError,
    onReady,
    handleRef,
    headerExtra,
}: {
    uri: string;
    title?: string;
    startAt?: number;
    autoPlay?: boolean;
    playInBackground?: boolean;
    onProgress?: (cur: number, dur: number) => void;
    onEnd?: () => void;
    onError?: (msg: string) => void;
    onReady?: (dur: number) => void;
    handleRef?: (h: VideoPlayerHandle) => void;
    headerExtra?: React.ReactNode;
}) {
    const ref = useRef<VideoRef>(null);
    const [paused, setPaused] = useState(!autoPlay);
    const [buffering, setBuffering] = useState(true);
    const [cur, setCur] = useState(0);
    const [dur, setDur] = useState(0);
    const [rate, setRate] = useState(1);
    const [showCtrl, setShowCtrl] = useState(true);
    const [barW, setBarW] = useState(0);
    const [err, setErr] = useState('');
    const [resumed, setResumed] = useState(false);
    const hideTimer = useRef<any>(null);

    const scheduleHide = useCallback(() => {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowCtrl(false), 3500);
    }, []);

    useEffect(() => {
        scheduleHide();
        return () => clearTimeout(hideTimer.current);
    }, [scheduleHide]);

    const seek = useCallback((sec: number) => {
        const s = Math.max(0, Math.min(sec, dur || sec));
        ref.current?.seek(s);
        setCur(s);
    }, [dur]);

    const api = useMemo<VideoPlayerHandle>(
        () => ({
            seek,
            seekBy: (d: number) => seek(cur + d),
            pause: () => setPaused(true),
            play: () => setPaused(false),
            fullscreen: () => ref.current?.presentFullscreenPlayer(),
        }),
        [seek, cur]
    );

    useEffect(() => {
        handleRef?.(api);
    }, [api, handleRef]);

    const onLoad = (d: OnLoadData) => {
        setDur(d.duration || 0);
        setBuffering(false);
        onReady?.(d.duration || 0);
        // 断点续播：只跳一次，避免用户手动拖回又被拉走
        if (!resumed && startAt > 1 && Math.abs(startAt - (d.duration || 0)) > 5) {
            setResumed(true);
            setTimeout(() => ref.current?.seek(startAt), 260);
        }
    };

    const onProg = (d: OnProgressData) => {
        setCur(d.currentTime || 0);
        if (dur > 0) onProgress?.(d.currentTime || 0, dur);
    };

    const toggle = () => {
        setPaused((p) => !p);
        setShowCtrl(true);
        scheduleHide();
    };

    const onBarPress = (e: any) => {
        if (!barW || !dur) return;
        const x = e.nativeEvent.locationX;
        seek((x / barW) * dur);
    };

    const pct = dur > 0 ? Math.min(1, cur / dur) : 0;

    return (
        <View style={styles.wrap}>
            <Video
                ref={ref}
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                paused={paused}
                rate={rate}
                playInBackground={playInBackground}
                playWhenInactive={playInBackground}
                ignoreSilentSwitch="ignore"
                onLoad={onLoad}
                onProgress={onProg}
                onEnd={onEnd}
                onBuffer={(e) => setBuffering(!!e.isBuffering)}
                onError={(e: any) => {
                    const msg = String(e?.error?.errorString || e?.error?.localizedDescription || '播放失败');
                    setErr(msg);
                    setBuffering(false);
                    onError?.(msg);
                }}
                progressUpdateInterval={500}
            />

            {err ? (
                <View style={styles.center}>
                    <Text style={styles.errIcon}>!</Text>
                    <Text style={styles.errText}>{err}</Text>
                    <Text style={styles.errHint}>换个线路或换源再试</Text>
                </View>
            ) : buffering ? (
                <View style={styles.center} pointerEvents="none">
                    <ActivityIndicator color={T.primary} size="large" />
                </View>
            ) : null}

            {/* 点画面唤出/收起控制条 */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowCtrl((v) => !v); scheduleHide(); }} />

            {showCtrl ? (
                <View style={styles.ctrl} pointerEvents="box-none">
                    <View style={styles.topBar} pointerEvents="box-none">
                        <Text style={styles.title} numberOfLines={1}>
                            {title || ''}
                        </Text>
                        <View style={{ flex: 1 }} />
                        {headerExtra}
                    </View>

                    <View style={styles.btm} pointerEvents="box-none">
                        <View style={styles.ops}>
                            <TouchableOpacity style={styles.op} onPress={() => { seek(cur - SEEK_STEP); scheduleHide(); }}>
                                <Text style={styles.opText}>« {SEEK_STEP}s</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.playBtn} onPress={toggle}>
                                <Text style={styles.playIcon}>{paused ? '▶' : '❚❚'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.op} onPress={() => { seek(cur + SEEK_STEP); scheduleHide(); }}>
                                <Text style={styles.opText}>{SEEK_STEP}s »</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.op}
                                onPress={() => {
                                    const i = SPEEDS.indexOf(rate);
                                    setRate(SPEEDS[(i + 1) % SPEEDS.length]);
                                    scheduleHide();
                                }}
                            >
                                <Text style={styles.opText}>{rate}x</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.op} onPress={() => ref.current?.presentFullscreenPlayer()}>
                                <Text style={styles.opText}>全屏</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.barRow}>
                            <Text style={styles.time}>{fmt(cur)}</Text>
                            <Pressable
                                style={styles.barHit}
                                onPress={onBarPress}
                                onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
                            >
                                <View style={styles.barBg}>
                                    <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
                                    <View style={[styles.barDot, { left: `${pct * 100}%` }]} />
                                </View>
                            </Pressable>
                            <Text style={styles.time}>{fmt(dur)}</Text>
                        </View>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#000' },
    center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    errIcon: {
        color: T.danger,
        fontSize: 20,
        fontWeight: '800',
        width: 40,
        height: 40,
        lineHeight: 40,
        textAlign: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(240,82,82,0.16)',
        overflow: 'hidden',
        marginBottom: 12,
    },
    errText: { color: '#fff', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
    errHint: { color: T.text3, fontSize: 12, marginTop: 8 },

    ctrl: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 22,
        backgroundColor: 'rgba(0,0,0,0.42)',
    },
    title: { color: '#fff', fontSize: 14, fontWeight: '600', maxWidth: '62%' },
    btm: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 26, backgroundColor: 'rgba(0,0,0,0.42)' },
    ops: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    op: { paddingHorizontal: 12, paddingVertical: 6 },
    opText: { color: '#fff', fontSize: 12.5 },
    playBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(62,99,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 10,
    },
    playIcon: { color: '#fff', fontSize: 15 },
    barRow: { flexDirection: 'row', alignItems: 'center' },
    time: { color: '#D6D9E2', fontSize: 11, width: 46, textAlign: 'center' },
    barHit: { flex: 1, height: 26, justifyContent: 'center', marginHorizontal: 4 },
    barBg: { height: 3.5, backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 2, justifyContent: 'center' },
    barFill: { height: 3.5, backgroundColor: T.primary, borderRadius: 2 },
    barDot: {
        position: 'absolute',
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: T.primary,
        marginLeft: -5.5,
    },
});
