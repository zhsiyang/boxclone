/**
 * 站点编辑。ext 字段在不同 type 下语义不同：
 *   type=1（苹果CMS）-> 采集路径，默认 api.php/provide/vod
 *   type=4（直链）   -> 片单，多行 "名称$地址"
 *   type=9（自定义） -> JS 源码
 * 所以按 type 切表单，别把三种搅在一个输入框里。
 */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Api, Site } from '../../api/CatApi';
import { useNav } from '../../nav/Stack';
import { Btn, Header, toast } from '../components/Common';
import { T } from '../../theme';

const TYPES = [
    { v: 1, label: '苹果CMS' },
    { v: 4, label: '直链/推送' },
    { v: 9, label: '自定义JS' },
];

const SCRIPT_TPL = `// 简化契约：导出 home/category/detail/play/search
// ctx = { site, body, fetch, require, buffer, log }
module.exports = {
  async init(ctx){ return {}; },

  // 首页：分类表 + 一批资源
  async home(ctx){
    return {
      class: [{ type_id: 'all', type_name: '全部' }],
      list: [{
        vod_id: 'demo-1',
        vod_name: '示例条目',
        vod_pic: '',
        vod_content: '把这里换成你的解析逻辑',
        vod_play_from: '默认',
        vod_play_url: '正片$http://example.com/a.m3u8',
      }],
    };
  },

  async category(ctx){
    return { page: 1, pagecount: 1, limit: 0, total: 0, list: [] };
  },

  async detail(ctx){
    const id = ctx.body.id;
    return { list: [{ vod_id: id, vod_name: '详情', vod_pic: '', vod_content: '',
      vod_play_from: '默认', vod_play_url: '正片$http://example.com/a.m3u8' }] };
  },

  async play(ctx){
    return { parse: 0, url: ctx.body.id };
  },

  async search(ctx){
    return { page: 1, pagecount: 1, limit: 0, total: 0, list: [] };
  },
};
`;

export default function SiteEdit() {
    const nav = useNav();
    const { site, isNew } = nav.current.params as { site: Site; isNew: boolean };

    const [name, setName] = useState(site.name || '');
    const [type, setType] = useState<number>(site.type || 1);
    const [url, setUrl] = useState(site.url || '');
    const [ext, setExt] = useState(site.ext || '');
    const [enabled, setEnabled] = useState(site.enabled !== false);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!name.trim()) {
            toast('名字不能为空');
            return;
        }
        if (type !== 9 && !url.trim()) {
            toast('地址不能为空');
            return;
        }
        setSaving(true);
        try {
            const patch = { name: name.trim(), type, url: url.trim(), ext, enabled };
            if (isNew) await Api.updateSite(site.key, patch);
            else await Api.updateSite(site.key, patch);
            toast('已保存');
            nav.pop();
        } catch (e: any) {
            toast('保存失败: ' + String(e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    const testNow = async () => {
        setSaving(true);
        try {
            await Api.updateSite(site.key, { name: name.trim(), type, url: url.trim(), ext, enabled });
            const r = await Api.testSite(site.key);
            toast(`可用：${r.count} 条${r.sample?.length ? '（' + r.sample.join(' / ') + '）' : ''}`);
        } catch (e: any) {
            toast('不可用: ' + String(e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.wrap}>
            <Header
                title={isNew ? '新增源' : '编辑源'}
                subtitle={isNew ? undefined : site.key}
                onBack={nav.pop}
                right={
                    <TouchableOpacity onPress={save} disabled={saving}>
                        <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>保存</Text>
                    </TouchableOpacity>
                }
            />

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>名称</Text>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="给这个源起个名"
                    placeholderTextColor={T.text3}
                    style={styles.input}
                />

                <Text style={styles.label}>类型</Text>
                <View style={styles.typeRow}>
                    {TYPES.map((t) => (
                        <TouchableOpacity
                            key={t.v}
                            onPress={() => setType(t.v)}
                            style={[styles.typeChip, type === t.v && styles.typeChipOn]}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.typeText, type === t.v && { color: '#fff' }]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {type !== 9 ? (
                    <>
                        <Text style={styles.label}>{type === 4 ? '直链地址' : '站点地址'}</Text>
                        <TextInput
                            value={url}
                            onChangeText={setUrl}
                            placeholder={type === 4 ? 'http://…/movie.m3u8' : 'https://…（可省略 /api.php/provide/vod）'}
                            placeholderTextColor={T.text3}
                            style={styles.input}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </>
                ) : null}

                {type === 1 ? (
                    <>
                        <Text style={styles.label}>采集路径</Text>
                        <TextInput
                            value={ext}
                            onChangeText={setExt}
                            placeholder="api.php/provide/vod"
                            placeholderTextColor={T.text3}
                            style={styles.input}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text style={styles.hint}>留空用默认 api.php/provide/vod</Text>
                    </>
                ) : null}

                {type === 4 ? (
                    <>
                        <Text style={styles.label}>片单（可选）</Text>
                        <TextInput
                            value={ext}
                            onChangeText={setExt}
                            placeholder={'第一集$http://…/1.m3u8\n第二集$http://…/2.m3u8\n# 以 # 开头的行会被跳过'}
                            placeholderTextColor={T.text3}
                            style={[styles.input, styles.area]}
                            multiline
                            textAlignVertical="top"
                        />
                        <Text style={styles.hint}>填了片单就按片单出，忽略上面的单条地址</Text>
                    </>
                ) : null}

                {type === 9 ? (
                    <>
                        <Text style={styles.label}>JS 脚本</Text>
                        <TextInput
                            value={ext}
                            onChangeText={setExt}
                            placeholder={SCRIPT_TPL}
                            placeholderTextColor={T.text3}
                            style={[styles.input, styles.script]}
                            multiline
                            textAlignVertical="top"
                            autoCapitalize="none"
                            autoCorrect={false}
                            spellCheck={false}
                        />
                        <View style={styles.scriptOps}>
                            <Btn
                                label="填入模板"
                                kind="ghost"
                                small
                                onPress={() => {
                                    if (ext.trim()) {
                                        Alert.alert('覆盖脚本', '已有内容，确定用模板覆盖？', [
                                            { text: '取消', style: 'cancel' },
                                            { text: '覆盖', style: 'destructive', onPress: () => setExt(SCRIPT_TPL) },
                                        ]);
                                    } else {
                                        setExt(SCRIPT_TPL);
                                    }
                                }}
                            />
                            <Text style={styles.hint2}>改完保存即生效，不用重启</Text>
                        </View>
                    </>
                ) : null}

                <View style={styles.swRow}>
                    <Text style={styles.label2}>启用</Text>
                    <View style={{ flex: 1 }} />
                    <Switch
                        value={enabled}
                        onValueChange={setEnabled}
                        trackColor={{ false: T.surface3, true: 'rgba(62,99,255,0.55)' }}
                        thumbColor={enabled ? T.primary : '#8A90A2'}
                    />
                </View>

                <View style={styles.footOps}>
                    <Btn label={saving ? '请稍候…' : '保存'} onPress={save} disabled={saving} />
                    <Btn
                        label="测试连通"
                        kind="ghost"
                        style={{ marginLeft: 10 }}
                        disabled={saving}
                        onPress={testNow}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    saveBtn: { color: T.primary, fontSize: 14, fontWeight: '600' },
    body: { paddingHorizontal: T.pad, paddingBottom: 40 },
    label: { color: T.text3, fontSize: 11.5, marginTop: 18, marginBottom: 7, marginLeft: 2 },
    label2: { color: T.text, fontSize: 14 },
    input: {
        backgroundColor: T.surface,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: T.line,
        color: T.text,
        fontSize: 13.5,
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    area: { minHeight: 100, paddingTop: 10 },
    script: { minHeight: 240, fontSize: 11.5, lineHeight: 16 },
    hint: { color: T.text3, fontSize: 11, marginTop: 6, marginLeft: 2 },
    hint2: { color: T.text3, fontSize: 11, marginLeft: 10 },
    scriptOps: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap' },
    typeChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: T.surface2,
        marginRight: 8,
        marginBottom: 8,
    },
    typeChipOn: { backgroundColor: T.primary },
    typeText: { color: T.text2, fontSize: 12.5 },
    swRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 22,
        paddingVertical: 6,
        paddingHorizontal: 2,
    },
    footOps: { flexDirection: 'row', marginTop: 26 },
});
