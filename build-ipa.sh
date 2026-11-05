#!/usr/bin/env bash
# ============================================================================
# 编译未签名 .ipa（侧载 / 自签用）。必须先跑过 ./setup.sh
#
# 产物：app/ios/build/BoxClone.ipa
# 未签名，装之前要用 Sideloadly / AltStore / TrollStore 自签。
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
IOS="$HERE/app/ios"
DD="$IOS/build/dd"
PROJECT="BoxClone"

if [ ! -d "$IOS" ]; then
    echo "✗ 找不到 $IOS —— 先执行 ./setup.sh"
    exit 1
fi

cd "$IOS"
rm -rf "$IOS/build"

echo "▶ xcodebuild (Release / iphoneos / 不签名) …"
set +e
xcodebuild \
    -workspace "$PROJECT.xcworkspace" \
    -scheme "$PROJECT" \
    -configuration Release \
    -sdk iphoneos \
    -derivedDataPath "$DD" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    AD_HOC_CODE_SIGNING_ALLOWED=YES \
    ENABLE_BITCODE=NO \
    2>&1 | tail -40
XCODE_RC=${PIPESTATUS[0]}
set -e

APP="$DD/Build/Products/Release-iphoneos/$PROJECT.app"
if [ ! -d "$APP" ]; then
    echo "✗ 编译失败（xcodebuild rc=$XCODE_RC），没找到 $APP"
    echo "--- DerivedData 内容 ---"
    ls -R "$DD" 2>/dev/null | head -40
    exit 1
fi

echo "▶ 打包 .ipa …"
rm -rf "$IOS/build/Payload"
mkdir -p "$IOS/build/Payload"
cp -R "$APP" "$IOS/build/Payload/"

# 去掉旧的签名目录，避免自签时校验冲突
rm -rf "$IOS/build/Payload/$PROJECT.app/_CodeSignature"

(
    cd "$IOS/build"
    rm -f "$PROJECT.ipa"
    zip -qry "$PROJECT.ipa" Payload
)

IPA="$IOS/build/$PROJECT.ipa"
if [ -f "$IPA" ]; then
    echo ""
    echo "✅ $IPA"
    echo "   大小：$(du -h "$IPA" | awk '{print $1}')"
    echo "   自签：Sideloadly / AltStore / TrollStore 任选"
else
    echo "✗ 打包失败，$IPA 不存在"
    exit 1
fi
