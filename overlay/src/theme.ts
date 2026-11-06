/**
 * 视觉基线。纯黑底 + 蓝紫强调，海报为主视觉，文字只用三档灰度。
 * key 名保持和旧版一致，其它页面不用跟着改就能吃到新配色。
 */
import { Platform } from 'react-native';

export const T = {
    // 背景层次（越靠上层越亮一档）
    bg: '#000000',
    surface: '#0D0D0F',
    surface2: '#1A1A1D',
    surface3: '#26262B',

    // 分割线与描边
    line: '#1C1C20',
    line2: '#2A2A30',

    // 文字
    text: '#FFFFFF',
    text2: '#A0A0A8',
    text3: '#6A6A72',

    // 强调色（选中态蓝，渐变尾是紫）
    primary: '#3E63FF',
    primary2: '#8A5CFF',
    primaryDim: 'rgba(62,99,255,0.15)',

    // 语义色
    ok: '#38C172',
    warn: '#F2A93B',
    danger: '#F05252',
    gold: '#F5C451',

    // 尺寸
    r: 10, // 卡片圆角
    r2: 16,
    pad: 16,

    // 字号
    fs: {
        h1: 22,
        h2: 18,
        h3: 15,
        body: 14,
        sub: 12.5,
        tiny: 11,
    },
};

/**
 * 悬浮 TabBar 占的高度，可滚动页面底部必须留出这段，否则最后一排被盖住。
 * Android 手势导航条会额外吃掉 16-24dp，这里多留一点。
 */
export const TABBAR_SPACE = Platform.OS === 'android' ? 116 : 104;

/**
 * 悬浮 TabBar 距屏幕底的距离。
 * iOS 靠 SafeAreaView 兜了 home indicator，Android 没有这层，要自己抬。
 */
export const TABBAR_BOTTOM = Platform.OS === 'android' ? 22 : 14;

/** iOS 走 SafeAreaView，Android 状态栏不透明、window 已排除，两边都不用额外 padding */
export const IS_ANDROID = Platform.OS === 'android';

/** 海报素材多数是 2:3，但竖版剧照实际比 1.45 高一点，按参考稿取 1.47 */
export const POSTER_RATIO = 1.47;

/** 网格列间距 */
export const GRID_GAP = 8;

/** 海报比例 2:3，按屏宽算卡片宽 */
export function posterSize(winW: number, cols = 3) {
    const gap = GRID_GAP;
    const sidePad = T.pad * 2;
    const w = Math.floor((winW - sidePad - gap * (cols - 1)) / cols);
    return { w, h: Math.round(w * POSTER_RATIO), gap };
}
