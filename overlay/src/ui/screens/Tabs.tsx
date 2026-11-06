/**
 * 底部 Tab 壳。四个 tab 自己切，不引导航库。
 * 视觉是悬浮胶囊条：绝对定位在底部，压住内容，所以每个可滚动页面底部都要留 TABBAR_SPACE。
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Home from './Home';
import Search from './Search';
import Catalog from './Catalog';
import Mine from './Mine';
import { IconGrid, IconHome, IconSearch, IconUser } from '../components/Icons';
import { T, TABBAR_BOTTOM } from '../../theme';

type TabKey = 'home' | 'search' | 'catalog' | 'mine';

export default function Tabs() {
    const [tab, setTab] = useState<TabKey>('home');

    return (
        <View style={styles.wrap}>
            <View style={styles.body}>
                {/* 四个页面都保活，切回来不丢滚动位置和已加载数据 */}
                <View style={[styles.page, tab !== 'home' && styles.hidden]}>
                    <Home active={tab === 'home'} onOpenSearch={() => setTab('search')} />
                </View>
                <View style={[styles.page, tab !== 'search' && styles.hidden]}>
                    <Search active={tab === 'search'} />
                </View>
                <View style={[styles.page, tab !== 'catalog' && styles.hidden]}>
                    <Catalog active={tab === 'catalog'} onPicked={() => setTab('home')} />
                </View>
                <View style={[styles.page, tab !== 'mine' && styles.hidden]}>
                    <Mine active={tab === 'mine'} />
                </View>
            </View>

            <View style={styles.bar}>
                <TabItem label="首页" on={tab === 'home'} onPress={() => setTab('home')}>
                    <IconHome size={20} color={tab === 'home' ? T.primary : T.text3} />
                </TabItem>
                <TabItem label="搜索" on={tab === 'search'} onPress={() => setTab('search')}>
                    <IconSearch size={20} color={tab === 'search' ? T.primary : T.text3} />
                </TabItem>
                <TabItem label="片库" on={tab === 'catalog'} onPress={() => setTab('catalog')}>
                    <IconGrid size={20} color={tab === 'catalog' ? T.primary : T.text3} />
                </TabItem>
                <TabItem label="我的" on={tab === 'mine'} onPress={() => setTab('mine')}>
                    <IconUser size={20} color={tab === 'mine' ? T.primary : T.text3} />
                </TabItem>
            </View>
        </View>
    );
}

function TabItem({
    label,
    on,
    onPress,
    children,
}: {
    label: string;
    on: boolean;
    onPress: () => void;
    children: React.ReactNode;
}) {
    return (
        <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={onPress}>
            <View style={styles.iconSlot}>{children}</View>
            <Text style={[styles.label, on && { color: T.primary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: T.bg },
    body: { flex: 1 },
    page: { ...StyleSheet.absoluteFillObject },
    hidden: { display: 'none' },
    bar: {
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: TABBAR_BOTTOM,
        height: 62,
        borderRadius: 31,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(18,18,20,0.96)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.07)',
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 14,
    },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // 图标高度固定，避免不同图标自身尺寸差异把文字顶得高低不齐
    iconSlot: { height: 22, alignItems: 'center', justifyContent: 'center' },
    label: { color: T.text3, fontSize: 10, marginTop: 2 },
});
