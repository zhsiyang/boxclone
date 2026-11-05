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

/** 删掉除最后一次出现的 key（保留我们刚注入的那份） */
function stripDupKey(plist, key) {
    const re = new RegExp(`<key>${key}</key>\\s*<(array|dict)>[\\s\\S]*?</\\1>`, 'g');
    const all = plist.match(re);
    if (!all || all.length <= 1) return plist;
    let seen = 0;
    return plist.replace(re, (m) => {
        seen++;
        return seen < all.length ? '' : m;
    });
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
