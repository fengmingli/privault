#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "此验收脚本当前仅用于 macOS Appium Mac2。"
  exit 1
fi
if ! xcodebuild -version >/dev/null 2>&1 && [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "完整 Xcode 尚未安装或未配置；无法启动 Mac2 WebDriverAgent。"
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:4723/status >/dev/null 2>&1; then
  echo "本地 Appium 端口已被占用；请先结束已有测试服务。"
  exit 1
fi

TMP_BASE="${TMPDIR:-/tmp}"
TMP_BASE="${TMP_BASE%/}"
TEST_ROOT="$(mktemp -d "$TMP_BASE/privault-desktop-XXXXXX")"
APPIUM_PID=""
cleanup() {
  if [[ -n "$APPIUM_PID" ]]; then
    kill "$APPIUM_PID" >/dev/null 2>&1 || true
    wait "$APPIUM_PID" >/dev/null 2>&1 || true
  fi
  if [[ "${PRIVAULT_DESKTOP_DEBUG:-}" == "1" && -f "$TEST_ROOT/appium.log" ]]; then
    cp "$TEST_ROOT/appium.log" test-results/desktop-appium.log
  fi
  if [[ "${PRIVAULT_DESKTOP_DEBUG:-}" == "1" && -f "$PRIVAULT_CONFIG_DIR/config.json" ]]; then
    cp "$PRIVAULT_CONFIG_DIR/config.json" test-results/desktop-config.json
  fi
  if [[ -n "${PRIVAULT_APP_PATH:-}" ]]; then
    APP_BINARY="$PRIVAULT_APP_PATH/Contents/MacOS/privault-ui"
    while read -r app_pid; do
      [[ -n "$app_pid" ]] && kill "$app_pid" >/dev/null 2>&1 || true
    done < <(ps -axo pid=,comm= | awk -v binary="$APP_BINARY" '$2 == binary { print $1 }')
  fi
  case "$TEST_ROOT" in
    "$TMP_BASE"/privault-desktop-*) rm -rf -- "$TEST_ROOT" ;;
  esac
}
trap cleanup EXIT INT TERM

mkdir -p test-results
npm run build
npx tauri build --debug --bundles app
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.privault.prototype.debug" "$ROOT_DIR/src-tauri/target/debug/bundle/macos/Privault.app/Contents/Info.plist"
export PRIVAULT_BUNDLE_ID=com.privault.prototype.debug
codesign --force --deep --sign - "$ROOT_DIR/src-tauri/target/debug/bundle/macos/Privault.app"
codesign --verify --deep --strict --verbose=2 "$ROOT_DIR/src-tauri/target/debug/bundle/macos/Privault.app"

export PRIVAULT_APP_PATH="$ROOT_DIR/src-tauri/target/debug/bundle/macos/Privault.app"
export PRIVAULT_CONFIG_DIR="$TEST_ROOT/vault"
export PRIVAULT_MIGRATION_DIR="$TEST_ROOT/migrated"
export PRIVAULT_CREATE_DIR="$TEST_ROOT/created"
mkdir -p "$PRIVAULT_MIGRATION_DIR" "$PRIVAULT_CREATE_DIR"

APPIUM_LOG_LEVEL=error
if [[ "${PRIVAULT_DESKTOP_DEBUG:-}" == "1" ]]; then
  APPIUM_LOG_LEVEL=info
fi
npx appium --address 127.0.0.1 --port 4723 --log-level "$APPIUM_LOG_LEVEL" >"$TEST_ROOT/appium.log" 2>&1 &
APPIUM_PID=$!
ready=0
for _ in {1..60}; do
  if curl -fsS --max-time 2 http://127.0.0.1:4723/status >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$APPIUM_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "隔离 Appium 服务未能启动。"
  exit 1
fi

node tests/desktop-smoke.mjs
