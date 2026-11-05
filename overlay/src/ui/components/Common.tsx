/**
 * 通用 UI 零件。全部自绘，不依赖任何 UI 库。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { T } from '../../theme';

/* ---------------- 轻量 Toast ---------------- */
// 模块级广播：任何地方 toast('...') 都能弹，不用把 ref 一层层传下去
let toastListeners: ((m: string) => void)[] = [];
export function toast(msg: string) {
    toastListeners.forEach((l) => l(msg));
}

export function ToastHost() {
    const [msg, setMsg] = useState('');
    const op = useRef(new Animated.Value(0)).current;
    const timer = useRef<any>(null);

    useEffect(() => {
        const fn = (m: string) => {
            setMsg(m);
            Animated.timing(op, { toValue: 1, duration: 140, useNativeDriver: true }).start();
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            }, 1900);
        };
        toastListeners.push(fn);
        return () => {
            toastListeners = toastListeners.filter((x) => x !== fn);
            clearTimeout(timer.current);
        };
    }, [op]);

    if (!msg) return null;
    return (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { opacity: op }]}>
            <View style={styles.toast}>
                <Text style={styles.toastText} numberOfLines={4}>
                    {msg}
                </Text>
            </View>
        </Animated.View>
    );
}

/* ---------------- 按钮 ---------------- */
export function Btn({
    label,
    onPress,
    kind = 'primary',
    disabled,
    small,
    style,
}: {
    label: string;
    onPress: () => void;
    kind?: 'primary' | 'ghost' | 'danger' | 'plain';
    disabled?: boolean;
    small?: boolean;
    style?: ViewStyle;
}) {
    const bg =
        kind === 'primary' ? T.primary : kind === 'danger' ? 'rgba(240,82,82,0.16)' : kind === 'ghost' ? T.surface2 : 'transparent';
    const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? T.danger : kind === 'ghost' ? T.text : T.text2;
    return (
        <TouchableOpacity
            activeOpacity={disabled ? 1 : 0.75}
            onPress={disabled ? undefined : onPress}
            style={[
                styles.btn,
                { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
                small && styles.btnSmall,
                kind !== 'primary' && kind !== 'ghost' && { borderWidth: kind === 'plain' ? 0 : 1, borderColor: T.line2 },
                style,
            ]}
        >
            <Text style={[styles.btnText, { color: fg }, small && { fontSize: 12.5 }]}>{label}</Text>
        </TouchableOpacity>
    );
}

/* ---------------- 页头 ---------------- */
export function Header({
    title,
    onBack,
    right,
    subtitle,
}: {
    title: string;
    onBack?: () => void;
    right?: React.ReactNode;
    subtitle?: string;
}) {
    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                ) : null}
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.headerSub} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            </View>
            {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
    );
}

/* ---------------- 状态 ---------------- */
export function Loading({ text = '加载中…' }: { text?: string }) {
    return (
        <View style={styles.center}>
            <ActivityIndicator color={T.primary} />
            <Text style={styles.centerText}>{text}</Text>
        </View>
    );
}

export function Empty({ text = '这里什么都没有', hint }: { text?: string; hint?: string }) {
    return (
        <View style={styles.center}>
            <Text style={styles.emptyIcon}>◍</Text>
            <Text style={styles.emptyText}>{text}</Text>
            {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
        </View>
    );
}

export function ErrBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
    return (
        <View style={styles.center}>
            <Text style={styles.errIcon}>!</Text>
            <Text style={styles.errText}>{msg}</Text>
            {onRetry ? <Btn label="重试" onPress={onRetry} small style={{ marginTop: 14 }} /> : null}
        </View>
    );
}

/* ---------------- 区块标题 ---------------- */
export function Section({ title, right }: { title: string; right?: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={{ flex: 1 }} />
            {right}
        </View>
    );
}

export function Divider() {
    return <View style={styles.divider} />;
}

/* ---------------- 标签 ---------------- */
export function Chip({
    label,
    active,
    onPress,
}: {
    label: string;
    active?: boolean;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.chip, active && { backgroundColor: T.primaryDim, borderColor: T.primary }]}
        >
            <Text style={[styles.chipText, active && { color: T.primary }]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', zIndex: 9999 },
    toast: {
        maxWidth: '86%',
        backgroundColor: 'rgba(28,31,41,0.97)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderWidth: 1,
        borderColor: T.line2,
    },
    toastText: { color: T.text, fontSize: 13.5, lineHeight: 19 },

    btn: {
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: T.r,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
    },
    btnSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
    btnText: { fontSize: 14, fontWeight: '600' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: T.pad,
        paddingTop: 8,
        paddingBottom: 10,
        justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 30, marginRight: 4 },
    backIcon: { color: T.text, fontSize: 30, lineHeight: 34, marginTop: -2 },
    headerTitle: { color: T.text, fontSize: T.fs.h2, fontWeight: '700' },
    headerSub: { color: T.text3, fontSize: 11.5, marginTop: 2 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    centerText: { color: T.text3, fontSize: 13, marginTop: 12 },
    emptyIcon: { color: T.surface3, fontSize: 44, marginBottom: 10 },
    emptyText: { color: T.text2, fontSize: 14.5 },
    emptyHint: { color: T.text3, fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 18 },
    errIcon: {
        color: T.danger,
        fontSize: 22,
        fontWeight: '800',
        width: 42,
        height: 42,
        borderRadius: 21,
        textAlign: 'center',
        lineHeight: 42,
        backgroundColor: 'rgba(240,82,82,0.13)',
        overflow: 'hidden',
        marginBottom: 14,
    },
    errText: { color: T.text2, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },

    section: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.pad, marginTop: 18, marginBottom: 10 },
    sectionBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: T.primary, marginRight: 8 },
    sectionTitle: { color: T.text, fontSize: T.fs.h3, fontWeight: '700' },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.line, marginHorizontal: T.pad },

    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.line2,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: { color: T.text2, fontSize: 12.5 },
});
