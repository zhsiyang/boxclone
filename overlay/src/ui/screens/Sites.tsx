/**
 * 源管理：列表 + 测试 + 启停 + 导入导出。
 * 没有载荷的模板站点（url 和 ext 都空）也列出来，方便用户点进去填。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Api, Site } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Btn, Empty, Header, Loading, toast } from '../components/Common';
import { T } from '../../theme';

const TYPE_LABEL: Record<number, string> = {
    1: '苹果CMS',
    4: '直链/推送',
    9: '自定义JS',
    10: '阅读',
    20: '漫画',
    30: '音乐',
    40: '网盘',
};

export default function Sites() {
    const nav = useNav();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState('');
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [exportText, setExportText] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await Api.listSites();
            setSites(r.sites || []);
        } catch (e: any) {
            toast(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const add = async () => {
        try {
            const r = await Api.addSite({ name: '新站点', type: 1, url: '' });
            await load();
            nav.push('SiteEdit', { site: r.site, isNew: true });
        } catch (e: any) {
            toast('新增失败: ' + String(e?.message || e));
        }
    };

    const test = async (s: Site) => {
        if (!s.url && !s.ext) {
            toast('先填地址或脚本');
            return;
        }
        setTesting(s.key);
        try {
            const r = await Api.testSite(s.key);
            toast(`${s.name}: 取到 ${r.count} 条${r.sample?.length ? '（' + r.sample.join(' / ') + '）' : ''}`);
        } catch (e: any) {
            toast(`${s.name} 测试失败: ${String(e?.message || e)}`);
        } finally {
            setTesting('');
        }
    };

    const toggle = async (s: Site, v: boolean) => {
        try {
            await Api.updateSite(s.key, { enabled: v });
            setSites((old) => old.map((x) => (x.key === s.key ? { ...x, enabled: v } : x)));
        } catch (e: any) {
            toast('切换失败: ' + String(e?.message || e));
        }
    };

    const remove = (s: Site) => {
        Alert.alert('删除站点', `确定删除「${s.name}」？`, [
            { text: '取消', style: 'cancel' },
            {
                text: '删除',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await Api.removeSite(s.key);
                        await load();
                        toast('已删除');
                    } catch (e: any) {
                        toast('删除失败: ' + String(e?.message || e));
                    }
                },
            },
        ]);
    };

    const doExport = async () => {
        try {
            const r = await Api.exportSites();
            setExportText(JSON.stringify(r.sites.filter((s) => s.url || s.ext), null, 2));
        } catch (e: any) {
            toast(String(e?.message || e));
        }
    };

    const doImport = async () => {
        let arr: any;
        try {
            arr = JSON.parse(importText);
        } catch (e) {
            toast('JSON 格式不对');
            return;
        }
        try {
            const r = await Api.importSites(Array.isArray(arr) ? arr : arr.sites || []);
            setImportOpen(false);
            setImportText('');
            await load();
            toast(`导入 ${r.imported} 个`);
        } catch (e: any) {
            toast('导入失败: ' + String(e?.message || e));
        }
    };

    return (
        <View style={styles.wrap}>
            <Header
                title="源管理"
                onBack={nav.pop}
                right={
                    <TouchableOpacity onPress={add}>
                        <Text style={styles.addBtn}>+ 新增</Text>
                    </TouchableOpacity>
                }
            />

            {loading ? (
                <Loading />
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                    {sites.length === 0 ? <Empty text="还没有源" hint="点右上角新增一个" /> : null}

                    {sites.map((s) => {
                        const empty = !s.url && !s.ext;
                        return (
                            <TouchableOpacity
                                key={s.key}
                                activeOpacity={0.8}
                                onPress={() => nav.push('SiteEdit', { site: s, isNew: false })}
                                style={styles.card}
                            >
                                <View style={styles.cardTop}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {s.name}
                                    </Text>
                                    <View style={styles.typeTag}>
                                        <Text style={styles.typeText}>{TYPE_LABEL[s.type] || `类型${s.type}`}</Text>
                                    </View>
                                    <View style={{ flex: 1 }} />
                                    <Switch
                                        value={s.enabled !== false}
                                        onValueChange={(v) => toggle(s, v)}
                                        trackColor={{ false: T.surface3, true: 'rgba(62,99,255,0.55)' }}
                                        thumbColor={s.enabled !== false ? T.primary : '#8A90A2'}
                                    />
                                </View>

                                <Text style={styles.addr} numberOfLines={1}>
                                    {empty ? '未配置（点此填写）' : s.url || '脚本源'}
                                </Text>

                                <View style={styles.ops}>
                                    <TouchableOpacity onPress={() => test(s)} style={styles.opBtn}>
                                        <Text style={[styles.opText, testing === s.key && { color: T.text3 }]}>
                                            {testing === s.key ? '测试中…' : '测试'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => nav.push('SiteEdit', { site: s, isNew: false })}
                                        style={styles.opBtn}
                                    >
                                        <Text style={styles.opText}>编辑</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => remove(s)} style={styles.opBtn}>
                                        <Text style={[styles.opText, { color: T.danger }]}>删除</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    <View style={styles.bottomOps}>
                        <Btn label="导出配置" kind="ghost" small onPress={doExport} />
                        <Btn
                            label="导入配置"
                            kind="ghost"
                            small
                            style={{ marginLeft: 10 }}
                            onPress={() => setImportOpen(true)}
                        />
                        <Btn
                            label="恢复默认"
                            kind="plain"
                            small
                            style={{ marginLeft: 10 }}
                            onPress={() =>
                                Alert.alert('恢复默认', '会清空当前所有站点，确定？', [
                                    { text: '取消', style: 'cancel' },
                                    {
                                        text: '确定',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                await Api.resetSites();
                                                await load();
                                                toast('已重置');
                                            } catch (e: any) {
                                                toast(String(e?.message || e));
                                            }
                                        },
                                    },
                                ])
                            }
                        />
                    </View>
                </ScrollView>
            )}

            {/* 导入 */}
            <Modal visible={importOpen} transparent animationType="fade" onRequestClose={() => setImportOpen(false)}>
                <View style={styles.modalBg}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>导入配置</Text>
                        <Text style={styles.modalHint}>粘贴站点数组 JSON（[{'{'}"name","type","url"{'}'}, …]）</Text>
                        <TextInput
                            value={importText}
                            onChangeText={setImportText}
                            multiline
                            placeholder='[{"name":"我的源","type":1,"url":"https://xxx/api.php/provide/vod"}]'
                            placeholderTextColor={T.text3}
                            style={styles.textArea}
                        />
                        <View style={styles.modalOps}>
                            <Btn label="取消" kind="ghost" small onPress={() => setImportOpen(false)} />
                            <Btn label="导入" small style={{ marginLeft: 10 }} onPress={doImport} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 导出 */}
            <Modal visible={!!exportText} transparent animationType="fade" onRequestClose={() => setExportText('')}>
                <View style={styles.modalBg}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>导出配置</Text>
                        <Text style={styles.modalHint}>长按全选复制，存到网盘或备忘录</Text>
                        <ScrollView style={{ maxHeight: 320 }}>
                            <TextInput
                                value={exportText}
                                multiline
                                editable={false}
                                selectable
                                style={styles.textArea}
                            />
                        </ScrollView>
                        <View style={styles.modalOps}>
                            <Btn label="关闭" small onPress={() => setExportText('')} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    addBtn: { color: T.primary, fontSize: 14, fontWeight: '600' },
    card: {
        backgroundColor: T.surface,
        marginHorizontal: T.pad,
        marginBottom: 10,
        borderRadius: T.r2,
        padding: 14,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    name: { color: T.text, fontSize: 14.5, fontWeight: '600', maxWidth: '55%' },
    typeTag: {
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: T.surface3,
    },
    typeText: { color: T.text3, fontSize: 10 },
    addr: { color: T.text3, fontSize: 11.5, marginTop: 7 },
    ops: { flexDirection: 'row', marginTop: 12 },
    opBtn: { paddingVertical: 6, paddingRight: 20 },
    opText: { color: T.text2, fontSize: 12.5 },
    bottomOps: { flexDirection: 'row', justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    modalBox: {
        width: '88%',
        backgroundColor: T.surface,
        borderRadius: T.r2,
        padding: 16,
        maxHeight: '80%',
    },
    modalTitle: { color: T.text, fontSize: 15.5, fontWeight: '700' },
    modalHint: { color: T.text3, fontSize: 11.5, marginTop: 6, marginBottom: 10 },
    textArea: {
        backgroundColor: T.bg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.line,
        color: T.text2,
        fontSize: 11.5,
        padding: 10,
        minHeight: 150,
        textAlignVertical: 'top',
    },
    modalOps: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
});
