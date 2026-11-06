# BoxClone — iOS / Android 影视聚合客户端（内嵌 Node 运行时）

复刻 iBox 的功能形态：多源浏览、聚合搜索、多线路选集、播放记忆、后台续播。
技术路线沿用饭佬那套（CatVodOpen iOS 端）的架构——**React Native 做界面，nodejs-mobile 在子线程跑 Node 18，
爬虫逻辑跑在 Node 侧，RN 通过本机 HTTP 调它**。

**同一套代码出两个平台**：iOS 走 `build-ipa.sh`（macOS + Xcode），
Android 走 `build-apk.sh`（任意平台 + JDK + Android SDK）。界面、爬虫、状态全在 `overlay/` 里共用，
平台差异只有 `patch.js` / `patch-android.js` 两个原生配置注入脚本。

跟原版的两处关键差别：

1. **不依赖任何远端源分发**。原版从 `cat.猫影视.top` 拉 `index.js` + md5 校验（该域名已 530 失效）。
   这里爬虫服务直接内置进 App，装完就能起，不会被源站下线打死。
2. **零 npm 依赖**。Node 侧只用 `node:http` + Node 18 内置 `fetch`，不引 fastify/axios/cheerio。
   iOS 上少一层原生依赖，构建失败面小一圈。

---

## 目录结构

```
boxclone/
├── setup.sh                        装配脚本：生成 RN 壳 → 装依赖 → 覆盖 overlay → 注入原生补丁
├── build-ipa.sh                    编未签名 .ipa
├── patch.js                        原生配置注入（Info.plist / AppDelegate / Podfile）
├── .github/workflows/
│   ├── build-ipa.yml               macOS runner 出 ipa（绕开没有 Mac 的限制）
│   └── node-test.yml               ubuntu 跑爬虫层测试（快，不用等 40 分钟构建）
├── test/
│   ├── local_test.js               Node 侧全链路测试（起 mock 采集站，47 项断言）
│   └── tsx_check.js                TS/TSX 语法 + 相对导入解析校验
└── overlay/                        覆盖进 RN 工程的源码
    ├── App.tsx                     根组件：路由分发 + Toast 宿主
    ├── metro.config.js             block 掉 nodejs-assets，别让 Metro 去解析 Node 代码
    ├── src/
    │   ├── config.ts               超时/分页/设置默认值
    │   ├── theme.ts                纯黑配色 + 尺寸常量 + 海报尺寸计算
    │   ├── state/siteBus.ts        跨页换源事件（片库 → 首页）
    │   ├── node/NodeService.ts     nodejs-mobile 生命周期 + 桥消息（单例）
    │   ├── api/CatApi.ts           全部 HTTP 接口 + vod_play_* 解析 + 并发收敛
    │   ├── nav/Stack.tsx           极简栈导航（不引 react-navigation）
    │   ├── player/VideoPlayer.tsx  播放器 + 自绘控制条
    │   └── ui/
    │       ├── components/Common.tsx   Toast/按钮/页头/空态/错误/区块标题
    │       ├── components/Icons.tsx    自绘图标（View 拼，不引 svg 库）
    │       ├── components/Banner.tsx   首页主视觉轮播（pagingEnabled + 定时器）
    │       ├── components/Poster.tsx   海报卡（无图占位 + 图内评分胶囊）
    │       └── screens/               Boot Tabs Home Search Catalog Mine Category Detail
    │                                  Player Sites SiteEdit Records Diagnostics About
    └── nodejs-project/             内嵌 Node 工程（这份代码跑在 nodejs-mobile 里）
        ├── main.js                 入口：起服务、回传端口、处理桥消息
        ├── server.js               零依赖 HTTP 路由
        ├── store.js                站点配置持久化（原子写）
        ├── prefs.js                播放历史/收藏/设置
        └── spiders/
            ├── index.js            spider 注册表（按 type 分发）
            ├── maccms.js           苹果CMS v10
            ├── direct.js           直链 / 多行片单
            └── custom.js           外部 JS 源码加载（热生效）
```

---

## 界面版式

首页按参考稿的影视 App 版式做，尺寸全部从 `theme.ts` 的常量推：

| 区域 | 实现 | 关键数值 |
|---|---|---|
| 搜索条 | `Home.tsx:TopBar` | 高 42 / 圆角 21 / 底 `#1A1A1D`，右侧四宫格开换源面板 |
| 频道行 | `Home.tsx:ChannelRow` | 选中白字 800 字重 + 22×3 三段蓝紫渐变条 |
| 主视觉 | `Banner.tsx` | 宽 `屏宽-32`，高 16:9，底部 26 层透明黑压暗，圆点右下拉长 |
| 海报网格 | `Poster.tsx` | 3 列，列间距 8，图比 1:1.47，评分胶囊贴图底居中，片名图下单行居中 |
| 底部栏 | `Tabs.tsx` | 悬浮胶囊 62 高，左右 14 / 底 14，四等分，选中 `#3E63FF` |

可滚动页面底部统一留 `TABBAR_SPACE`（104），否则最后一排会被悬浮栏压住。

换源有两个入口：右上角四宫格（底部弹层，就地换）和「片库」tab（列表选，选中后回首页）。

---

## 依赖

| 层 | 依赖 | 版本 | 说明 |
|---|---|---|---|
| RN | react-native | 0.72.17 | 锁旧架构，nodejs-mobile 只支持旧架构 |
| RN | react | 18.2.0 | 跟 RN 0.72 配套 |
| 原生 | nodejs-mobile-react-native | 18.20.4 | 内嵌 Node 18.20.4 |
| 原生 | react-native-video | 6.19.2 | 播放 + 后台/全屏 |
| 构建 | Node (npm/Metro 阶段) | 20 | nodejs-mobile 的构建阶段要求 Node 18 |
| 构建 | Xcode | 15.4 | CI 用这个版本 |
| 构建 | CocoaPods | 最新 | `pod install --repo-update` |

Node 侧自己零依赖。

---

## 构建

### 本地（需要 macOS + Xcode + CocoaPods）

```bash
chmod +x setup.sh build-ipa.sh
./setup.sh            # 首次较久：生成壳、装依赖、pod install
./build-ipa.sh        # → app/ios/build/BoxClone.ipa（未签名）
```

跳过 pod（CI 用，便于切 Node 版本）：

```bash
./setup.sh --skip-pod
cd app/ios && pod install --repo-update && cd ../..
./build-ipa.sh
```

重新来一遍：

```bash
./setup.sh --clean
```

### GitHub Actions（没有 Mac 就走这个）

1. 把整个 `boxclone/` 推到自己的仓库
2. 仓库 → Actions → **Build iOS IPA** → Run workflow
3. 跑完在运行页底部 **Artifacts → `BoxClone-unsigned-ipa`** 下载

单次约 40–60 分钟（首次 pod 缓存没建立时更久）。

### Android（不需要 Mac）

```bash
chmod +x setup.sh build-apk.sh
./setup.sh --skip-pod          # Android 不需要 CocoaPods
./build-apk.sh                 # → app/android/app/build/outputs/apk/release/app-release.apk
```

环境要求：JDK 17、Android SDK（platform 33 + build-tools 33.0.2 + **NDK 23.1.7779620** + CMake 3.22.1）。
NDK 版本必须和 `android/build.gradle` 里的 `ndkVersion` 一致 —— nodejs-mobile 会读这个值编自己的
libnode，版本不对 CMake 直接失败。

`build-apk.sh` 会自动生成 `boxclone.keystore`（密码 `boxclone` / 别名 `boxclone`），
所以产物是**已签名**的，`adb install` 直接装，不用再处理。

CI 走 `.github/workflows/build-apk.yml`（ubuntu-latest，15-25 分钟，比 iOS 快一倍多）。

### 安装（未签名 → 自签）

- **Sideloadly**（Win/macOS，免费 Apple ID）
- **AltStore**（免费 Apple ID，7 天自动续签）
- **TrollStore**（受支持 iOS 版本，永久签名）

免费 Apple ID 签的 7 天过期，到期重签。

Android 没有这层限制，APK 装完就是装完了。

### 两个平台的差异点

| | iOS | Android |
|---|---|---|
| 构建机 | macOS + Xcode 15.x | 任意系统 + JDK 17 + NDK |
| 产物 | 未签名 ipa（要自签） | 已签名 apk（直接装） |
| 后台播放 | `UIBackgroundModes: audio` + AVAudioSession playback | `WAKE_LOCK` 权限 |
| 明文 http | ATS `NSAllowsArbitraryLoads` | `usesCleartextTraffic="true"` |
| 返回键 | 无（靠手势/导航栏） | `BackHandler`（`Stack.tsx` 已处理） |
| 底部安全区 | `SafeAreaView` 兜 home indicator | `TABBAR_BOTTOM` 多加 8dp 躲手势条 |
| ABI | arm64 单一 | arm64-v8a + armeabi-v7a（nodejs-mobile 没有 x86） |

---

## 用起来

装完首次启动会起内嵌服务（几秒，有加载页）。然后：

**我的 → 源管理 → + 新增**，选类型，填地址。

### 三种源

#### 1. 苹果CMS v10（type=1）

只填站点地址，例如 `https://xxx.com`。采集路径默认 `api.php/provide/vod`，站点路径不一样时在「采集路径」里改。

实际请求：

```
GET {base}/api.php/provide/vod/?ac=list                 分类表 + 首页
GET {base}/api.php/provide/vod/?ac=detail&t=1&pg=2      分类内容
GET {base}/api.php/provide/vod/?ac=detail&ids=101       详情
GET {base}/api.php/provide/vod/?ac=detail&wd=关键词&pg=1 搜索
```

**只认 JSON 响应**。站点若只开了 XML，会在「测试」里明确报「响应不是 JSON」，不会静默返回空列表。

#### 2. 直链 / 推送（type=4）

- 单条：地址填 `http://…/movie.m3u8`
- 片单：片单框里多行 `名称$地址`，`#` 开头是注释

#### 3. 自定义 JS（type=9）

把 JS 源码粘进「JS 脚本」框，点「填入模板」有骨架。契约：

```js
// ctx = { site, body, fetch, require, buffer, log }
module.exports = {
  async init(ctx)              {},                                    // 可选
  async home(ctx)              ({ class: [{type_id, type_name}], list: [vod] }),
  async category(ctx)          ({ page, pagecount, limit, total, list: [vod] }),
  async detail(ctx)            ({ list: [vod] }),
  async play(ctx)              ({ parse: 0, url }),                  // parse=1 不支持
  async search(ctx)            ({ page, pagecount, limit, total, list: [vod] }),
};
```

`vod` 字段：`vod_id vod_name vod_pic vod_content vod_play_from vod_play_url vod_remarks vod_year vod_area type_name`

`vod_play_from` / `vod_play_url` 用 CatVod 约定：线路 `$$$` 分隔，分集 `#` 分隔，分集内 `名称$地址`。

改完保存**立即生效**（`custom.js` 每次加载都清 require 缓存），不用重启 App。

> 不支持 CatVodOpen 的 fastify 插件式源（`module.exports = {meta, api: fastify => {...}}`）。
> 碰到会明确报错提示，不会假装跑起来。

---

## 本机 HTTP 接口

App 内服务只绑 `127.0.0.1` 的随机端口，外部访问不到。调试时可以看「我的 → 诊断 → 服务地址」拿端口，浏览器直连。

```
GET  /check                              存活
GET  /config                             站点配置（CatVod 格式）
GET  /sites                              站点列表

POST /sites/add        {site}
POST /sites/update     {key, patch}
POST /sites/remove     {key}
POST /sites/reorder    {keys}
POST /sites/reset
POST /sites/test       {key}             探测：返回分类 + 样本标题
POST /sites/export
POST /sites/import     {sites: [...]}

POST /spider/{key}/{type}/init
POST /spider/{key}/{type}/home
POST /spider/{key}/{type}/category          {id, page}
POST /spider/{key}/{type}/detail            {id}
POST /spider/{key}/{type}/play              {flag, id}
POST /spider/{key}/{type}/search            {wd, page}

GET  /prefs                               settings / history / favorites
POST /prefs/settings   {patch}
POST /prefs/history    {item}
POST /prefs/history/remove {id}
POST /prefs/history/clear
POST /prefs/fav        {item}             切换收藏
```

业务错误统一 `HTTP 500 + {err, tip}`。

---

## 测试

```bash
# 爬虫层全链路（起 mock 采集站，47 项断言，普通 Node 就能跑）
node test/local_test.js

# TS/TSX 语法 + 相对导入校验（需要 @babel/parser）
npm i --no-save @babel/parser@7
node test/tsx_check.js
```

`local_test.js` 覆盖：store 初始化与落盘、`/config` 五板块分流、站点 CRUD、测试探测、五个 action 全链路、
错误路径（未知站点/未知 action/连不通/非法直链）、direct 与 custom 两种源、导出导入删除、原子写无残留。

---

## 数据落盘

都在 App 的 Documents 目录下 `boxclone/`：

```
boxclone/
├── sites.json        站点配置（原子写，先 .tmp 再 rename）
├── prefs.json        历史 / 收藏 / 设置
└── scripts/          自定义 JS 源的落盘副本（<key>.js）
```

`db.json` 路径可以从「诊断 → 环境信息」看到。

---

## 已知限制

- **parse=1 不处理**。需要网页嗅探/外部解析的地址直接报错，提示换线路。做二次嗅探要起 WebView 拦请求，是另一个工程量。
- **不支持 fastify 插件式源**。要按上面的简化契约改写。
- **iOS 无 JIT**。Node 跑解释模式，首次启动和复杂脚本会慢一点。
- **ATS 全放行**。源站多数是 http，正式发行应该按域收窄。
- **仅视频板块**。`/config` 里 read/comic/music/pan 是空数组，号段和路由留着，spider 没实现。
- **nodejs-mobile 只支持 RN 旧架构**。别升到新架构 RN，会直接编不过。

---

## 排障

**启动卡住 / 报「内嵌服务启动超时」**
→ 我的 → 诊断 → 看日志。「我的 → 诊断 → 重启服务」可以重起 Node 线程。

**源加了但列表空**
→ 源管理点「测试」。会返回真实错误：`HTTP 404`（采集路径填错）、`响应不是 JSON`（只支持 XML 的站）、`请求失败`（网络不通/被墙）。

**能进详情但点播放失败**
→ 换线路。多线路时每个线路独立，一条挂了不影响别的。

**编译失败在 pod install**
→ 检查 Podfile 里 Flipper 是否已关（`patch.js` 会自动处理），以及 Xcode 版本是否 ≥ 15。

---

本项目不提供、不内置、不分发任何内容源。App 是空壳，所有内容来自使用者自己配置的接口。
