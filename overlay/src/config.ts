/**
 * 全局常量。跟运行时强相关的东西集中在这里，改一行就能调。
 */

/** 内嵌 Node 服务的启动超时（iOS 首启要起 Node 线程，给足时间） */
export const BOOT_TIMEOUT = 25000;

/** 单个 spider 请求的超时，超过就判失败并允许重试 */
export const REQ_TIMEOUT = 20000;

/** 首页一次拉多少条 */
export const PAGE_SIZE = 20;

/** 详情页线路/选集折叠阈值，超过就先收起 */
export const EPISODE_COLLAPSE = 30;

/** 搜索结果每个站最多取多少条 */
export const SEARCH_PER_SITE = 30;

/** 播放器可选倍速 */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** 播放器长按快进秒数（左退右进） */
export const SEEK_STEP = 10;

/** 默认设置，首次启动写进 prefs.settings */
export const DEFAULT_SETTINGS = {
    autoFullscreenLandscape: true, // 进播放页自动横屏
    playInBackground: true, // 后台/息屏续播声音
    autoNextEpisode: true, // 播完自动下一集
    rememberPosition: true, // 记住播放进度
    gridCols: 3, // 海报列数
};
