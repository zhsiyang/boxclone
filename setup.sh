#!/usr/bin/env bash
# ============================================================================
# BoxClone 工程装配脚本
#
#   生成 RN 原生壳 → 装依赖 → 覆盖 overlay 源码 → 注入原生补丁 →(可选)pod install
#
# 用法：
#   ./setup.sh              完整装配（含 pod install，需 macOS + CocoaPods）
#   ./setup.sh --skip-pod   CI 用，跳过 pod（便于切回 Node 18 再跑原生构建）
#   ./setup.sh --clean      删掉 app/ 重新生成
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HERE/app"
RN_VERSION="0.72.17"
# RN 0.72 兼容的最后一个 CLI，注意它的版本号跟 RN 不是一个体系
CLI_VERSION="11.3.7"
PROJECT="BoxClone"

SKIP_POD=false
CLEAN=false
for arg in "$@"; do
    case "$arg" in
        --skip-pod) SKIP_POD=true ;;
        --clean) CLEAN=true ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

if [ "$CLEAN" = "true" ] && [ -d "$APP_DIR" ]; then
    echo "▶ 清理旧工程 …"
    rm -rf "$APP_DIR"
fi

if [ ! -d "$APP_DIR" ]; then
    echo "▶ 生成 RN 原生壳 (react-native $RN_VERSION) …"
    npm cache clean --force 2>/dev/null || true
    npx "@react-native-community/cli@$CLI_VERSION" init "$PROJECT" \
        --directory app --skip-install --version "$RN_VERSION"
fi

cd "$APP_DIR"

# nodejs-mobile 的 postinstall 会往 nodejs-assets/ 里写辅助脚本，先建目录
mkdir -p nodejs-assets

echo "▶ 安装 RN 依赖 …"
npm install

echo "▶ 安装原生依赖（nodejs-mobile / react-native-video）…"
npm install --save nodejs-mobile-react-native@18.20.4 react-native-video@6.19.2

echo "▶ 覆盖 RN 源码 …"
rm -rf "$APP_DIR/src"
cp -R "$HERE/overlay/src" "$APP_DIR/src"
# Metro 优先解析 .js，默认模板里的 App.js 必须删掉，否则我们的 App.tsx 不生效
rm -f "$APP_DIR/App.js" "$APP_DIR/App.tsx" "$APP_DIR/App.ts"
cp "$HERE/overlay/App.tsx" "$APP_DIR/App.tsx"
cp "$HERE/overlay/metro.config.js" "$APP_DIR/metro.config.js"

echo "▶ 覆盖内嵌 Node 工程 …"
mkdir -p "$APP_DIR/nodejs-assets/nodejs-project"
rm -rf "$APP_DIR/nodejs-assets/nodejs-project/spiders"
cp "$HERE/overlay/nodejs-project/main.js"        "$APP_DIR/nodejs-assets/nodejs-project/main.js"
cp "$HERE/overlay/nodejs-project/server.js"      "$APP_DIR/nodejs-assets/nodejs-project/server.js"
cp "$HERE/overlay/nodejs-project/store.js"       "$APP_DIR/nodejs-assets/nodejs-project/store.js"
cp "$HERE/overlay/nodejs-project/prefs.js"       "$APP_DIR/nodejs-assets/nodejs-project/prefs.js"
cp "$HERE/overlay/nodejs-project/package.json"   "$APP_DIR/nodejs-assets/nodejs-project/package.json"
cp -R "$HERE/overlay/nodejs-project/spiders"     "$APP_DIR/nodejs-assets/nodejs-project/spiders"

echo "▶ 注入 iOS 原生配置 …"
node "$HERE/patch.js" "$APP_DIR"

echo "▶ 注入 Android 原生配置 …"
node "$HERE/patch-android.js" "$APP_DIR"

if [ "$SKIP_POD" = "true" ]; then
    echo "⏭ 跳过 pod install（--skip-pod）"
else
    echo "▶ pod install …"
    cd "$APP_DIR/ios"
    pod install --repo-update
    cd "$APP_DIR"
fi

echo ""
echo "✅ 装配完成：$APP_DIR"
echo "   iOS : $HERE/build-ipa.sh"
echo "   Android: $HERE/build-apk.sh"
