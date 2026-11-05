/**
 * 自绘矢量图标。全部用 View 的 border/圆角拼，不引 react-native-svg：
 * 少一个原生依赖，iOS 构建失败面小一圈。
 * 每个图标都按 size 等比缩放，颜色由 color 传入，选中态直接换色即可。
 */
import React from 'react';
import { View } from 'react-native';

type P = { size?: number; color?: string };

/** 放大镜：圆环 + 右下斜柄 */
export function IconSearch({ size = 16, color = '#8A8A92' }: P) {
    const ring = Math.round(size * 0.72);
    const sw = Math.max(1.4, size * 0.11);
    return (
        <View style={{ width: size, height: size }}>
            <View
                style={{
                    width: ring,
                    height: ring,
                    borderRadius: ring / 2,
                    borderWidth: sw,
                    borderColor: color,
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    right: 0,
                    bottom: Math.round(size * 0.06),
                    width: Math.round(size * 0.3),
                    height: sw,
                    borderRadius: sw,
                    backgroundColor: color,
                    transform: [{ rotate: '45deg' }],
                }}
            />
        </View>
    );
}

/** 四宫格 */
export function IconGrid({ size = 18, color = '#FFFFFF' }: P) {
    const gap = Math.round(size * 0.18);
    const cell = Math.floor((size - gap) / 2);
    const bw = Math.max(1.3, size * 0.09);
    const box = { width: cell, height: cell, borderRadius: 2.5, borderWidth: bw, borderColor: color } as const;
    return (
        <View style={{ width: size, height: size, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={box} />
                <View style={box} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={box} />
                <View style={box} />
            </View>
        </View>
    );
}

/** 房子：三角屋顶 + 实体墙 */
export function IconHome({ size = 18, color = '#FFFFFF' }: P) {
    const w = size;
    const roofH = Math.round(size * 0.46);
    const bodyW = Math.round(size * 0.72);
    const bodyH = Math.round(size * 0.44);
    return (
        <View style={{ width: w, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
            <View
                style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: w / 2,
                    borderRightWidth: w / 2,
                    borderBottomWidth: roofH + 2,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: color,
                }}
            />
            <View
                style={{
                    width: bodyW,
                    height: bodyH,
                    marginTop: -1,
                    backgroundColor: color,
                    borderBottomLeftRadius: Math.round(size * 0.12),
                    borderBottomRightRadius: Math.round(size * 0.12),
                }}
            />
        </View>
    );
}

/** 人像：头 + 半圆肩 */
export function IconUser({ size = 18, color = '#FFFFFF' }: P) {
    const head = Math.round(size * 0.4);
    const sw = Math.max(1.4, size * 0.11);
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={{ width: head, height: head, borderRadius: head / 2, borderWidth: sw, borderColor: color }} />
            <View
                style={{
                    width: Math.round(size * 0.78),
                    height: Math.round(size * 0.32),
                    marginTop: Math.round(size * 0.08),
                    borderTopLeftRadius: size,
                    borderTopRightRadius: size,
                    borderWidth: sw,
                    borderBottomWidth: 0,
                    borderColor: color,
                }}
            />
        </View>
    );
}

/** 叠层（片库）：三横条 */
export function IconStack({ size = 18, color = '#FFFFFF' }: P) {
    const sw = Math.max(1.6, size * 0.12);
    return (
        <View style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: size * 0.06 }}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        width: i === 1 ? size : size - i * 3,
                        height: sw,
                        borderRadius: sw,
                        backgroundColor: color,
                    }}
                />
            ))}
        </View>
    );
}

/** 评分徽标前的小星 */
export function IconStar({ size = 9, color = '#FFFFFF' }: P) {
    return (
        <View
            style={{
                width: size,
                height: size,
                backgroundColor: color,
                transform: [{ rotate: '45deg' }],
                borderRadius: 1.5,
            }}
        />
    );
}

/** 播放三角（列表里的「立即播放」用） */
export function IconPlay({ size = 12, color = '#FFFFFF' }: P) {
    return (
        <View
            style={{
                width: 0,
                height: 0,
                borderTopWidth: size * 0.5,
                borderBottomWidth: size * 0.5,
                borderLeftWidth: size * 0.85,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: color,
            }}
        />
    );
}
