/**
 * 诊断页：把内嵌服务的日志和最后错误摊开，出问题时不用连电脑抓 logcat/Xcode。
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NodeService from '../../node/NodeService';
import { useNav } from '../../nav/Stack';
import { Btn, Header, toast } from '../components/Common';
import { Api } from '../../api/CatApi';
import { T } from '../../theme';

export default function Diagnostics() {
    const nav = useNav();
    const [logs, setLogs] = useState<string[]>([]);
    const [err, setErr] = useState('');
    const [base, setBase] = useState('');
    const [devLog, setDevLog] = useState('');

    const refresh = () => {
        setLogs(NodeService.recentLogs());
        setErr(NodeService.lastErrorText());
        NodeService.getBaseUrl()
            .then(setBase)
            .catch((e) => setBase('未就绪: ' + String(e?.message || e)));
    };

    useEffect(() => {
        refresh();
        const off = NodeService.onLog(() => setLogs(NodeService.recentLogs()));
        const off2 = NodeService.onError((m) => setErr(m));
        return () => {
            off();
            off2();
        };
    }, []);

    const restart = async () => {
        try {
            const u = await NodeService.restart();
            setBase(u);
            toast('已重启: ' + u);
            refresh();
        } catch (e: any) {
            toast('重启失败: ' + String(e?.message || e));
        }
    };

    const loadDevLog = async () => {
        try {
            const p = await Api.getPrefs();
            setDevLog(
                [
                    'service   : ' + base,
                    'prefsFile : ' + p.file,
                    'history   : ' + (p.history || []).length,
                    'favorites : ' + (p.favorites || []).length,
                    'settings  : ' + JSON.stringify(p.settings || {}),
                ].join('\n')
            );
        } catch (e: any) {
            setDevLog('读取失败: ' + String(e?.message || e));
        }
    };

    return (
        <View style={styles.wrap}>
            <Header title="诊断" onBack={nav.pop} />
            <ScrollView contentContainerStyle={styles.body}>
                <Text style={styles.label}>服务地址</Text>
                <Text selectable style={styles.mono}>
                    {base || '启动中…'}
                </Text>

                {err ? (
                    <>
                        <Text style={[styles.label, { color: T.danger }]}>最后错误</Text>
                        <Text selectable style={[styles.mono, { color: T.danger }]}>
                            {err}
                        </Text>
                    </>
                ) : null}

                <View style={styles.ops}>
                    <Btn label="刷新" kind="ghost" small onPress={refresh} />
                    <Btn label="重启服务" kind="ghost" small style={{ marginLeft: 10 }} onPress={restart} />
                    <Btn label="环境信息" kind="ghost" small style={{ marginLeft: 10 }} onPress={loadDevLog} />
                </View>

                {devLog ? (
                    <>
                        <Text style={styles.label}>环境</Text>
                        <Text selectable style={styles.mono}>
                            {devLog}
                        </Text>
                    </>
                ) : null}

                <View style={styles.logHead}>
                    <Text style={styles.label}>日志（最新 {logs.length} 条）</Text>
                    <TouchableOpacity onPress={() => setLogs([])}>
                        <Text style={styles.clearText}>清屏</Text>
                    </TouchableOpacity>
                </View>
                <Text selectable style={styles.mono}>
                    {logs.length ? logs.slice().reverse().join('\n') : '暂无日志'}
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    body: { paddingHorizontal: T.pad, paddingBottom: 40 },
    label: { color: T.text3, fontSize: 11.5, marginTop: 18, marginBottom: 7 },
    mono: {
        color: T.text2,
        fontSize: 11,
        lineHeight: 17,
        backgroundColor: T.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.line,
        padding: 10,
    },
    ops: { flexDirection: 'row', marginTop: 16, flexWrap: 'wrap' },
    logHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    clearText: { color: T.text3, fontSize: 12, marginBottom: 7 },
});
