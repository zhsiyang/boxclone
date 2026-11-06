#!/usr/bin/env bash
# ============================================================================
# 编译 .apk。必须先跑过 ./setup.sh
#
# 产物：app/android/app/build/outputs/apk/release/app-release.apk
# 用工程内自动生成的 keystore 签名（boxclone / boxclone），可直接装。
#
# 用法：
#   ./build-apk.sh              release 包
#   ./build-apk.sh --debug      debug 包（带 dev menu，仅供排查）
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
AND="$HERE/app/android"
KS="$AND/app/boxclone.keystore"
KS_PASS="boxclone"
KS_ALIAS="boxclone"

MODE="release"
for arg in "$@"; do
    case "$arg" in
        --debug) MODE="debug" ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

if [ ! -d "$AND" ]; then
    echo "✗ 找不到 $AND —— 先执行 ./setup.sh"
    exit 1
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    echo "⚠ 没检测到 ANDROID_HOME / ANDROID_SDK_ROOT"
    echo "  CI 上由 actions/setup-java + 预装 SDK 提供，本地要自己设"
fi

# ---- 1. keystore ----
if [ "$MODE" = "release" ] && [ ! -f "$KS" ]; then
    echo "▶ 生成 keystore …"
    keytool -genkeypair -v \
        -storetype PKCS12 \
        -keystore "$KS" \
        -alias "$KS_ALIAS" \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$KS_PASS" -keypass "$KS_PASS" \
        -dname "CN=BoxClone, OU=Dev, O=BoxClone, L=Beijing, ST=Beijing, C=CN" \
        > /dev/null 2>&1 || {
            echo "✗ keytool 失败，JDK 装了吗"
            exit 1
        }
    echo "  $KS  ($(wc -c < "$KS" | tr -d ' ') B)"
fi

# ---- 2. 清理旧产物 ----
cd "$AND"
rm -rf app/build/outputs/apk

# ---- 3. 编译 ----
if [ "$MODE" = "debug" ]; then
    TASK="assembleDebug"
    OUT_DIR="app/build/outputs/apk/debug"
    APK_NAME="app-debug.apk"
else
    TASK="assembleRelease"
    OUT_DIR="app/build/outputs/apk/release"
    APK_NAME="app-release.apk"
fi

echo "▶ gradlew $TASK …"
LOG="$AND/build-$MODE.log"
set +e
./gradlew "$TASK" --no-daemon --stacktrace > "$LOG" 2>&1
GRADLE_RC=$?
set -e
tail -30 "$LOG"

if [ "$GRADLE_RC" -ne 0 ]; then
    echo ""
    echo "✗ gradle 失败 rc=$GRADLE_RC"
    echo "--- 错误行 ---"
    grep -nE "FAILURE|error:|What went wrong|Caused by" "$LOG" | head -25 || true
    exit 1
fi

APK="$AND/$OUT_DIR/$APK_NAME"
# 没配 signingConfig 时 RN 会产出 -unsigned，这里兜一下
if [ ! -f "$APK" ] && [ -f "${APK%-release.apk}-release-unsigned.apk" ]; then
    APK="${APK%-release.apk}-release-unsigned.apk"
fi
if [ ! -f "$APK" ]; then
    echo "✗ 没找到 apk，实际产物："
    find "$AND/app/build/outputs" -name "*.apk" 2>/dev/null || true
    exit 1
fi

# ---- 4. 校验 ----
echo "▶ 校验 APK …"
SIZE=$(wc -c < "$APK" | tr -d ' ')
echo "  大小 $(($SIZE / 1024 / 1024)) MB"

if [ "$SIZE" -lt 20000000 ]; then
    echo "✗ 只有 $(($SIZE / 1024)) KB，RN + node 的包不可能这么小"
    exit 1
fi

# 必须有的东西：dex、node 的 so、js bundle
need_files=(
    "classes.dex"
    "assets/index.android.bundle"
    "lib/arm64-v8a/libnode.so"
)
MISSING=0
for f in "${need_files[@]}"; do
    if unzip -l "$APK" 2>/dev/null | grep -q "$f"; then
        echo "  ✓ $f"
    else
        echo "  ✗ 缺 $f"
        MISSING=1
    fi
done

# assets 里的 nodejs-project
if unzip -l "$APK" 2>/dev/null | grep -q "assets/nodejs-project/main.js"; then
    echo "  ✓ assets/nodejs-project/main.js"
else
    echo "  ✗ 缺内嵌 Node 工程 —— nodejs-assets 没被打进去"
    MISSING=1
fi

if [ "$MISSING" -ne 0 ]; then
    echo ""
    echo "✗ 产物不完整"
    exit 1
fi

# 签名信息（有 apksigner 就打出来）
APKSIGNER=$(ls -1 "${ANDROID_HOME:-/nonexistent}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)
if [ -n "$APKSIGNER" ] && [ -x "$APKSIGNER" ]; then
    echo "▶ 签名信息"
    "$APKSIGNER" verify --print-certs "$APK" 2>&1 | head -6 | sed 's/^/  /'
fi

echo ""
echo "✅ $APK"
echo "   直接用 adb install 装，或拷到手机点开"
echo "   adb install -r \"$APK\""
