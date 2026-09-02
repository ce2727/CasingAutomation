#!/usr/bin/env bash
# ==============================================================================
# build-packages.sh
# Creates packaged desktop builds of ProCase for macOS and Windows.
#
# Usage:
#   ./build-packages.sh          # Build for both macOS and Windows
#   ./build-packages.sh mac      # Build for macOS only
#   ./build-packages.sh win      # Build for Windows only
# ==============================================================================

set -euo pipefail

# Ensure we're in the repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET="${1:-all}"

echo "================================================="
echo "  ProCase Desktop Build & Package Generator"
echo "================================================="
echo "Target: $TARGET"
echo

# 1. Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "==> node_modules not found. Running npm install..."
  npm install
fi

# 2. Build TypeScript and Vite web & electron bundles
echo "==> Step 1: Compiling TypeScript and building Vite bundle..."
npm run build

# 3. Package based on target
case "$TARGET" in
  mac|macos)
    echo
    echo "==> Step 2: Packaging for macOS (DMG for arm64 & x64)..."
    npx electron-builder --mac
    ;;
  win|windows)
    echo
    echo "==> Step 2: Packaging for Windows (NSIS installer for x64)..."
    npx electron-builder --win
    ;;
  all|both)
    echo
    echo "==> Step 2: Packaging for macOS (DMG for arm64 & x64)..."
    npx electron-builder --mac
    echo
    echo "==> Step 3: Packaging for Windows (NSIS installer for x64)..."
    npx electron-builder --win
    ;;
  *)
    echo "Unknown target: $TARGET"
    echo "Valid options: all, mac, win"
    exit 1
    ;;
esac

echo
echo "================================================="
echo "  Build successful! Artifacts generated in:"
echo "  $SCRIPT_DIR/release"
echo "================================================="
ls -lh "$SCRIPT_DIR/release"
