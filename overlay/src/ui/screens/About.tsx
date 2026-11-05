/**
 * 关于页。把「这是个壳、内容源要自己配」说清楚，省得用户以为是内置影视库。
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNav } from '../../nav/Stack';
import { Header } from '../components/Common';
import { T } from '../../theme';

export default function About() {
    const nav = useNav();
    return (
        <View style={styles.wrap}>
            <Header title="关于" onBack={nav.pop} />
            <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.logoBox}>
                    <Text style={styles.logoText}>BOX</Text>
                </View>
                <Text style={styles.name}>BoxClone v1.0.0</Text>
                <Text style={styles.sub}>iOS 影视聚合客户端 · 内嵌 Node 运行时</Text>

                <Text style={styles.h1}>这是什么</Text>
                <Text style={styles.p}>
                    一个空壳播放器：App 本身不含任何影视内容，只提供浏览、搜索、播放和源管理能力。
                    所有内容都来自你自己配置的采集接口或自定义 JS 脚本。
                </Text>

                <Text style={styles.h1}>技术结构</Text>
                <Text style={styles.p}>
                    React Native 负责界面，nodejs-mobile 在子线程里跑一个 Node 18 服务，
                    爬虫逻辑跑在 Node 侧，RN 通过本机 HTTP 调它。这样加源、改解析逻辑都不用重编 App。
                </Text>
                <Text style={styles.code}>
                    {`RN (UI) ──rn-bridge── nodejs-mobile (Node 18)
        └─ 127.0.0.1:随机端口
             /config   /sites   /prefs
             /spider/{key}/{type}/{action}`}
                </Text>

                <Text style={styles.h1}>支持的源类型</Text>
                <Text style={styles.p}>
                    · 苹果CMS v10：填站点地址即可，自动走 api.php/provide/vod{'\n'}
                    · 直链/推送：单条 m3u8/mp4，或多行「名称$地址」片单{'\n'}
                    · 自定义 JS：按简化契约导出 home/category/detail/play/search
                </Text>

                <Text style={styles.h1}>能做什么 / 不能做什么</Text>
                <Text style={styles.p}>
                    能：多源浏览、聚合搜索、多线路多集、播放进度记忆、后台与息屏续播、
                    全屏自动横屏、倍速、收藏。<br />
                    不能：需要网页嗅探的地址（parse=1）不处理；不支持 CatVodOpen 的 fastify 插件式源，
                    要按简化契约改写。
                </Text>

                <Text style={styles.footer}>
                    Node 运行时基于 nodejs-mobile；播放基于 react-native-video。{'\n'}
                    本项目不提供、不内置、不分发任何内容源。
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    body: { paddingHorizontal: T.pad, paddingBottom: 40, alignItems: 'flex-start' },
    logoBox: {
        width: 64,
        height: 64,
        borderRadius: 17,
        backgroundColor: T.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    logoText: { color: '#fff', fontSize: 18, fontWeight: '900' },
    name: { color: T.text, fontSize: 17, fontWeight: '800', marginTop: 12 },
    sub: { color: T.text3, fontSize: 12, marginTop: 5 },
    h1: { color: T.text, fontSize: 14, fontWeight: '700', marginTop: 26, marginBottom: 8 },
    p: { color: T.text2, fontSize: 12.5, lineHeight: 20 },
    code: {
        color: T.text3,
        fontSize: 10.5,
        lineHeight: 17,
        backgroundColor: T.surface,
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
        alignSelf: 'stretch',
        fontFamily: 'Menlo',
    },
    footer: { color: T.text3, fontSize: 11, lineHeight: 17, marginTop: 30 },
});
