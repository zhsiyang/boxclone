/**
 * 根组件。路由分发 + 全局 Toast 宿主。
 * 用 RN 自带 SafeAreaView 兜刘海，不引 react-native-safe-area-context。
 */
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { NavProvider, useNav } from './src/nav/Stack';
import { ToastHost } from './src/ui/components/Common';
import Boot from './src/ui/screens/Boot';
import Tabs from './src/ui/screens/Tabs';
import Category from './src/ui/screens/Category';
import Detail from './src/ui/screens/Detail';
import Player from './src/ui/screens/Player';
import Sites from './src/ui/screens/Sites';
import SiteEdit from './src/ui/screens/SiteEdit';
import Records from './src/ui/screens/Records';
import Diagnostics from './src/ui/screens/Diagnostics';
import About from './src/ui/screens/About';
import { T } from './src/theme';

function Router() {
    const { current } = useNav();
    switch (current.name) {
        case 'Boot':
            return <Boot />;
        case 'Tabs':
            return <Tabs />;
        case 'Category':
            return <Category />;
        case 'Detail':
            return <Detail />;
        case 'Player':
            // 播放页自己管安全区：视频要贴边
            return <Player />;
        case 'Sites':
            return <Sites />;
        case 'SiteEdit':
            return <SiteEdit />;
        case 'Records':
            return <Records />;
        case 'Diagnostics':
            return <Diagnostics />;
        case 'About':
            return <About />;
        default:
            return <Boot />;
    }
}

export default function App() {
    return (
        <NavProvider>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor={T.bg} />
                <SafeAreaView style={s.safe}>
                    <Router />
                </SafeAreaView>
                <ToastHost />
            </View>
        </NavProvider>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    safe: { flex: 1, backgroundColor: T.bg },
});
