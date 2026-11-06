/*
 * ============================================================================
 * 在 react-native init 生成的 Android 壳上注入原生配置。幂等，可重复执行。
 *
 * 针对 RN 0.72.17 的真实模板（已按 facebook/react-native v0.72.17 tag 校对）：
 *
 *   android/build.gradle     ext.minSdkVersion 21 -> 24
 *                            （nodejs-mobile 的 libnode.so 最低 24，21-23 会跑不起来）
 *   android/gradle.properties reactNativeArchitectures 只留两个真机 ABI、
 *                            堆内存提到 4G、关 newArch
 *   app/build.gradle         defaultConfig.ndk.abiFilters（nodejs-mobile 会跟随这个值）、
 *                            release 用工程内 keystore 签名、so 冲突处理
 *   AndroidManifest.xml      cleartext http（采集站大量是 http）、largeHeap、
 *                            去掉竖屏锁、configChanges 补齐
 *   res/values/strings.xml   显示名
 *
 * 为什么 ABI 只留 arm64-v8a + armeabi-v7a：
 *   nodejs-mobile 的 libnode 编了 arm64-v8a / armeabi-v7a / x86_64 三个，
 *   没有 x86。RN 模板默认 reactNativeArchitectures 带 x86，打进去在 x86 模拟器
 *   上会因为找不到 libnode 直接崩，且白白增大包体。
 *
 * 用法：node patch-android.js <appDir>
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = process.argv[2];
if (!APP) {
    console.error('usage: node patch-android.js <appDir>');
    process.exit(1);
}

const AND = path.join(APP, 'android');
const DISPLAY_NAME = 'BoxClone';
const APPLICATION_ID = 'com.boxclone';
const MIN_SDK = 24;                 // nodejs-mobile 硬要求
const ABIS = ['arm64-v8a', 'armeabi-v7a'];
const MARK = 'BOXCLONE_ANDROID';

if (!fs.existsSync(AND)) {
    console.error('✗ 没有 android/ 目录，先跑 setup.sh');
    process.exit(1);
}

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => {
    const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (old === c) {
        console.log('  unchanged ' + path.relative(APP, p));
        return;
    }
    fs.writeFileSync(p, c);
    console.log('  patched ' + path.relative(APP, p));
};

/**
 * 按大括号配对取出某个块。不能用 [\s\S]*? 偷懒：
 * signingConfigs {} 后面紧跟 buildTypes { release {} }，非贪婪会跨块误判。
 */
function blockOf(s, name) {
    const m = s.match(new RegExp('\\b' + name + '\\s*\\{'));
    if (!m) return null;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < s.length && depth > 0) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        i++;
    }
    return { start: m.index, end: i, body: s.slice(m.index, i) };
}

/* ---------- 1) android/build.gradle：minSdk ---------- */
(function patchRootGradle() {
    const p = path.join(AND, 'build.gradle');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 android/build.gradle');
        return;
    }
    let s = read(p);
    let hit = false;

    // ext 块里是 "minSdkVersion = 21" 这种带等号的写法
    s = s.replace(/(\bminSdkVersion\s*=\s*)(\d+)/, (m, a, b) => {
        if (Number(b) < MIN_SDK) {
            hit = true;
            return a + MIN_SDK;
        }
        return m;
    });

    if (!hit && !new RegExp('minSdkVersion\\s*=\\s*' + MIN_SDK).test(s)) {
        // ext 块里没有 minSdkVersion，直接补到 ext 内
        s = s.replace(/(ext\s*\{)/, `$1\n        minSdkVersion = ${MIN_SDK}`);
        hit = true;
    }

    if (hit) write(p, s);
    else console.log('  android/build.gradle minSdk 已是 ' + MIN_SDK);
})();

/* ---------- 2) gradle.properties ---------- */
(function patchGradleProps() {
    const p = path.join(AND, 'gradle.properties');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 gradle.properties');
        return;
    }
    let s = read(p);
    const before = s;

    // ABI：去掉 x86 / x86_64
    if (/^reactNativeArchitectures=.*$/m.test(s)) {
        s = s.replace(/^reactNativeArchitectures=.*$/m,
            'reactNativeArchitectures=' + ABIS.join(','));
    } else {
        s = s.trimEnd() + '\nreactNativeArchitectures=' + ABIS.join(',') + '\n';
    }

    // 堆内存：node + RN + 4 个 ABI 的 CMake 一起编，2G 会 OOM
    if (/^org\.gradle\.jvmargs=.*$/m.test(s)) {
        s = s.replace(/^org\.gradle\.jvmargs=.*$/m,
            'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m');
    } else {
        s = s.trimEnd() + '\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m\n';
    }

    // 新架构必须关：Fabric 的 JNI 初始化顺序和 nodejs-mobile 冲突
    if (/^newArchEnabled=.*$/m.test(s)) {
        s = s.replace(/^newArchEnabled=.*$/m, 'newArchEnabled=false');
    } else {
        s = s.trimEnd() + '\nnewArchEnabled=false\n';
    }

    if (!/hermesEnabled/.test(s)) s = s.trimEnd() + '\nhermesEnabled=true\n';

    if (s === before) console.log('  gradle.properties 已处理过，跳过');
    else write(p, s);
})();

/* ---------- 3) app/build.gradle ---------- */
(function patchAppGradle() {
    const p = path.join(AND, 'app/build.gradle');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 app/build.gradle');
        return;
    }
    let s = read(p);
    if (s.includes(MARK)) {
        console.log('  app/build.gradle 已处理过，跳过');
        return;
    }

    // --- 3.1 applicationId ---
    s = s.replace(/(\bapplicationId\s+)"[^"]*"/, `$1"${APPLICATION_ID}"`);
    s = s.replace(/(\bnamespace\s+)"[^"]*"/, `$1"${APPLICATION_ID}"`);

    // --- 3.2 defaultConfig 里加 ndk.abiFilters ---
    // 模板的 defaultConfig 只有 applicationId/minSdk/targetSdk/versionCode/versionName，
    // 没有 ndk 块，所以插在 versionName 那行后面
    if (!s.includes('abiFilters')) {
        const ndkBlock = `
        ndk {
            // BOXCLONE_ANDROID: nodejs-mobile 的 libnode 只有这几个 ABI
            abiFilters ${ABIS.map((a) => `"${a}"`).join(', ')}
        }`;
        s = s.replace(/(\n\s*versionName\s+"[^"]*"\n)/, '$1' + ndkBlock + '\n');
    }

    // --- 3.3 release 签名 ---
    // 模板已经有 signingConfigs { debug {...} }，release 用的是 signingConfigs.debug。
    // 必须按块判断 release 在不在，整体正则会把 buildTypes 里的 release 误认成已存在。
    const sc = blockOf(s, 'signingConfigs');
    if (sc && !/\brelease\s*\{/.test(sc.body)) {
        s = s.slice(0, sc.start) + `signingConfigs {
        // BOXCLONE_ANDROID: release 用工程内 keystore，由 build-apk.sh 生成
        // （找不到文件时退回 debug 签名，保证 CI 上一定能出可安装包）
        release {
            def ks = file("boxclone.keystore")
            if (ks.exists()) {
                storeFile ks
                storePassword "boxclone"
                keyAlias "boxclone"
                keyPassword "boxclone"
            }
        }
        ` + s.slice(sc.start + 'signingConfigs {'.length);
    } else if (!sc) {
        // 模板里连 signingConfigs 都没有，补在 buildTypes 前
        s = s.replace(/(\n\s*buildTypes\s*\{)/, `
    signingConfigs {
        release {
            def ks = file("boxclone.keystore")
            if (ks.exists()) {
                storeFile ks
                storePassword "boxclone"
                keyAlias "boxclone"
                keyPassword "boxclone"
            }
        }
    }
$1`);
    }

    // buildTypes.release 里的 signingConfig 指向 release（模板是 debug）
    s = s.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
        (m, pre) => pre + 'signingConfig signingConfigs.release');

    // --- 3.4 packagingOptions：so 冲突 ---
    if (!s.includes('pickFirst')) {
        // 插在 android { 后面最稳，不依赖结尾大括号的缩进
        s = s.replace(/(android\s*\{)/, `$1
    // BOXCLONE_ANDROID: RN 与 nodejs-mobile 都会带这些 so
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
        pickFirst '**/libfbjni.so'
        pickFirst '**/libhermes.so'
    }`);
    }

    s = '// ' + MARK + '\n' + s;
    write(p, s);
})();

/* ---------- 4) AndroidManifest.xml ---------- */
(function patchManifest() {
    const p = path.join(AND, 'app/src/main/AndroidManifest.xml');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 AndroidManifest.xml');
        return;
    }
    let s = read(p);
    if (s.includes(MARK)) {
        console.log('  AndroidManifest 已处理过，跳过');
        return;
    }

    // INTERNET：模板默认有
    if (!/android\.permission\.INTERNET/.test(s)) {
        s = s.replace(/(<manifest[^>]*>)/,
            '$1\n\n    <uses-permission android:name="android.permission.INTERNET" />');
    }
    // 息屏续播
    if (!/android\.permission\.WAKE_LOCK/.test(s)) {
        s = s.replace(/(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/,
            '$1\n    <uses-permission android:name="android.permission.WAKE_LOCK" />');
    }

    // application 属性：cleartext 是必须的，采集站大量 http
    const want = [
        ['android:usesCleartextTraffic', 'android:usesCleartextTraffic="true"'],
        ['android:largeHeap', 'android:largeHeap="true"'],
    ];
    const add = want.filter(([k]) => !s.includes(k)).map(([, v]) => v);
    if (add.length) {
        s = s.replace(/<application\b/, '<application\n        ' + add.join('\n        '));
    }

    // 竖屏锁：模板没有，有就删
    s = s.replace(/\s+android:screenOrientation="[^"]*"/g, '');

    // configChanges 补齐（模板已含常用几项，缺的补上）
    s = s.replace(/android:configChanges="([^"]*)"/, (m, g) => {
        const need = ['keyboard', 'keyboardHidden', 'orientation', 'screenLayout',
            'screenSize', 'smallestScreenSize', 'uiMode'];
        const have = g.split('|').map((x) => x.trim()).filter(Boolean);
        for (const n of need) if (!have.includes(n)) have.push(n);
        return 'android:configChanges="' + have.join('|') + '"';
    });

    s = '<!-- ' + MARK + ': cleartext http / largeHeap / 旋转 -->\n' + s;
    write(p, s);
})();

/* ---------- 5) strings.xml ---------- */
(function patchStrings() {
    const p = path.join(AND, 'app/src/main/res/values/strings.xml');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 res/values/strings.xml');
        return;
    }
    let s = read(p);
    if (s.includes(`<string name="app_name">${DISPLAY_NAME}</string>`)) {
        console.log('  strings.xml 已是 ' + DISPLAY_NAME);
        return;
    }
    s = s.replace(/<string name="app_name">[^<]*<\/string>/,
        `<string name="app_name">${DISPLAY_NAME}</string>`);
    write(p, s);
})();

/* ---------- 6) nodejs-assets 检查 ---------- */
(function checkNodeAssets() {
    const proj = path.join(APP, 'nodejs-assets/nodejs-project');
    if (!fs.existsSync(proj)) {
        console.warn('  ! nodejs-assets/nodejs-project 不存在，内嵌 Node 会启动失败');
        return;
    }
    const files = fs.readdirSync(proj);
    console.log('  nodejs-project: ' + files.length + ' 项 [' + files.slice(0, 6).join(', ') + ']');
    if (!files.includes('main.js')) console.warn('  ! 缺 main.js');
    if (!files.includes('node_modules')) {
        console.log('  · 无 node_modules（零依赖设计，跳过 BuildNpmModules，构建更快）');
    }
})();

console.log('patch-android.js 完成。');
