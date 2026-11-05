/*
 * ============================================================================
 * 在 react-native init 生成的壳上注入 iOS 原生配置。幂等，可重复执行。
 *
 *   1) Info.plist   : 后台音频 / ATS 放行 http / 支持横屏 / 显示名
 *   2) AppDelegate  : AVAudioSession 设为 playback（息屏续播的前提）
 *   3) Podfile      : 部署目标 13.4（react-native-video 6 要求）+ 关掉 Flipper
 *
 * 关 Flipper 不是为了省事：它带一堆 C++ 依赖，在 Xcode 15/16 上是最常见的
 * iOS 构建失败来源，且这个 App 用不到它的调试面板。
 *
 * 用法：node patch.js <appDir>
 * ============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = process.argv[2];
if (!APP) {
    console.error('usage: node patch.js <appDir>');
    process.exit(1);
}

const IOS = path.join(APP, 'ios');
const NAME = 'BoxClone';
const DISPLAY_NAME = 'BoxClone';

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

/* ---------- 1) Info.plist ---------- */
(function patchPlist() {
    const p = path.join(IOS, NAME, 'Info.plist');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 Info.plist: ' + p);
        return;
    }
    let s = read(p);
    if (s.includes('BC_PATCHED')) {
        console.log('  Info.plist 已处理过，跳过');
        return;
    }

    const inject =
        '\t<!-- BC_PATCHED: 后台音频 + ATS + 横屏 -->\n' +
        '\t<key>UIBackgroundModes</key>\n' +
        '\t<array>\n\t\t<string>audio</string>\n\t</array>\n' +
        '\t<key>NSAppTransportSecurity</key>\n' +
        '\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>\n' +
        '\t<key>UISupportedInterfaceOrientations</key>\n' +
        '\t<array>\n' +
        '\t\t<string>UIInterfaceOrientationPortrait</string>\n' +
        '\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n' +
        '\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n' +
        '\t</array>\n' +
        '\t<key>UISupportedInterfaceOrientations~ipad</key>\n' +
        '\t<array>\n' +
        '\t\t<string>UIInterfaceOrientationPortrait</string>\n' +
        '\t\t<string>UIInterfaceOrientationPortraitUpsideDown</string>\n' +
        '\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n' +
        '\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n' +
        '\t</array>\n';

    if (/<\/dict>\s*<\/plist>\s*$/.test(s)) {
        s = s.replace(/<\/dict>\s*<\/plist>\s*$/, inject + '</dict>\n</plist>\n');
    } else {
        console.warn('  ! Info.plist 结尾结构不符预期，注入位置可能不准');
        return;
    }

    // 若模板已有同名 key，删掉旧的以免重复（重复 key 会导致 plist 解析行为不确定）
    s = stripDupKey(s, 'UIBackgroundModes');
    s = stripDupKey(s, 'NSAppTransportSecurity');
    s = stripDupKey(s, 'UISupportedInterfaceOrientations');

    // 显示名
    if (/<key>CFBundleDisplayName<\/key>/.test(s)) {
        s = s.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${DISPLAY_NAME}$2`);
    }

    write(p, s);
})();

/**
 * 按标签深度配对，定位 `<key>K</key>` 后面的那个值节点，返回 [start, end) 区间。
 *
 * 不能用非贪婪正则：模板里的 NSAppTransportSecurity 是 dict 套 dict，
 * `[\s\S]*?</dict>` 会停在内层 </dict>，删完留下落单的闭合标签，
 * builtin-infoPlistUtility 直接报 PropertyListConversionError。
 */
function findValueNode(xml, key, from) {
    const k = `<key>${key}</key>`;
    const ki = xml.indexOf(k, from || 0);
    if (ki < 0) return null;

    let i = ki + k.length;
    while (i < xml.length && /\s/.test(xml[i])) i++;

    const head = xml.slice(i, i + 6);
    const isArray = head.startsWith('<array');
    const isDict = head.startsWith('<dict');
    if (!isArray && !isDict) {
        // 标量：<string>..</string> / <true/> / <false/>
        const gt = xml.indexOf('>', i);
        if (gt < 0) return null;
        if (xml.slice(i, i + 2) === '</') return null;
        if (xml[gt - 1] === '/') return { start: ki, end: gt + 1 };
        const m = /^<([A-Za-z]+)/.exec(xml.slice(i));
        if (!m) return null;
        const closeS = xml.indexOf(`</${m[1]}>`, i);
        if (closeS < 0) return null;
        return { start: ki, end: closeS + m[1].length + 3 };
    }

    const tag = isArray ? 'array' : 'dict';
    const open = `<${tag}`;
    const close = `</${tag}>`;
    let depth = 0;
    let j = i;
    while (j < xml.length) {
        const o = xml.indexOf(open, j);
        const c = xml.indexOf(close, j);
        if (c < 0) return null;
        if (o >= 0 && o < c) {
            const gt = xml.indexOf('>', o);
            if (gt < 0) return null;
            if (xml[gt - 1] === '/') {
                j = gt + 1;            // <dict/> 自闭合，不加深度
            } else {
                depth++;
                j = o + open.length;
            }
        } else {
            depth--;
            j = c + close.length;
            if (depth === 0) return { start: ki, end: j };
        }
    }
    return null;
}

/** 删掉除最后一次出现的 key（保留我们刚注入的那份） */
function stripDupKey(plist, key) {
    const spans = [];
    let from = 0;
    for (;;) {
        const n = findValueNode(plist, key, from);
        if (!n) break;
        spans.push(n);
        from = n.end;
    }
    if (spans.length <= 1) return plist;

    // 从后往前删，避免前面的下标失效
    let out = plist;
    for (let i = spans.length - 2; i >= 0; i--) {
        out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
    }
    return out;
}

/* ---------- 2) AppDelegate ---------- */
(function patchAppDelegate() {
    const cands = ['AppDelegate.mm', 'AppDelegate.m', 'AppDelegate.swift'].map((f) => path.join(IOS, NAME, f));
    const p = cands.find((f) => fs.existsSync(f));
    if (!p) {
        console.warn('  ! 没找到 AppDelegate，跳过 AVAudioSession');
        return;
    }
    let s = read(p);
    if (s.includes('AVAudioSession')) {
        console.log('  AppDelegate 已有 AVAudioSession，跳过');
        return;
    }

    if (p.endsWith('.swift')) {
        if (!s.includes('import AVFoundation')) s = s.replace(/import UIKit/, 'import UIKit\nimport AVFoundation');
        s = s.replace(
            /(func application\([^)]*didFinishLaunchingWithOptions[^{]*\{)/,
            '$1\n    // BoxClone: 后台/息屏续播\n    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)\n    try? AVAudioSession.sharedInstance().setActive(true)'
        );
        write(p, s);
        return;
    }

    if (!s.includes('#import <AVFoundation/AVFoundation.h>')) {
        s = s.replace(/(#import "AppDelegate\.h")/, '$1\n#import <AVFoundation/AVFoundation.h>');
    }
    s = s.replace(
        /(didFinishLaunchingWithOptions:[^{]*\{)/,
        '$1\n  // BoxClone: 后台/息屏续播\n  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];\n  [[AVAudioSession sharedInstance] setActive:YES error:nil];'
    );
    write(p, s);
})();

/* ---------- 3) Podfile ---------- */
(function patchPodfile() {
    const p = path.join(IOS, 'Podfile');
    if (!fs.existsSync(p)) {
        console.warn('  ! 没找到 Podfile');
        return;
    }
    let s = read(p);

    // 部署目标
    if (/platform :ios, '13\.4'/.test(s)) {
        console.log('  Podfile 已是 13.4');
    } else if (/platform :ios, min_ios_version_supported/.test(s)) {
        s = s.replace(/platform :ios, min_ios_version_supported/, "platform :ios, '13.4'");
    } else if (/platform :ios, '[\d.]+'/.test(s)) {
        s = s.replace(/platform :ios, '[\d.]+'/, "platform :ios, '13.4'");
    } else {
        console.warn('  ! Podfile 里找不到 platform 行');
    }

    // 关 Flipper：三种写法都兜一遍
    if (/FlipperConfiguration\.enabled/.test(s)) s = s.replace(/FlipperConfiguration\.enabled/g, 'FlipperConfiguration.disabled');
    if (/:flipper_configuration\s*=>\s*flipper_config/.test(s)) s = s.replace(/:flipper_configuration\s*=>\s*flipper_config/, ':flipper_configuration => FlipperConfiguration.disabled');
    if (/use_flipper!/.test(s)) s = s.replace(/^\s*use_flipper!.*$/gm, '  # use_flipper!  # BoxClone: disabled');
    if (/flipper_post_install/.test(s)) s = s.replace(/^\s*flipper_post_install.*$/gm, '  # flipper_post_install  # BoxClone: disabled');

    write(p, s);
})();

console.log('patch.js 完成。');
