/**
 * 启动页：等内嵌 Node 起服务，拿到端口就进主界面。
 * 失败时不留白屏，把真实原因摊开，并给出重试/诊断两个出口。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import NodeService from '../../node/NodeService';
import { useNav } from '../../nav/Stack';
import { Btn } from '../components/Common';
import { T } from '../../theme';

export default function Boot() {
    const nav = useNav();
    const [err, setErr] = useState('');
    const [slow, setSlow] = useState(false);
    const spin = useRef(new Animated.Value(0)).current;
    const alive = useRef(true);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
        ).start();
        return () => {
            alive.current = false;
        };
    }, [spin]);

    const boot = async () => {
        setErr('');
        setSlow(false);
        const t = setTimeout(() => alive.current && setSlow(true), 6000);
        try {
            await NodeService.getBaseUrl();
            if (!alive.current) return;
            clearTimeout(t);
            nav.replace('Tabs');
        } catch (e: any) {
            clearTimeout(t);
            if (!alive.current) return;
            setErr(String(e?.message || e));
        }
    };

    useEffect(() => {
        NodeService.init();
        boot();
        // 只在首次挂载时启动
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={styles.wrap}>
            <View style={styles.logoBox}>
                <Text style={styles.logoText}>BOX</Text>
            </View>
            <Text style={styles.name}>BoxClone</Text>
            <Text style={styles.tag}>影视聚合 · 自建源</Text>

            {err ? (
                <View style={styles.errBox}>
                    <Text style={styles.errTitle}>启动失败</Text>
                    <Text style={styles.errMsg}>{err}</Text>
                    <View style={styles.errOps}>
                        <Btn label="重试" onPress={boot} small />
                        <Btn
                            label="看日志"
                            kind="ghost"
                            small
                            onPress={() => nav.push('Diagnostics')}
                            style={{ marginLeft: 10 }}
                        />
                    </View>
                </View>
            ) : (
                <View style={styles.loading}>
                    <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
                    <Text style={styles.loadingText}>{slow ? '首次启动要初始化运行时，稍等…' : '正在启动内嵌服务…'}</Text>
                </View>
            )}

            <Text style={styles.ver}>v1.0.0</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
    logoBox: {
        width: 84,
        height: 84,
        borderRadius: 22,
        backgroundColor: T.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    logoText: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
    name: { color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
    tag: { color: T.text3, fontSize: 12.5, marginTop: 6 },
    loading: { marginTop: 42, alignItems: 'center' },
    spinner: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2.5,
        borderColor: T.surface3,
        borderTopColor: T.primary,
    },
    loadingText: { color: T.text3, fontSize: 12.5, marginTop: 14 },
    errBox: {
        marginTop: 36,
        marginHorizontal: 28,
        padding: 18,
        borderRadius: T.r2,
        backgroundColor: T.surface,
        borderWidth: 1,
        borderColor: T.line,
        alignSelf: 'stretch',
    },
    errTitle: { color: T.danger, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    errMsg: { color: T.text2, fontSize: 12.5, lineHeight: 19 },
    errOps: { flexDirection: 'row', marginTop: 16 },
    ver: { position: 'absolute', bottom: 34, color: T.text3, fontSize: 11 },
});
