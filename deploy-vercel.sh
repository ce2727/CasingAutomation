#!/usr/bin/env bash
# ==============================================================================
# deploy-vercel.sh
# Deploys the ProCase web application to Vercel production.
#
# Usage:
#   ./deploy-vercel.sh           # Deploy to production (default)
#   ./deploy-vercel.sh --preview # Deploy preview build
# ==============================================================================

set -euo pipefail

# Ensure we're in the repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================================="
echo "  ProCase Vercel Deployment"
echo "================================================="
echo

# 1. Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "==> node_modules not found. Running npm install..."
  npm install
fi

# 2. Verify web build with VERCEL=1 flag (disables Electron plugins in vite.config.ts)
echo "==> Verifying web bundle build (VERCEL=1)..."
VERCEL=1 npm run build

# 3. Publish to Vercel
TARGET_FLAG="--prod"
for arg in "$@"; do
  if [ "$arg" = "--preview" ]; then
    TARGET_FLAG=""
    break
  fi
done

if [ -n "$TARGET_FLAG" ]; then
  echo
  echo "==> Deploying to Vercel (Production)..."
  npx vercel deploy --prod --yes "$@"
else
  echo
  echo "==> Deploying to Vercel (Preview)..."
  npx vercel deploy --yes "$@"
fi

echo
echo "================================================="
echo "  Vercel deployment completed successfully!"
echo "================================================="
